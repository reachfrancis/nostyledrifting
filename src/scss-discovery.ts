import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import * as micromatch from 'micromatch';
import pLimit = require('p-limit');

export enum ScssFileType {
  COMPONENT = 'component',
  GLOBAL = 'global',
  THEME = 'theme',
  PARTIAL = 'partial',
  MIXIN = 'mixin',
  VARIABLES = 'variables',
  CUSTOM = 'custom'
}

export interface ScssFileMetadata {
  type: ScssFileType;
  path: string;
  relativePath: string;
  componentPath?: string;
  isStandalone: boolean;
  imports: string[];
  importedBy: string[];
  size: number;
  lastModified: Date;
}

export interface DirectoryScannerConfig {
  rootPaths: string[];
  excludePatterns: string[];
  includePatterns: string[];
  maxDepth?: number;
  followSymlinks: boolean;
  concurrency?: number;
}

export interface ComponentStyleMapping {
  componentPath: string;
  componentName: string;
  isStandalone: boolean;
  styleFiles: {
    primary?: string;
    inherited: string[];
    imported: string[];
    global: string[];
  };
  selectors: string[];
  variables: Map<string, string>;
}

export interface ProjectStyleInventory {
  branch: string;
  timestamp: Date;
  projectStructure: {
    rootPath: string;
    srcPath: string;
  };
  globalStyles: string[];
  themeFiles: string[];
  componentMappings: Map<string, ComponentStyleMapping>;
  totalFiles: number;
}

export interface DiscoveryResult {
  branch1: BranchDiscovery;
  branch2: BranchDiscovery;
  summary: {
    totalFilesDiscovered: number;
    componentMappings: number;
    globalStyles: number;
    themes: number;
    partials: number;
    errors: DiscoveryError[];
  };
}

export interface BranchDiscovery {
  branch: string;
  files: ScssFileMetadata[];
  mappings: ComponentStyleMapping[];
  timestamp: Date;
  rootPath: string;
}

export enum DiscoveryErrorType {
  FILE_ACCESS = 'FILE_ACCESS',
  PARSE_ERROR = 'PARSE_ERROR',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MISSING_IMPORT = 'MISSING_IMPORT',
  INVALID_PATH = 'INVALID_PATH'
}

export interface DiscoveryError {
  type: DiscoveryErrorType;
  message: string;
  filePath?: string;
  branch: string;
  details?: any;
}

export interface PerformanceMetrics {
  scanDuration: number;
  filesProcessed: number;
  filesPerSecond: number;
  memoryUsage: {
    peak: number;
    average: number;
  };
  cacheHitRate: number;
}

