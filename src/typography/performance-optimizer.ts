
import { TypographyEntry, TypographyCache, ExtractionOptions } from './types';
import { ASTNode, RootNode, RuleNode, BlockNode, DeclarationNode, CommentNode } from '../parser/ast-nodes';

/**
 * Performance optimizer for typography extraction
 */
export class PerformanceOptimizer {
  private cache: TypographyCache;
  private performanceMetrics: PerformanceMetrics;
  constructor(cache: TypographyCache) {
    this.cache = cache;
    this.performanceMetrics = new PerformanceMetrics();
  }

  /**
   * Clone an AST node properly with correct types
   */
  private cloneASTNode(node: ASTNode): ASTNode {
    // Create a new node of the same type
    switch (node.type) {
      case 'root':
        return new RootNode(node.location);
      case 'rule':
        const ruleNode = node as any; // Type assertion needed due to interface limitations
        return new RuleNode(ruleNode.selector || '', node.location);
      case 'block':
        return new BlockNode(node.location);
      case 'declaration':
        const declNode = node as any;
        return new DeclarationNode(
          declNode.property || '',
          declNode.value || '',
          declNode.important || false,
          node.location
        );
      case 'comment':
        const commentNode = node as any;
        return new CommentNode(
          commentNode.text || '',
          commentNode.inline || false,
          node.location
        );
      default:
        // For other node types, create a basic RootNode as fallback
        return new RootNode(node.location);
    }
  }

  /**
   * Optimize AST for faster processing
   */
  optimizeAST(ast: ASTNode): ASTNode {
    const startTime = performance.now();
    
    const optimized = this.performASTOptimizations(ast);
    
    this.performanceMetrics.recordOptimization(performance.now() - startTime);
    return optimized;
  }

  /**
   * Create cache key for AST and options
   */
  createCacheKey(ast: ASTNode, filePath: string, options?: Partial<ExtractionOptions>): string {
    const astHash = this.hashAST(ast);
    const optionsHash = this.hashOptions(options);
    return `${filePath}:${astHash}:${optionsHash}`;
  }

  /**
   * Get cached result if available
   */
  getCachedResult(cacheKey: string): TypographyEntry[] | null {
    return this.cache.selectorCache.get(cacheKey) || null;
  }

  /**
   * Cache extraction result
   */
  cacheResult(cacheKey: string, entries: TypographyEntry[]): void {
    // Implement LRU eviction if cache is full
    if (this.cache.selectorCache.size >= 1000) {
      this.evictLRUEntries();
    }

    this.cache.selectorCache.set(cacheKey, entries);
  }  /**
   * Pre-process AST for common optimizations
   */
  preprocessAST(ast: ASTNode): ASTNode {
    // For now, return the original AST to avoid circular dependency issues
    // TODO: Implement proper preprocessing once all methods are in place
    return this.performASTOptimizations(ast);
  }

