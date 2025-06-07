import { StyleDiffResult } from './types';
import { createHash } from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface DiffCacheEntry {
  key: string;
  result: StyleDiffResult;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed: boolean;
  metadata: {
    fileHashes?: string[];
    options?: any;
    version: string;
  };
}

export interface DiffCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: number;
  newestEntry: number;
  compressionRatio: number;
  averageAccessCount: number;
}

export interface DiffCacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  persistToDisk: boolean;
  compressionEnabled: boolean;
}

export interface DiffCacheKeyParams {
  type: string;
  content1?: string;
  content2?: string;
  file1?: string;
  file2?: string;
  options?: any;
}

/**
 * Intelligent caching system for diff results
 */
export class DiffCache {
  private cache: Map<string, DiffCacheEntry>;
  private config: DiffCacheConfig;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    totalRequests: number;
    totalSize: number;
    uncompressedSize: number;
  };

  constructor(config: DiffCacheConfig) {
    this.config = config;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      totalSize: 0,
      uncompressedSize: 0
    };

    // Start periodic cleanup
    if (this.config.enabled && this.config.ttl > 0) {
      setInterval(() => this.cleanup(), Math.min(this.config.ttl / 2, 300000)); // Max 5 minutes
    }
  }

  /**
   * Get a cached result
   */
  public async get(key: string): Promise<StyleDiffResult | null> {
    if (!this.config.enabled) return null;

    this.stats.totalRequests++;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.stats.hits++;

    // Decompress if needed
    if (entry.compressed) {
      try {
        const decompressed = await this.decompress(entry.result);
        return decompressed;
      } catch (error) {
        // If decompression fails, remove entry and return null
        this.cache.delete(key);
        return null;
      }
    }

    return entry.result;
  }

  /**
   * Set a cache entry
   */
  public async set(key: string, result: StyleDiffResult, metadata?: any): Promise<void> {
    if (!this.config.enabled) return;

    // Calculate size
    const resultStr = JSON.stringify(result);
    const originalSize = Buffer.byteLength(resultStr, 'utf8');

    let finalResult = result;
    let compressed = false;
    let finalSize = originalSize;

    // Compress if enabled
    if (this.config.compressionEnabled) {
      try {
        const compressedResult = await this.compress(result);
        const compressedSize = Buffer.byteLength(JSON.stringify(compressedResult), 'utf8');
        
        // Use compression if it saves at least 20% space
        if (compressedSize < originalSize * 0.8) {
          finalResult = compressedResult;
          compressed = true;
          finalSize = compressedSize;
        }
      } catch (error) {
        // Compression failed, use original
        console.warn('Cache compression failed:', error.message);
      }
    }

    const entry: DiffCacheEntry = {
      key,
      result: finalResult,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size: finalSize,
      compressed,
      metadata: {
        ...metadata,
        version: '1.0.0'
      }
    };

    // Check if we need to evict entries
    while (this.shouldEvict()) {
      this.evictEntry();
    }

    this.cache.set(key, entry);
    this.stats.totalSize += finalSize;
    this.stats.uncompressedSize += originalSize;
  }

  /**
   * Check if a key exists in cache
   */
  public has(key: string): boolean {
    if (!this.config.enabled) return false;
    
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a cache entry
   */
  public delete(key: string): boolean {
    if (!this.config.enabled) return false;

    const entry = this.cache.get(key);
    if (entry) {
      this.stats.totalSize -= entry.size;
      this.stats.uncompressedSize -= this.estimateUncompressedSize(entry);
    }

    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.uncompressedSize = 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): DiffCacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      totalEntries: this.cache.size,
      totalSize: this.stats.totalSize,
      hitRate: this.stats.totalRequests > 0 ? this.stats.hits / this.stats.totalRequests : 0,
      missRate: this.stats.totalRequests > 0 ? this.stats.misses / this.stats.totalRequests : 0,
      evictionCount: this.stats.evictions,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      compressionRatio: this.stats.uncompressedSize > 0 ? this.stats.totalSize / this.stats.uncompressedSize : 1,
      averageAccessCount: entries.length > 0 ? 
        entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length : 0
    };
  }

  /**
   * Remove expired entries
   */
  public cleanup(): void {
    if (!this.config.enabled || this.config.ttl <= 0) return;

    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.config.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));

    if (expiredKeys.length > 0) {
      console.debug(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Generate a cache key from parameters
   */
  public generateKey(params: DiffCacheKeyParams): string {
    const hash = createHash('sha256');
    
    // Create a deterministic string from parameters
    const keyData = {
      type: params.type,
      content1: params.content1 ? createHash('md5').update(params.content1).digest('hex') : undefined,
      content2: params.content2 ? createHash('md5').update(params.content2).digest('hex') : undefined,
      file1: params.file1,
      file2: params.file2,
      options: params.options ? JSON.stringify(params.options) : undefined
    };

    hash.update(JSON.stringify(keyData));
    return hash.digest('hex');
  }

  // Private methods

  private shouldEvict(): boolean {
    return this.cache.size >= this.config.maxSize;
  }

  private evictEntry(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string;
    const entries = Array.from(this.cache.entries());

    switch (this.config.strategy) {
      case 'lru':
        // Evict least recently used
        const lruEntry = entries.reduce((oldest, [key, entry]) => 
          entry.lastAccessed < oldest[1].lastAccessed ? [key, entry] : oldest
        );
        keyToEvict = lruEntry[0];
        break;

      case 'lfu':
        // Evict least frequently used
        const lfuEntry = entries.reduce((lowest, [key, entry]) => 
          entry.accessCount < lowest[1].accessCount ? [key, entry] : lowest
        );
        keyToEvict = lfuEntry[0];
        break;

      case 'fifo':
      default:
        // Evict first in (oldest by timestamp)
        const fifoEntry = entries.reduce((oldest, [key, entry]) => 
          entry.timestamp < oldest[1].timestamp ? [key, entry] : oldest
        );
        keyToEvict = fifoEntry[0];
        break;
    }

    this.cache.delete(keyToEvict);
    this.stats.evictions++;
  }

  private async compress(result: StyleDiffResult): Promise<StyleDiffResult> {
    const serialized = JSON.stringify(result);
    const compressed = await gzip(Buffer.from(serialized, 'utf8'));
    
    return {
      ...result,
      _compressed: compressed.toString('base64'),
      _isCompressed: true
    } as any;
  }

  private async decompress(compressedResult: StyleDiffResult): Promise<StyleDiffResult> {
    const compressed = (compressedResult as any)._compressed;
    if (!compressed) return compressedResult;

    const buffer = Buffer.from(compressed, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString('utf8'));
  }

  private estimateUncompressedSize(entry: DiffCacheEntry): number {
    if (!entry.compressed) return entry.size;
    
    // Estimate based on average compression ratio
    const stats = this.getStats();
    return entry.size / (stats.compressionRatio || 0.5);
  }
}
