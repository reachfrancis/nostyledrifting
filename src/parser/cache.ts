
import { LRUCache } from 'lru-cache';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { SCSSNode } from './ast-nodes';
import { ParseError, ParseWarning } from './error-recovery';

export interface ParseResult {
  success: boolean;
  ast: SCSSNode | null;
  metadata: FileParseMetadata;
  errors: ParseError[];
  warnings: ParseWarning[];
  dependencies: ResolvedImport[];
  complexity: ComplexityMetrics;
  cacheInfo: CacheMetadata;
}

export interface FileParseMetadata {
  filePath: string;
  fileSize: number;
  lastModified: Date;
  hash: string;
  parseTime: number;
  lineCount: number;
}

export interface ResolvedImport {
  originalPath: string;
  resolvedPath: string;
  resolutionMethod: 'explicit' | 'node_modules' | 'scss_paths';
  namespace?: string;
  isCircular: boolean;
}

export interface ComplexityMetrics {
  nestingDepth: number;
  selectorComplexity: number;
  variableCount: number;
  mixinCount: number;
  importCount: number;
  functionCount: number;
  totalNodes: number;
}

export interface CacheMetadata {
  cacheHit: boolean;
  cacheLevel: 'none' | 'memory' | 'disk';
  cacheTime?: Date;
  invalidationReason?: string;
}

export interface CacheEntry {
  result: ParseResult;
  timestamp: Date;
  fileHash: string;
  dependencies: string[];
}

export interface CacheConfig {
  enabled: boolean;
  maxMemoryEntries: number;
  diskCacheDir?: string;
  maxDiskCacheSize: number; // in MB
  ttl: number; // in milliseconds
}

export class ParserCache {
  private memoryCache: LRUCache<string, CacheEntry>;
  private diskCacheDir: string;
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    diskHits: 0,
    diskMisses: 0,
    invalidations: 0
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.memoryCache = new LRUCache<string, CacheEntry>({
      max: config.maxMemoryEntries,
      ttl: config.ttl
    });

    this.diskCacheDir = config.diskCacheDir || path.join(process.cwd(), '.scss-parser-cache');
    this.ensureCacheDirectory();
  }

  public async get(filePath: string): Promise<ParseResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    const fileStats = await this.getFileStats(filePath);
    if (!fileStats) {
      return null;
    }

    const cacheKey = this.generateCacheKey(filePath);
    
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && this.isValidEntry(memoryEntry, fileStats)) {
      this.stats.hits++;
      return {
        ...memoryEntry.result,
        cacheInfo: {
          cacheHit: true,
          cacheLevel: 'memory',
          cacheTime: memoryEntry.timestamp
        }
      };
    }

    // Try disk cache
    const diskEntry = await this.getDiskEntry(cacheKey);
    if (diskEntry && this.isValidEntry(diskEntry, fileStats)) {
      this.stats.diskHits++;
      
      // Promote to memory cache
      this.memoryCache.set(cacheKey, diskEntry);
      
      return {
        ...diskEntry.result,
        cacheInfo: {
          cacheHit: true,
          cacheLevel: 'disk',
          cacheTime: diskEntry.timestamp
        }
      };
    }

    this.stats.misses++;
    return null;
  }

  public async set(filePath: string, result: ParseResult): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const fileStats = await this.getFileStats(filePath);
    if (!fileStats) {
      return;
    }

    const cacheKey = this.generateCacheKey(filePath);
    const entry: CacheEntry = {
      result: {
        ...result,
        cacheInfo: {
          cacheHit: false,
          cacheLevel: 'none'
        }
      },
      timestamp: new Date(),
      fileHash: fileStats.hash,
      dependencies: result.dependencies.map(dep => dep.resolvedPath)
    };

    // Set in memory cache
    this.memoryCache.set(cacheKey, entry);

    // Set in disk cache (async, don't wait)
    this.setDiskEntry(cacheKey, entry).catch(error => {
      console.warn(`Failed to write disk cache for ${filePath}:`, error.message);
    });
  }

  public async invalidate(filePath: string, reason: string = 'manual'): Promise<void> {
    const cacheKey = this.generateCacheKey(filePath);
    
    // Remove from memory cache
    this.memoryCache.delete(cacheKey);
    
    // Remove from disk cache
    await this.deleteDiskEntry(cacheKey);
    
    this.stats.invalidations++;
  }

  public async invalidateDependencies(filePath: string): Promise<void> {
    const cacheKey = this.generateCacheKey(filePath);
    const affectedKeys: string[] = [];

    // Check memory cache for dependencies
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.dependencies.includes(filePath)) {
        affectedKeys.push(key);
      }
    }

    // Invalidate all affected entries
    for (const key of affectedKeys) {
      this.memoryCache.delete(key);
      await this.deleteDiskEntry(key);
    }

    this.stats.invalidations += affectedKeys.length;
  }

  public async clear(): Promise<void> {
    this.memoryCache.clear();
    await fs.remove(this.diskCacheDir);
    await this.ensureCacheDirectory();
    
    this.stats = {
      hits: 0,
      misses: 0,
      diskHits: 0,
      diskMisses: 0,
      invalidations: 0
    };
  }

  public getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      memorySize: this.memoryCache.size,
      diskCacheDir: this.diskCacheDir
    };
  }

  private generateCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  private async getFileStats(filePath: string): Promise<{ hash: string; lastModified: Date } | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const hash = crypto.createHash('md5').update(content).digest('hex');
      
      return {
        hash,
        lastModified: stats.mtime
      };
    } catch (error) {
      return null;
    }
  }

  private isValidEntry(entry: CacheEntry, fileStats: { hash: string; lastModified: Date }): boolean {
    return entry.fileHash === fileStats.hash;
  }

  private async getDiskEntry(cacheKey: string): Promise<CacheEntry | null> {
    try {
      const cachePath = path.join(this.diskCacheDir, `${cacheKey}.json`);
      if (await fs.pathExists(cachePath)) {
        const content = await fs.readFile(cachePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      // Ignore disk cache errors
    }
    
    this.stats.diskMisses++;
    return null;
  }

  private async setDiskEntry(cacheKey: string, entry: CacheEntry): Promise<void> {
    try {
      const cachePath = path.join(this.diskCacheDir, `${cacheKey}.json`);
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      // Ignore disk cache errors
    }
  }

  private async deleteDiskEntry(cacheKey: string): Promise<void> {
    try {
      const cachePath = path.join(this.diskCacheDir, `${cacheKey}.json`);
      await fs.remove(cachePath);
    } catch (error) {
      // Ignore disk cache errors
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.diskCacheDir);
    } catch (error) {
    
      console.warn(`Failed to create cache directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    }
  }
}
