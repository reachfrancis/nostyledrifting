export interface EnginePerformanceMetrics {
  totalComparisons: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  operationBreakdown: {
    parsing: number;
    analysis: number;
    rendering: number;
    caching: number;
    validation: number;
  };
  errorRate: number;
  throughput: number; // comparisons per second
  concurrency: {
    averageConcurrent: number;
    peakConcurrent: number;
    totalOperations: number;
  };
  timings: {
    fastest: number;
    slowest: number;
    median: number;
    p95: number;
    p99: number;
  };
}

interface OperationRecord {
  id: string;
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore: number;
  memoryAfter?: number;
  success: boolean;
}

/**
 * Tracks performance metrics for the Style Diff Engine
 */
export class PerformanceTracker {
  private metrics: EnginePerformanceMetrics;
  private activeOperations: Map<string, OperationRecord>;
  private completedOperations: OperationRecord[];
  private memorySnapshots: number[];
  private cacheStats: { hits: number; misses: number };
  private errors: number;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.activeOperations = new Map();
    this.completedOperations = [];
    this.memorySnapshots = [];
    this.cacheStats = { hits: 0, misses: 0 };
    this.errors = 0;

    this.metrics = {
      totalComparisons: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      memoryUsage: {
        current: 0,
        peak: 0,
        average: 0
      },
      operationBreakdown: {
        parsing: 0,
        analysis: 0,
        rendering: 0,
        caching: 0,
        validation: 0
      },
      errorRate: 0,
      throughput: 0,
      concurrency: {
        averageConcurrent: 0,
        peakConcurrent: 0,
        totalOperations: 0
      },
      timings: {
        fastest: Number.MAX_VALUE,
        slowest: 0,
        median: 0,
        p95: 0,
        p99: 0
      }
    };