  /**
   * Batch process multiple ASTs efficiently
   */
  batchProcess<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    concurrency: number = 5
  ): Promise<any[]> {
    return this.processWithConcurrencyLimit(items, processor, concurrency);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceReport {
    return this.performanceMetrics.getReport();
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics.reset();
  }

  private performASTOptimizations(ast: ASTNode): ASTNode {
    // Remove unnecessary nodes
    const pruned = this.pruneUnnecessaryNodes(ast);
    
    // Flatten nested structures where possible
    const flattened = this.flattenNestedStructures(pruned);
    
    // Sort children for better cache locality
    const sorted = this.sortChildrenForPerformance(flattened);
    
    return sorted;
  }
  private pruneUnnecessaryNodes(ast: ASTNode): ASTNode {
    if (!ast.children) {
      return ast;
    }

    // Filter out comment nodes and empty rules
    const filteredChildren = ast.children.filter(child => {
      if (child.type === 'COMMENT') return false;
      if (child.type === 'RULE' && (!child.children || child.children.length === 0)) return false;
      return true;
    });

    // Create a cloned node with filtered children
    const cloned = this.cloneASTNode(ast);
    
    // Clear existing children
    while (cloned.children && cloned.children.length > 0) {
      cloned.removeChild(cloned.children[0]);
    }
    
    // Add filtered and recursively processed children
    filteredChildren.forEach(child => {
      const processedChild = this.pruneUnnecessaryNodes(child);
      cloned.addChild(processedChild);
    });
    
    return cloned;
  }
  private flattenNestedStructures(ast: ASTNode): ASTNode {
    if (!ast.children) {
      return ast;
    }

    const flattened = [];
    for (const child of ast.children) {
      if (this.canFlatten(child)) {
        flattened.push(...(child.children || []));
      } else {
        flattened.push(this.flattenNestedStructures(child));
      }
    }

    // Create a cloned node with flattened children
    const cloned = this.cloneASTNode(ast);
    
    // Clear existing children
    while (cloned.children && cloned.children.length > 0) {
      cloned.removeChild(cloned.children[0]);
    }
    
    // Add flattened children
    flattened.forEach(child => {
      cloned.addChild(child);
    });
    
    return cloned;
  }
  private sortChildrenForPerformance(ast: ASTNode): ASTNode {
    if (!ast.children) {
      return ast;
    }

    // Sort by type for better processing order
    const sorted = [...ast.children].sort((a, b) => {
      const typeOrder = {
        'VARIABLE_DECLARATION': 0,
        'MIXIN_DECLARATION': 1,
        'FUNCTION_DECLARATION': 2,
        'AT_RULE': 3,
        'RULE': 4
      };

      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 999;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 999;
      
      return aOrder - bOrder;
    });

    // Create a cloned node with sorted children
    const cloned = this.cloneASTNode(ast);
    
    // Clear existing children
    while (cloned.children && cloned.children.length > 0) {
      cloned.removeChild(cloned.children[0]);
    }
    
    // Add sorted and recursively processed children
    sorted.forEach(child => {
      const processedChild = this.sortChildrenForPerformance(child);
      cloned.addChild(processedChild);
    });
    
    return cloned;
  }

  private canFlatten(node: ASTNode): boolean {
    // Can flatten certain nested structures that don't affect semantics
    return node.type === 'NESTED_RULE' && 
           node.children?.every(child => child.type === 'DECLARATION');
  }

  private preprocessASTNode(node: ASTNode): ASTNode {
    // Normalize node structure
    const normalized = this.normalizeNode(node);
    
    // Extract common patterns
    const optimized = this.extractCommonPatterns(normalized);
    
    return optimized;
  }
  private normalizeNode(node: ASTNode): ASTNode {
    // For now, just return the node as-is since we can't safely modify
    // properties that may not exist on the base SCSSNode type
    // TODO: Implement proper normalization based on specific node types
    return node;
  }
  private extractCommonPatterns(node: ASTNode): ASTNode {
    // For now, just return the node as-is since we can't safely access
    // properties that may not exist on the base SCSSNode type
    // TODO: Implement proper pattern extraction based on specific node types
    return node;
  }

  private isTypographyProperty(property?: string): boolean {
    if (!property) return false;
    
    const typographyProperties = [
      'font-family', 'font-size', 'font-weight', 'font-style',
      'line-height', 'letter-spacing', 'word-spacing', 'text-align',
      'text-decoration', 'text-transform', 'font-variant'
    ];

    return typographyProperties.includes(property) || 
           property.startsWith('font-') || 
           property.startsWith('text-');
  }

  private hashAST(ast: ASTNode): string {
    // Create a hash of the AST structure for caching
    const str = this.astToString(ast);
    return this.simpleHash(str);
  }

  private hashOptions(options?: Partial<ExtractionOptions>): string {
    if (!options) return 'default';
    return this.simpleHash(JSON.stringify(options));
  }
  private astToString(ast: ASTNode): string {
    const parts = [ast.type];
    
    // Only access properties that exist on specific node types through type assertions
    if (ast.type === 'declaration') {
      const declNode = ast as any;
      if (declNode.property) parts.push(declNode.property);
      if (declNode.value) parts.push(declNode.value);
    } else if (ast.type === 'rule') {
      const ruleNode = ast as any;
      if (ruleNode.selector) parts.push(ruleNode.selector);
    }
    
    if (ast.children) {
      parts.push(ast.children.map(child => this.astToString(child)).join('|'));
    }

    return parts.join(':');
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private evictLRUEntries(): void {
    // Simple LRU eviction - remove oldest 10% of entries
    const entries = Array.from(this.cache.selectorCache.entries());
    const evictCount = Math.floor(entries.length * 0.1);
    
    for (let i = 0; i < evictCount; i++) {
      this.cache.selectorCache.delete(entries[i][0]);
    }
  }

  private async processWithConcurrencyLimit<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    limit: number
  ): Promise<any[]> {
    const results: any[] = [];
    const executing: Promise<any>[] = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }
}

