import { DiffAnalyzer } from './diff-analyzer';
import { ContextAwareDiffAnalyzer } from './context-aware-diff-analyzer';
import { DiffRenderer } from './diff-renderer';
import { DiffCache } from './engine-cache';
import { PerformanceTracker } from './performance-tracker';
import { EngineValidator } from './engine-validator';
import { EngineErrorRecovery } from './engine-error-recovery';
import { EngineConfigManager } from './engine-config';
import { 
  StyleDiffOptions, 
  StyleDiffResult, 
  DiffAnalysisMode, 
  DiffRenderFormat,
  DiffContext,
  EnginePerformanceMetrics,
  DiffComparison,
  DiffCacheStats,
  DiffValidationResult
} from './types';
import { DiffEngineError } from './errors';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Main Style Diff Engine that orchestrates all diff analysis and rendering components
 */
export class StyleDiffEngine {
  private diffAnalyzer: DiffAnalyzer;
  private contextAnalyzer: ContextAwareDiffAnalyzer;
  private renderer: DiffRenderer;
  private cache: DiffCache;
  private performanceTracker: PerformanceTracker;
  private validator: EngineValidator;
  private errorRecovery: EngineErrorRecovery;
  private configManager: EngineConfigManager;

  constructor(options?: Partial<StyleDiffOptions>) {
    this.configManager = new EngineConfigManager(options);
    const config = this.configManager.getConfig();

    // Initialize core components
    this.diffAnalyzer = new DiffAnalyzer(config.analysis);
    this.contextAnalyzer = new ContextAwareDiffAnalyzer(config.analysis);
    this.renderer = new DiffRenderer(config.output);
    this.cache = new DiffCache(config.cache);
    this.performanceTracker = new PerformanceTracker();
    this.validator = new EngineValidator();
    this.errorRecovery = new EngineErrorRecovery();

    this.setupErrorRecoveryStrategies();
  }