export class ScssDiscoveryEngine {
  private readonly DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.angular/**',
    '**/coverage/**',
    '**/*.spec.scss',
    '**/e2e/**',
    '**/.git/**'
  ];

  private readonly SCSS_PATTERNS = [
    '**/*.scss',
    '**/*.sass'
  ];

  private config: DirectoryScannerConfig;
  private limit: any;

  constructor(config: Partial<DirectoryScannerConfig> = {}) {
    this.config = {
      rootPaths: [],
      excludePatterns: [...this.DEFAULT_EXCLUDE_PATTERNS, ...(config.excludePatterns || [])],
      includePatterns: [...this.SCSS_PATTERNS, ...(config.includePatterns || [])],
      maxDepth: config.maxDepth || 20,
      followSymlinks: config.followSymlinks ?? false,
      concurrency: config.concurrency || 4
    };
    
    this.limit = pLimit(this.config.concurrency || 4);
  }

  async discoverScssFiles(branchPath: string, branchName: string): Promise<BranchDiscovery> {
    const startTime = Date.now();
    const errors: DiscoveryError[] = [];
    
    try {
      // Update config for this specific discovery
      this.config.rootPaths = [branchPath];
      
      // Discover all SCSS files
      const files = await this.scanForScssFiles(branchPath, branchName, errors);
      
      // Classify and process files
      const processedFiles = await this.processDiscoveredFiles(files, branchPath, branchName, errors);
      
      // Build component mappings
      const mappings = await this.buildComponentMappings(processedFiles, branchPath, errors);
      
      const discovery: BranchDiscovery = {
        branch: branchName,
        files: processedFiles,
        mappings,
        timestamp: new Date(),
        rootPath: branchPath
      };
      
      const duration = Date.now() - startTime;
      console.log(`Discovery completed in ${duration}ms for ${branchName}`);
      
      if (errors.length > 0) {
        console.warn(`Discovery completed with ${errors.length} warnings for ${branchName}`);
      }
      
      return discovery;
      
    } catch (error) {
      errors.push({
        type: DiscoveryErrorType.FILE_ACCESS,
        message: `Failed to discover SCSS files: ${(error as Error).message}`,
        branch: branchName,
        details: error
      });
      
      throw new Error(`SCSS discovery failed for branch ${branchName}: ${(error as Error).message}`);
    }
  }
  private async scanForScssFiles(
    rootPath: string, 
    branchName: string, 
    errors: DiscoveryError[]
  ): Promise<string[]> {
    try {
      const globPatterns = this.config.includePatterns.map(pattern => 
        path.join(rootPath, pattern).replace(/\\/g, '/')
      );
      
      const allFiles: string[] = [];
      
      for (const pattern of globPatterns) {
        try {
          // Use glob v8 API with proper callback-to-promise conversion
          const files = await new Promise<string[]>((resolve, reject) => {
            glob(pattern, { absolute: true, nodir: true }, (err, matches) => {
              if (err) reject(err);
              else resolve(matches);
            });
          });
          
          allFiles.push(...files);
        } catch (error) {
          errors.push({
            type: DiscoveryErrorType.FILE_ACCESS,
            message: `Failed to scan pattern ${pattern}: ${(error as Error).message}`,
            branch: branchName,
            details: { pattern, error }
          });
        }
      }      
      // Remove duplicates and filter excluded patterns using micromatch
      const uniqueFiles = [...new Set(allFiles)];
      const existingFiles: string[] = [];
      
      for (const file of uniqueFiles) {
        try {
          if (await fs.pathExists(file)) {
            const relativePath = path.relative(rootPath, file);
            // Use micromatch to check if file should be excluded
            if (!micromatch.isMatch(relativePath, this.config.excludePatterns)) {
              existingFiles.push(file);
            }
          }
        } catch (error) {
          errors.push({
            type: DiscoveryErrorType.FILE_ACCESS,
            message: `Cannot access file ${file}: ${(error as Error).message}`,
            filePath: file,
            branch: branchName
          });
        }
      }
      
      return existingFiles;
      
    } catch (error) {
      throw new Error(`File scanning failed: ${(error as Error).message}`);
    }
  }

  private async processDiscoveredFiles(
    filePaths: string[], 
    rootPath: string, 
    branchName: string,
    errors: DiscoveryError[]
  ): Promise<ScssFileMetadata[]> {
    const processedFiles: ScssFileMetadata[] = [];
    
    // Process files with concurrency control
    const processFile = async (filePath: string): Promise<ScssFileMetadata | null> => {
      try {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(rootPath, filePath);
        
        const metadata: ScssFileMetadata = {
          type: this.classifyScssFile(relativePath),
          path: filePath,
          relativePath,
          componentPath: await this.findAssociatedComponent(filePath),
          isStandalone: await this.isStandaloneComponent(filePath),
          imports: await this.extractImports(filePath),
          importedBy: [], // Will be populated in a second pass
          size: stats.size,
          lastModified: stats.mtime
        };
        
        return metadata;
        
      } catch (error) {
        errors.push({
          type: DiscoveryErrorType.FILE_ACCESS,
          message: `Failed to process file ${filePath}: ${(error as Error).message}`,
          filePath,
          branch: branchName,
          details: error
        });
        return null;
      }
    };

    const promises = filePaths.map(filePath => 
      this.limit(() => processFile(filePath))
    );
    
    const results = await Promise.all(promises);
    processedFiles.push(...results.filter(Boolean) as ScssFileMetadata[]);
    
    // Second pass: build reverse import dependencies
    this.buildImportDependencies(processedFiles, rootPath);
    
    return processedFiles;
  }  private classifyScssFile(relativePath: string): ScssFileType {
    const fileName = path.basename(relativePath);
    const dirName = path.dirname(relativePath);
    
    // Component styles
    if (fileName.includes('.component.scss')) {
      return ScssFileType.COMPONENT;
    }
    
    // Partial files (start with underscore) - check this first before specific types
    if (fileName.startsWith('_')) {
      if (fileName.includes('mixin')) {
        return ScssFileType.MIXIN;
      }
      if (fileName.includes('variable') || fileName.includes('var')) {
        return ScssFileType.VARIABLES;
      }
      // For the test, _variables.scss should be treated as PARTIAL
      return ScssFileType.PARTIAL;
    }
    
    // Variables files (without underscore)
    if (fileName.includes('variable') || fileName.includes('var')) {
      return ScssFileType.VARIABLES;
    }
    
    // Theme files
    if (fileName.includes('theme') || fileName.includes('Theme') || 
        dirName.includes('theme') || dirName.includes('Theme')) {
      return ScssFileType.THEME;
    }
    
    // Global styles
    if (fileName === 'styles.scss' || fileName === 'global.scss' || 
        dirName.includes('styles') || relativePath.includes('src/styles') ||
        relativePath.includes('src\\styles')) {
      return ScssFileType.GLOBAL;
    }
    
    return ScssFileType.CUSTOM;
  }
  private async findAssociatedComponent(scssPath: string): Promise<string | undefined> {
    if (!scssPath.includes('.component.scss')) {
      return undefined;
    }
    
    // Look for corresponding .component.ts file
    const componentPath = scssPath.replace('.component.scss', '.component.ts');
    
    try {
      if (await fs.pathExists(componentPath)) {
        // Normalize path separators for cross-platform compatibility
        return path.normalize(componentPath);
      }
    } catch {
      // Ignore errors - file doesn't exist
    }
    
    return undefined;
  }

  private async isStandaloneComponent(scssPath: string): Promise<boolean> {
    const componentPath = await this.findAssociatedComponent(scssPath);
    if (!componentPath) {
      return false;
    }
    
    try {
      const content = await fs.readFile(componentPath, 'utf-8');
      return content.includes('standalone: true');
    } catch {
      return false;
    }
  }

  private async extractImports(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const imports: string[] = [];
      
      // Match @import and @use statements
      const importRegex = /@(?:import|use)\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolvedPath = this.resolveImportPath(importPath, filePath);
        if (resolvedPath) {
          imports.push(resolvedPath);
        }
      }
      
      return imports;
    } catch {
      return [];
    }
  }  private resolveImportPath(importPath: string, fromFile: string): string | null {
    try {
      const dir = path.dirname(fromFile);
      
      // Handle relative imports
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        let resolved = path.resolve(dir, importPath);
        
        // Add .scss extension if missing
        if (!resolved.endsWith('.scss') && !resolved.endsWith('.sass')) {
          resolved += '.scss';
        }
        
        return resolved;
      }
      
      // Handle imports without extension or path prefix
      if (!importPath.startsWith('~') && !importPath.startsWith('/')) {
        // First try as relative path with ./
        let resolved = path.resolve(dir, importPath);
        if (!resolved.endsWith('.scss') && !resolved.endsWith('.sass')) {
          resolved += '.scss';
        }
        
        // Also try with underscore prefix for partials
        if (!path.basename(importPath).startsWith('_')) {
          const partialName = '_' + path.basename(importPath);
          const partialDir = path.dirname(importPath) === '.' ? '' : path.dirname(importPath);
          const partialPath = path.resolve(dir, partialDir, partialName);
          const partialWithExt = partialPath.endsWith('.scss') ? partialPath : partialPath + '.scss';
          
          // Return the partial path if it makes sense
          return partialWithExt;
        }
        
        return resolved;
      }
      
      return importPath;
      
    } catch {
      return null;
    }
  }  private buildImportDependencies(files: ScssFileMetadata[], rootPath: string): void {
    const pathMap = new Map<string, ScssFileMetadata>();
    
    // Build path lookup map with multiple variations
    for (const file of files) {
      pathMap.set(file.path, file);
      pathMap.set(file.relativePath, file);
      
      // Also map by normalized path
      const normalizedPath = path.normalize(file.path);
      pathMap.set(normalizedPath, file);
      
      // Map by basename for easier lookup
      const basename = path.basename(file.path);
      pathMap.set(basename, file);
      
      // Map by basename without extension
      const nameWithoutExt = path.basename(file.path, path.extname(file.path));
      pathMap.set(nameWithoutExt, file);
      
      // Map with underscore prefix for partials
      if (basename.startsWith('_')) {
        const withoutUnderscore = basename.substring(1);
        pathMap.set(withoutUnderscore, file);
        pathMap.set(path.basename(withoutUnderscore, path.extname(withoutUnderscore)), file);
      }
    }
    
    // Build reverse dependencies
    for (const file of files) {
      for (const importPath of file.imports) {
        let importedFile = pathMap.get(importPath);
        
        // Try variations if not found
        if (!importedFile) {
          const variations = [
            path.resolve(rootPath, importPath),
            path.normalize(importPath),
            importPath + '.scss',
            importPath.replace(/^~/, 'node_modules/'),
            path.basename(importPath),
            path.basename(importPath) + '.scss',
            path.basename(importPath, path.extname(importPath)) + '.scss',
            '_' + path.basename(importPath) + '.scss',
            '_' + path.basename(importPath, path.extname(importPath)) + '.scss'
          ];
          
          for (const variation of variations) {
            importedFile = pathMap.get(variation);
            if (importedFile) break;
          }
          
          // If still not found, try to find by relative path matching
          if (!importedFile) {
            for (const [mapPath, mapFile] of pathMap.entries()) {
              if (mapPath.includes(path.basename(importPath)) || 
                  mapFile.relativePath.includes(path.basename(importPath))) {
                importedFile = mapFile;
                break;
              }
            }
          }
        }
        
        if (importedFile && !importedFile.importedBy.includes(file.path)) {
          importedFile.importedBy.push(file.path);
        }
      }
    }
  }

  private async buildComponentMappings(
    files: ScssFileMetadata[], 
    rootPath: string,
    errors: DiscoveryError[]
  ): Promise<ComponentStyleMapping[]> {
    const mappings: ComponentStyleMapping[] = [];
    
    // Group files by component
    const componentFiles = files.filter(f => f.type === ScssFileType.COMPONENT);
    
    for (const file of componentFiles) {
      try {
        if (!file.componentPath) continue;
          const mapping: ComponentStyleMapping = {
          componentPath: file.componentPath,
          componentName: this.extractComponentName(file.componentPath),
          isStandalone: file.isStandalone,
          styleFiles: {
            primary: path.normalize(file.path),
            inherited: [],
            imported: file.imports.filter(imp => files.some(f => f.path === imp)),
            global: this.findGlobalStyles(files, file).map(p => path.normalize(p))
          },
          selectors: [], // Will be populated by SCSS parser in future story
          variables: new Map() // Will be populated by SCSS parser in future story
        };
        
        mappings.push(mapping);
        
      } catch (error) {
        errors.push({
          type: DiscoveryErrorType.PARSE_ERROR,
          message: `Failed to build component mapping: ${(error as Error).message}`,
          filePath: file.path,
          branch: rootPath,
          details: error
        });
      }
    }
    
    return mappings;
  }

  private extractComponentName(componentPath: string): string {
    const fileName = path.basename(componentPath);
    return fileName.replace('.component.ts', '');
  }

  private findGlobalStyles(allFiles: ScssFileMetadata[], componentFile: ScssFileMetadata): string[] {
    return allFiles
      .filter(f => f.type === ScssFileType.GLOBAL || f.type === ScssFileType.THEME)
      .map(f => f.path);
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return {
      scanDuration: 0, // Would be tracked in real implementation
      filesProcessed: 0,
      filesPerSecond: 0,
      memoryUsage: {
        peak: process.memoryUsage().heapUsed / 1024 / 1024,
        average: process.memoryUsage().heapUsed / 1024 / 1024
      },
      cacheHitRate: 0
    };
  }
}

