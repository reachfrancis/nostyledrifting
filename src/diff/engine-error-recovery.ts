export interface RecoveryStrategy {
  name: string;
  description: string;
  condition: (error: Error) => boolean;
  action: (error: Error, context: any) => Promise<any>;
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff: boolean;
}

interface RetryState {
  strategy: string;
  attempt: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
}

/**
 * Provides error recovery and resilience for the Style Diff Engine
 */
export class EngineErrorRecovery {
  private strategies: Map<string, RecoveryStrategy>;
  private retryStates: Map<string, RetryState>;
  private globalRetryLimit: number;

  constructor(globalRetryLimit: number = 10) {
    this.strategies = new Map();
    this.retryStates = new Map();
    this.globalRetryLimit = globalRetryLimit;

    // Initialize with built-in strategies
    this.initializeBuiltInStrategies();
  }

  /**
   * Add a recovery strategy
   */
  public addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Remove a recovery strategy
   */
  public removeStrategy(name: string): void {
    this.strategies.delete(name);
    // Clean up any retry states for this strategy
    const keysToDelete = Array.from(this.retryStates.keys()).filter(key => key.startsWith(`${name}:`));
    keysToDelete.forEach(key => this.retryStates.delete(key));
  }

  /**
   * Execute an operation with automatic recovery on failure
   */
  public async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: any = {}
  ): Promise<T> {
    let lastError: Error;
    let globalAttempts = 0;

    while (globalAttempts < this.globalRetryLimit) {
      try {
        const result = await operation();
        // Clear any retry states for this context on success
        this.clearRetryStatesForContext(context);
        return result;
      } catch (error) {
        lastError = error as Error;
        globalAttempts++;

        // Try to apply recovery strategies
        const recovered = await this.applyRecoveryStrategy(lastError, context);
        
        if (!recovered) {
          // No applicable strategy or all strategies exhausted
          break;
        }

        // Small delay before retry
        await this.delay(100);
      }
    }

    // All recovery attempts failed
    throw new Error(`Operation failed after ${globalAttempts} attempts. Last error: ${lastError.message}`, { cause: lastError });
  }

  /**
   * Get statistics about recovery attempts
   */
  public getRecoveryStats(): { [strategyName: string]: { attempts: number; successes: number; failures: number } } {
    const stats: { [strategyName: string]: { attempts: number; successes: number; failures: number } } = {};
    
    // Initialize stats for all strategies
    for (const strategyName of this.strategies.keys()) {
      stats[strategyName] = { attempts: 0, successes: 0, failures: 0 };
    }

    // Count retry states (attempts)
    for (const [key, retryState] of this.retryStates) {
      const strategyName = retryState.strategy;
      if (stats[strategyName]) {
        stats[strategyName].attempts += retryState.attempt;
      }
    }

    return stats;
  }

  /**
   * Clear all retry states
   */
  public clearRetryStates(): void {
    this.retryStates.clear();
  }

  // Private methods

  private async applyRecoveryStrategy(error: Error, context: any): Promise<boolean> {
    // Find applicable strategies
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.condition(error))
      .sort((a, b) => a.maxRetries - b.maxRetries); // Try strategies with fewer retries first

    for (const strategy of applicableStrategies) {
      const retryKey = this.getRetryKey(strategy.name, context);
      const retryState = this.getOrCreateRetryState(retryKey, strategy.name);

      // Check if strategy has retries left
      if (retryState.attempt >= strategy.maxRetries) {
        continue;
      }

      try {
        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(strategy, retryState.attempt);
        if (delay > 0) {
          await this.delay(delay);
        }

        // Increment attempt counter
        retryState.attempt++;
        retryState.lastAttemptTime = Date.now();

        // Execute recovery action
        await strategy.action(error, context);

        console.debug(`Recovery strategy '${strategy.name}' applied successfully (attempt ${retryState.attempt})`);
        return true;

      } catch (recoveryError) {
        console.warn(`Recovery strategy '${strategy.name}' failed:`, recoveryError.message);
        continue;
      }
    }

    return false;
  }

  private getRetryKey(strategyName: string, context: any): string {
    // Create a unique key based on strategy and context
    const contextKey = this.createContextKey(context);
    return `${strategyName}:${contextKey}`;
  }

  private createContextKey(context: any): string {
    if (!context) return 'default';
    
    // Create a deterministic key from context
    const relevantProps = ['file1', 'file2', 'content1', 'content2', 'operationType'];
    const keyParts: string[] = [];

    relevantProps.forEach(prop => {
      if (context[prop]) {
        if (typeof context[prop] === 'string' && context[prop].length > 50) {
          // For long strings (like content), use a hash
          keyParts.push(`${prop}:${this.simpleHash(context[prop])}`);
        } else {
          keyParts.push(`${prop}:${context[prop]}`);
        }
      }
    });

    return keyParts.join('|') || 'default';
  }

  private getOrCreateRetryState(retryKey: string, strategyName: string): RetryState {
    let retryState = this.retryStates.get(retryKey);
    
    if (!retryState) {
      retryState = {
        strategy: strategyName,
        attempt: 0,
        firstAttemptTime: Date.now(),
        lastAttemptTime: Date.now()
      };
      this.retryStates.set(retryKey, retryState);
    }

    return retryState;
  }

  private calculateBackoffDelay(strategy: RecoveryStrategy, attempt: number): number {
    if (!strategy.exponentialBackoff) {
      return strategy.backoffMs;
    }

    // Exponential backoff with jitter
    const exponentialDelay = strategy.backoffMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private clearRetryStatesForContext(context: any): void {
    const contextKey = this.createContextKey(context);
    const keysToDelete = Array.from(this.retryStates.keys()).filter(key => key.endsWith(`:${contextKey}`));
    keysToDelete.forEach(key => this.retryStates.delete(key));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private initializeBuiltInStrategies(): void {
    // File access recovery strategy
    this.addStrategy({
      name: 'file-access-retry',
      description: 'Retry file operations that fail due to temporary access issues',
      condition: (error) => {
        const message = error.message.toLowerCase();
        return message.includes('enoent') || 
               message.includes('eacces') || 
               message.includes('emfile') ||
               message.includes('file not found') ||
               message.includes('permission denied');
      },
      action: async (error, context) => {
        console.debug('Retrying file access operation');
        // Just wait - the retry will happen automatically
        return Promise.resolve();
      },
      maxRetries: 3,
      backoffMs: 1000,
      exponentialBackoff: true
    });

    // Memory pressure recovery strategy
    this.addStrategy({
      name: 'memory-pressure-recovery',
      description: 'Attempt to free memory when operations fail due to memory issues',
      condition: (error) => {
        const message = error.message.toLowerCase();
        return message.includes('out of memory') || 
               message.includes('heap') ||
               message.includes('enomem') ||
               message.includes('memory');
      },
      action: async (error, context) => {
        console.debug('Attempting memory recovery');
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Clear caches if available in context
        if (context.clearCache && typeof context.clearCache === 'function') {
          context.clearCache();
        }

        // Wait for GC to complete
        await this.delay(2000);
        
        return Promise.resolve();
      },
      maxRetries: 2,
      backoffMs: 2000,
      exponentialBackoff: false
    });

    // Network/timeout recovery strategy
    this.addStrategy({
      name: 'timeout-recovery',
      description: 'Retry operations that fail due to timeouts',
      condition: (error) => {
        const message = error.message.toLowerCase();
        return message.includes('timeout') || 
               message.includes('etimedout') ||
               message.includes('network') ||
               message.includes('connection');
      },
      action: async (error, context) => {
        console.debug('Retrying after timeout');
        // Increase timeout if possible
        if (context.options && context.options.timeout) {
          context.options.timeout = Math.min(context.options.timeout * 1.5, 300000); // Cap at 5 minutes
        }
        return Promise.resolve();
      },
      maxRetries: 3,
      backoffMs: 2000,
      exponentialBackoff: true
    });

    // Parsing error recovery strategy
    this.addStrategy({
      name: 'parsing-error-recovery',
      description: 'Attempt to recover from parsing errors with more permissive settings',
      condition: (error) => {
        const message = error.message.toLowerCase();
        return message.includes('parse') || 
               message.includes('syntax') ||
               message.includes('unexpected') ||
               message.includes('invalid');
      },
      action: async (error, context) => {
        console.debug('Attempting parsing error recovery');
        
        // Make parsing more permissive
        if (context.options) {
          context.options.strictMode = false;
          context.options.ignoreErrors = true;
          context.options.tolerateInvalidSyntax = true;
        }

        return Promise.resolve();
      },
      maxRetries: 1,
      backoffMs: 0,
      exponentialBackoff: false
    });

    // Resource exhaustion recovery strategy
    this.addStrategy({
      name: 'resource-exhaustion-recovery',
      description: 'Reduce resource usage when operations fail due to resource limits',
      condition: (error) => {
        const message = error.message.toLowerCase();
        return message.includes('resource') || 
               message.includes('limit') ||
               message.includes('quota') ||
               message.includes('emfile') ||
               message.includes('too many');
      },
      action: async (error, context) => {
        console.debug('Attempting resource exhaustion recovery');
        
        // Reduce concurrency and resource usage
        if (context.options) {
          context.options.concurrency = Math.max(1, Math.floor((context.options.concurrency || 4) / 2));
          context.options.enableStreaming = true;
          context.options.chunkSize = Math.max(1024, Math.floor((context.options.chunkSize || 1024 * 1024) / 2));
        }

        // Wait for resources to become available
        await this.delay(5000);
        
        return Promise.resolve();
      },
      maxRetries: 2,
      backoffMs: 5000,
      exponentialBackoff: false
    });

    // Generic retry strategy (fallback)
    this.addStrategy({
      name: 'generic-retry',
      description: 'Generic retry for transient errors',
      condition: (error) => {
        // Apply to errors that don't match other strategies but seem transient
        const message = error.message.toLowerCase();
        const transientKeywords = ['temporary', 'busy', 'unavailable', 'retry', 'again'];
        return transientKeywords.some(keyword => message.includes(keyword));
      },
      action: async (error, context) => {
        console.debug('Generic retry attempt');
        return Promise.resolve();
      },
      maxRetries: 2,
      backoffMs: 1000,
      exponentialBackoff: true
    });
  }
}