  /**
   * Compare two SCSS files and return semantic differences
   */
  public async compareFiles(
    file1: string, 
    file2: string, 
    options?: Partial<StyleDiffOptions>
  ): Promise<StyleDiffResult> {
    const operationId = `compareFiles_${Date.now()}`;
    this.performanceTracker.startOperation(operationId);

    try {
      // Validate inputs
      const validation = await this.validator.validateFiles(file1, file2);
      if (!validation.isValid) {
        throw new DiffEngineError(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey('files', { file1, file2, options });
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.performanceTracker.recordCacheHit();
        return cached;
      }
      this.performanceTracker.recordCacheMiss();

      // Read file contents
      const [content1, content2] = await Promise.all([
        fs.readFile(file1, 'utf-8'),
        fs.readFile(file2, 'utf-8')
      ]);

      // Perform comparison
      const result = await this.compareContent(content1, content2, {
        ...options,
        filePath1: file1,
        filePath2: file2
      });

      // Cache the result
      this.cache.set(cacheKey, result, {
        fileHashes: [
          await this.getFileHash(file1),
          await this.getFileHash(file2)
        ],
        options,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.performanceTracker.recordError();
      return await this.errorRecovery.executeWithRecovery(
        () => this.compareFiles(file1, file2, options),
        { file1, file2, options }
      );
    } finally {
      this.performanceTracker.endOperation(operationId);
      this.performanceTracker.recordMemoryUsage();
    }
  }

  /**
   * Compare two SCSS content strings and return semantic differences
   */
  public async compareContent(
    content1: string, 
    content2: string, 
    options?: Partial<StyleDiffOptions>
  ): Promise<StyleDiffResult> {
    const operationId = `compareContent_${Date.now()}`;
    this.performanceTracker.startOperation(operationId);

    try {
      // Validate content
      const validation = await this.validator.validateContent(content1, content2);
      if (!validation.isValid) {
        throw new DiffEngineError(`Content validation failed: ${validation.errors.join(', ')}`);
      }

      // Check cache
      const cacheKey = this.generateCacheKey('content', { content1, content2, options });
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.performanceTracker.recordCacheHit();
        return cached;
      }
      this.performanceTracker.recordCacheMiss();

      // Merge options with defaults
      const mergedOptions = this.mergeOptions(options);

      // Perform text-level diff analysis
      const textDiff = await this.diffAnalyzer.analyze(content1, content2, mergedOptions);

      // Perform context-aware semantic analysis
      const semanticDiff = await this.contextAnalyzer.analyze(content1, content2, mergedOptions);

      // Combine results
      const result: StyleDiffResult = {
        ...textDiff,
        semanticChanges: semanticDiff.semanticChanges,
        variableChanges: semanticDiff.variableChanges,
        contextualImpact: semanticDiff.contextualImpact,
        metadata: {
          ...textDiff.metadata,
          analysisMode: mergedOptions.analysisMode,
          processingTime: Date.now() - this.performanceTracker.getStartTime(operationId),
          cacheUsed: false,
          engineVersion: '1.0.0'
        }
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;

    } catch (error) {
      this.performanceTracker.recordError();
      return await this.errorRecovery.executeWithRecovery(
        () => this.compareContent(content1, content2, options),
        { content1, content2, options }
      );
    } finally {
      this.performanceTracker.endOperation(operationId);
      this.performanceTracker.recordMemoryUsage();
    }
  }

  /**
   * Compare multiple files across branches
   */
  public async compareBranches(
    branch1: string, 
    branch2: string, 
    filePaths: string[], 
    options?: Partial<StyleDiffOptions>
  ): Promise<StyleDiffResult[]> {
    const operationId = `compareBranches_${Date.now()}`;
    this.performanceTracker.startOperation(operationId);

    try {
      const config = this.configManager.getConfig();
      const concurrency = config.performance.concurrency;
      
      // Create comparison tasks
      const comparisons: DiffComparison[] = filePaths.map(filePath => ({
        type: 'branch-files',
        branch1,
        branch2,
        filePath,
        options
      }));

      // Execute batch comparison
      const results = await this.batchCompare(comparisons, options);
      
      return results;

    } catch (error) {
      this.performanceTracker.recordError();
      throw new DiffEngineError(`Branch comparison failed: ${error.message}`, error);
    } finally {
      this.performanceTracker.endOperation(operationId);
    }
  }

  /**
   * Perform batch comparison of multiple file pairs
   */
  public async batchCompare(
    comparisons: DiffComparison[], 
    options?: Partial<StyleDiffOptions>
  ): Promise<StyleDiffResult[]> {
    const operationId = `batchCompare_${Date.now()}`;
    this.performanceTracker.startOperation(operationId);

    try {
      // Validate batch operation
      const validation = this.validator.validateBatchOperation(comparisons);
      if (!validation.isValid) {
        throw new DiffEngineError(`Batch validation failed: ${validation.errors.join(', ')}`);
      }

      const config = this.configManager.getConfig();
      const results: StyleDiffResult[] = [];

      // Process in chunks to manage memory and concurrency
      const chunkSize = config.performance.concurrency;
      for (let i = 0; i < comparisons.length; i += chunkSize) {
        const chunk = comparisons.slice(i, i + chunkSize);
        
        const chunkResults = await Promise.all(
          chunk.map(async (comparison) => {
            switch (comparison.type) {
              case 'files':
                return this.compareFiles(comparison.file1!, comparison.file2!, comparison.options);
              case 'content':
                return this.compareContent(comparison.content1!, comparison.content2!, comparison.options);
              case 'branch-files':
                // Handle branch-based file comparison
                return this.compareBranchFiles(comparison);
              default:
                throw new DiffEngineError(`Unknown comparison type: ${(comparison as any).type}`);
            }
          })
        );

        results.push(...chunkResults);
      }

      return results;

    } catch (error) {
      this.performanceTracker.recordError();
      throw new DiffEngineError(`Batch comparison failed: ${error.message}`, error);
    } finally {
      this.performanceTracker.endOperation(operationId);
    }
  }

  /**
   * Render a diff result in the specified format
   */
  public async render(
    result: StyleDiffResult, 
    format: DiffRenderFormat, 
    options?: any
  ): Promise<string> {
    const operationId = `render_${Date.now()}`;
    this.performanceTracker.startOperation(operationId);

    try {
      const rendered = await this.renderer.render(result, format, options);
      return rendered.content;
    } catch (error) {
      this.performanceTracker.recordError();
      throw new DiffEngineError(`Rendering failed: ${error.message}`, error);
    } finally {
      this.performanceTracker.endOperation(operationId);
    }
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): DiffCacheStats {
    return this.cache.getStats();
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): EnginePerformanceMetrics {
    return this.performanceTracker.getMetrics();
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.performanceTracker.reset();
  }

  /**
   * Update engine configuration
   */
  public updateConfig(updates: Partial<StyleDiffOptions>): void {
    this.configManager.updateConfig(updates);
    // Reconfigure components as needed
    this.reconfigureComponents();
  }

  /**
   * Get current configuration
   */
  public getConfig(): any {
    return this.configManager.getConfig();
  }

  // Private helper methods

  private async compareBranchFiles(comparison: DiffComparison): Promise<StyleDiffResult> {
    // This would integrate with Git operations to get file contents from different branches
    // For now, we'll throw an error indicating this needs Git integration
    throw new DiffEngineError('Branch file comparison requires Git integration');
  }

  private mergeOptions(options?: Partial<StyleDiffOptions>): StyleDiffOptions {
    const defaultOptions = this.configManager.getConfig().analysis;
    return {
      ...defaultOptions,
      ...options
    } as StyleDiffOptions;
  }

  private generateCacheKey(type: string, params: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ type, ...params }));
    return hash.digest('hex');
  }

  private async getFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  private setupErrorRecoveryStrategies(): void {
    // Add built-in recovery strategies
    this.errorRecovery.addStrategy({
      name: 'file-access-retry',
      condition: (error) => error.message.includes('ENOENT') || error.message.includes('EACCES'),
      action: async (error, context) => {
        // Wait and retry file access
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      },
      maxRetries: 3,
      backoffMs: 1000
    });

    this.errorRecovery.addStrategy({
      name: 'memory-cleanup',
      condition: (error) => error.message.includes('memory') || error.message.includes('heap'),
      action: async (error, context) => {
        // Force garbage collection and clear caches
        this.clearCache();
        if (global.gc) {
          global.gc();
        }
        return true;
      },
      maxRetries: 1,
      backoffMs: 0
    });

    this.errorRecovery.addStrategy({
      name: 'parsing-fallback',
      condition: (error) => error.message.includes('parse') || error.message.includes('syntax'),
      action: async (error, context) => {
        // Try with more permissive parsing options
        if (context.options) {
          context.options.strict = false;
          context.options.ignoreErrors = true;
        }
        return true;
      },
      maxRetries: 1,
      backoffMs: 0
    });
  }

  private reconfigureComponents(): void {
    const config = this.configManager.getConfig();
    
    // Reconfigure components with new settings
    // This would update the individual components based on new configuration
    // For now, we'll just validate the new configuration
    const validation = this.configManager.validateConfig();
    if (!validation.isValid) {
      throw new DiffEngineError(`Configuration update failed: ${validation.errors.join(', ')}`);
    }
  }
}