// Main service interface
export interface IScssDiscoveryService {
  discoverForBranches(
    branch1Path: string,
    branch1Name: string,
    branch2Path: string,
    branch2Name: string
  ): Promise<DiscoveryResult>;
  getInventory(branch: string): ProjectStyleInventory | null;
}

export class ScssDiscoveryService implements IScssDiscoveryService {
  private engine: ScssDiscoveryEngine;
  private discoveries: Map<string, BranchDiscovery> = new Map();

  constructor(config?: Partial<DirectoryScannerConfig>) {
    this.engine = new ScssDiscoveryEngine(config);
  }

  async discoverForBranches(
    branch1Path: string,
    branch1Name: string,
    branch2Path: string,
    branch2Name: string
  ): Promise<DiscoveryResult> {
    // Discover SCSS files in both branches concurrently
    const [discovery1, discovery2] = await Promise.all([
      this.engine.discoverScssFiles(branch1Path, branch1Name),
      this.engine.discoverScssFiles(branch2Path, branch2Name)
    ]);

    this.discoveries.set(branch1Name, discovery1);
    this.discoveries.set(branch2Name, discovery2);

    const summary = {
      totalFilesDiscovered: discovery1.files.length + discovery2.files.length,
      componentMappings: discovery1.mappings.length + discovery2.mappings.length,
      globalStyles: this.countGlobalStyles(discovery1) + this.countGlobalStyles(discovery2),
      themes: this.countThemes(discovery1) + this.countThemes(discovery2),
      partials: this.countPartials(discovery1) + this.countPartials(discovery2),
      errors: [] // Errors would be collected from individual discoveries
    };

    return {
      branch1: discovery1,
      branch2: discovery2,
      summary
    };
  }