    // Record initial memory usage
    this.recordMemoryUsage();
  }

  /**
   * Start tracking an operation
   */
  public startOperation(operationId: string, type: string = 'unknown'): void {
    const record: OperationRecord = {
      id: operationId,
      type,
      startTime: Date.now(),
      memoryBefore: this.getCurrentMemoryUsage(),
      success: false
    };

    this.activeOperations.set(operationId, record);
    this.updateConcurrencyMetrics();
  }

  /**
   * End tracking an operation
   */
  public endOperation(operationId: string, success: boolean = true): number {
    const record = this.activeOperations.get(operationId);
    if (!record) {
      console.warn(`Performance tracker: Operation ${operationId} not found`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - record.startTime;

    record.endTime = endTime;
    record.duration = duration;
    record.memoryAfter = this.getCurrentMemoryUsage();
    record.success = success;

    // Move to completed operations
    this.activeOperations.delete(operationId);
    this.completedOperations.push(record);

    // Update metrics
    this.updateMetrics(record);

    return duration;
  }

  /**
   * Record current memory usage
   */
  public recordMemoryUsage(): void {
    const usage = this.getCurrentMemoryUsage();
    this.memorySnapshots.push(usage);

    // Keep only last 1000 snapshots
    if (this.memorySnapshots.length > 1000) {
      this.memorySnapshots = this.memorySnapshots.slice(-1000);
    }

    this.updateMemoryMetrics();
  }

  /**
   * Record an error
   */
  public recordError(): void {
    this.errors++;
    this.updateErrorRate();
  }

  /**
   * Record a cache hit
   */
  public recordCacheHit(): void {
    this.cacheStats.hits++;
    this.updateCacheHitRate();
  }

  /**
   * Record a cache miss
   */
  public recordCacheMiss(): void {
    this.cacheStats.misses++;
    this.updateCacheHitRate();
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): EnginePerformanceMetrics {
    this.updateDerivedMetrics();
    return { ...this.metrics };
  }

  /**
   * Get a human-readable performance report
   */
  public getReport(): string {
    const metrics = this.getMetrics();
    const uptime = Date.now() - this.startTime;

    return `
=== Performance Report ===
Uptime: ${this.formatDuration(uptime)}
Total Comparisons: ${metrics.totalComparisons}
Total Processing Time: ${this.formatDuration(metrics.totalProcessingTime)}
Average Processing Time: ${this.formatDuration(metrics.averageProcessingTime)}
Throughput: ${metrics.throughput.toFixed(2)} comparisons/sec
Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%
Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%

=== Memory Usage ===
Current: ${this.formatBytes(metrics.memoryUsage.current)}
Peak: ${this.formatBytes(metrics.memoryUsage.peak)}
Average: ${this.formatBytes(metrics.memoryUsage.average)}

=== Operation Breakdown ===
Parsing: ${this.formatDuration(metrics.operationBreakdown.parsing)}
Analysis: ${this.formatDuration(metrics.operationBreakdown.analysis)}
Rendering: ${this.formatDuration(metrics.operationBreakdown.rendering)}
Caching: ${this.formatDuration(metrics.operationBreakdown.caching)}
Validation: ${this.formatDuration(metrics.operationBreakdown.validation)}

=== Concurrency ===
Peak Concurrent Operations: ${metrics.concurrency.peakConcurrent}
Average Concurrent Operations: ${metrics.concurrency.averageConcurrent.toFixed(2)}

=== Timing Percentiles ===
Fastest: ${this.formatDuration(metrics.timings.fastest)}
Slowest: ${this.formatDuration(metrics.timings.slowest)}
Median: ${this.formatDuration(metrics.timings.median)}
95th Percentile: ${this.formatDuration(metrics.timings.p95)}
99th Percentile: ${this.formatDuration(metrics.timings.p99)}
`;
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.completedOperations = [];
    this.memorySnapshots = [];
    this.cacheStats = { hits: 0, misses: 0 };
    this.errors = 0;
    this.startTime = Date.now();

    this.metrics = {
      totalComparisons: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      memoryUsage: {
        current: this.getCurrentMemoryUsage(),
        peak: 0,
        average: 0
      },
      operationBreakdown: {
        parsing: 0,
        analysis: 0,
        rendering: 0,
        caching: 0,
        validation: 0
      },
      errorRate: 0,
      throughput: 0,
      concurrency: {
        averageConcurrent: 0,
        peakConcurrent: 0,
        totalOperations: 0
      },
      timings: {
        fastest: Number.MAX_VALUE,
        slowest: 0,
        median: 0,
        p95: 0,
        p99: 0
      }
    };
  }

  /**
   * Get the start time of an operation (for external use)
   */
  public getStartTime(operationId: string): number {
    const record = this.activeOperations.get(operationId);
    return record ? record.startTime : Date.now();
  }

  // Private methods

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    // Fallback for environments without process.memoryUsage
    return 0;
  }

  private updateMetrics(record: OperationRecord): void {
    if (record.duration === undefined) return;

    // Update totals
    this.metrics.totalComparisons++;
    this.metrics.totalProcessingTime += record.duration;

    // Update operation breakdown
    const operationType = this.categorizeOperation(record.type);
    if (operationType && this.metrics.operationBreakdown.hasOwnProperty(operationType)) {
      (this.metrics.operationBreakdown as any)[operationType] += record.duration;
    }

    // Update timing metrics
    if (record.duration < this.metrics.timings.fastest) {
      this.metrics.timings.fastest = record.duration;
    }
    if (record.duration > this.metrics.timings.slowest) {
      this.metrics.timings.slowest = record.duration;
    }
  }

  private updateDerivedMetrics(): void {
    // Update averages
    if (this.metrics.totalComparisons > 0) {
      this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalComparisons;
    }

    // Update throughput
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    if (uptimeSeconds > 0) {
      this.metrics.throughput = this.metrics.totalComparisons / uptimeSeconds;
    }

    // Update timing percentiles
    this.updateTimingPercentiles();

    // Update concurrency averages
    this.updateConcurrencyAverages();
  }

  private updateTimingPercentiles(): void {
    const durations = this.completedOperations
      .filter(op => op.duration !== undefined)
      .map(op => op.duration!)
      .sort((a, b) => a - b);

    if (durations.length === 0) return;

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * durations.length) - 1;
      return durations[Math.max(0, Math.min(index, durations.length - 1))];
    };

    this.metrics.timings.median = getPercentile(50);
    this.metrics.timings.p95 = getPercentile(95);
    this.metrics.timings.p99 = getPercentile(99);
  }

  private updateMemoryMetrics(): void {
    if (this.memorySnapshots.length === 0) return;

    const current = this.memorySnapshots[this.memorySnapshots.length - 1];
    const peak = Math.max(...this.memorySnapshots);
    const average = this.memorySnapshots.reduce((sum, val) => sum + val, 0) / this.memorySnapshots.length;

    this.metrics.memoryUsage = { current, peak, average };
  }

  private updateCacheHitRate(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.metrics.cacheHitRate = total > 0 ? this.cacheStats.hits / total : 0;
  }

  private updateErrorRate(): void {
    const total = this.metrics.totalComparisons + this.errors;
    this.metrics.errorRate = total > 0 ? this.errors / total : 0;
  }

  private updateConcurrencyMetrics(): void {
    const currentConcurrent = this.activeOperations.size;
    
    if (currentConcurrent > this.metrics.concurrency.peakConcurrent) {
      this.metrics.concurrency.peakConcurrent = currentConcurrent;
    }

    this.metrics.concurrency.totalOperations++;
    
    // Update running average
    const totalOps = this.metrics.concurrency.totalOperations;
    const currentAvg = this.metrics.concurrency.averageConcurrent;
    this.metrics.concurrency.averageConcurrent = 
      (currentAvg * (totalOps - 1) + currentConcurrent) / totalOps;
  }

  private updateConcurrencyAverages(): void {
    // This is already handled in updateConcurrencyMetrics
    // Called from updateDerivedMetrics for completeness
  }

  private categorizeOperation(type: string): keyof typeof this.metrics.operationBreakdown | null {
    const typeMap: { [key: string]: keyof typeof this.metrics.operationBreakdown } = {
      'parse': 'parsing',
      'parsing': 'parsing',
      'analyze': 'analysis',
      'analysis': 'analysis',
      'semantic': 'analysis',
      'context': 'analysis',
      'render': 'rendering',
      'rendering': 'rendering',
      'format': 'rendering',
      'cache': 'caching',
      'caching': 'caching',
      'validate': 'validation',
      'validation': 'validation'
    };

    const lowerType = type.toLowerCase();
    for (const [key, category] of Object.entries(typeMap)) {
      if (lowerType.includes(key)) {
        return category;
      }
    }

    return null;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(1)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