/**
 * Performance metrics collector
 */
class PerformanceMetrics {
  private metrics: {
    totalExtractions: number;
    totalTime: number;
    averageTime: number;
    cacheHits: number;
    cacheMisses: number;
    optimizationTime: number;
    memoryUsage: number[];
  };

  constructor() {
    this.metrics = {
      totalExtractions: 0,
      totalTime: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      optimizationTime: 0,
      memoryUsage: []
    };
  }

  recordExtraction(timeMs: number): void {
    this.metrics.totalExtractions++;
    this.metrics.totalTime += timeMs;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalExtractions;
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordOptimization(timeMs: number): void {
    this.metrics.optimizationTime += timeMs;
  }

  recordMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage.push(usage.heapUsed / (1024 * 1024));
      
      // Keep only last 100 measurements
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
      }
    }
  }

  getReport(): PerformanceReport {
    const cacheHitRate = this.metrics.cacheHits / 
      (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;

    const avgMemoryUsage = this.metrics.memoryUsage.length > 0 ?
      this.metrics.memoryUsage.reduce((a, b) => a + b, 0) / this.metrics.memoryUsage.length : 0;

    return {
      totalExtractions: this.metrics.totalExtractions,
      averageExtractionTime: this.metrics.averageTime,
      totalTime: this.metrics.totalTime,
      cacheHitRate,
      optimizationTime: this.metrics.optimizationTime,
      averageMemoryUsage: avgMemoryUsage,
      peakMemoryUsage: Math.max(...this.metrics.memoryUsage, 0)
    };
  }

  reset(): void {
    this.metrics = {
      totalExtractions: 0,
      totalTime: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      optimizationTime: 0,
      memoryUsage: []
    };
  }
}

/**
 * Performance report interface
 */
export interface PerformanceReport {
  totalExtractions: number;
  averageExtractionTime: number;
  totalTime: number;
  cacheHitRate: number;
  optimizationTime: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
}

/**
 * Worker pool for parallel processing
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    task: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private busyWorkers = new Set<Worker>();

  constructor(private workerCount: number = 4) {
    this.initializeWorkers();
  }

  /**
   * Execute task in worker pool
   */
  async execute<T>(task: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processTasks();
    });
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.busyWorkers.clear();
  }

  private initializeWorkers(): void {
    // Worker implementation would depend on environment
    // Placeholder for now
  }

  private processTasks(): void {
    while (this.taskQueue.length > 0 && this.busyWorkers.size < this.workers.length) {
      const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
      if (!availableWorker) break;

      const task = this.taskQueue.shift();
      if (!task) break;

      this.busyWorkers.add(availableWorker);
      this.executeInWorker(availableWorker, task);
    }
  }  private executeInWorker(worker: Worker, task: any): void {
    // Worker execution implementation
    // Placeholder for now
    setTimeout(() => {
      this.busyWorkers.delete(worker);
      task.resolve(null);
      this.processTasks();
    }, 100);
  }
}