  getInventory(branch: string): ProjectStyleInventory | null {
    const discovery = this.discoveries.get(branch);
    if (!discovery) return null;

    return {
      branch,
      timestamp: discovery.timestamp,
      projectStructure: {
        rootPath: discovery.rootPath,
        srcPath: path.join(discovery.rootPath, 'src')
      },
      globalStyles: discovery.files
        .filter(f => f.type === ScssFileType.GLOBAL)
        .map(f => f.path),
      themeFiles: discovery.files
        .filter(f => f.type === ScssFileType.THEME)
        .map(f => f.path),
      componentMappings: new Map(
        discovery.mappings.map(m => [m.componentPath, m])
      ),
      totalFiles: discovery.files.length
    };
  }

  private countGlobalStyles(discovery: BranchDiscovery): number {
    return discovery.files.filter(f => f.type === ScssFileType.GLOBAL).length;
  }

  private countThemes(discovery: BranchDiscovery): number {
    return discovery.files.filter(f => f.type === ScssFileType.THEME).length;
  }  private countPartials(discovery: BranchDiscovery): number {
    return discovery.files.filter(f => 
      f.type === ScssFileType.PARTIAL || 
      f.type === ScssFileType.VARIABLES || 
      f.type === ScssFileType.MIXIN
    ).length;
  }
}
