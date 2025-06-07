import { 
  DiffAnalysisMode, 
  DiffRenderFormat,
  DiffValidationResult 
} from './types';

export interface StyleDiffEngineConfig {
  // Analysis Configuration
  analysis: {
    mode: DiffAnalysisMode;
    contextDepth: number;
    includeVariables: boolean;
    includeImports: boolean;
    semanticAnalysis: boolean;
    performanceMode: 'fast' | 'balanced' | 'thorough';
    strictMode: boolean;
    ignoreWhitespace: boolean;
    ignoreComments: boolean;
  };

  // Caching Configuration
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number; // Time to live in milliseconds
    strategy: 'lru' | 'lfu' | 'fifo';
    persistToDisk: boolean;
    compressionEnabled: boolean;
  };

  // Performance Configuration
  performance: {
    concurrency: number;
    timeout: number; // milliseconds
    memoryLimit: number; // bytes
    enableStreaming: boolean;
    chunkSize: number;
    enableWorkerThreads: boolean;
    maxWorkers: number;
  };

  // Output Configuration
  output: {
    defaultFormat: DiffRenderFormat;
    includeMetadata: boolean;
    includeStatistics: boolean;
    verboseMode: boolean;
    colorOutput: boolean;
    lineNumbers: boolean;
    contextLines: number;
  };

  // Validation Configuration
  validation: {
    enabled: boolean;
    strictMode: boolean;
    allowPartialResults: boolean;
    validateSyntax: boolean;
    checkFileAccess: boolean;
  };

  // Integration Configuration
  integration: {
    gitEnabled: boolean;
    scssDiscoveryEnabled: boolean;
    typographyAnalysisEnabled: boolean;
    accessibilityChecks: boolean;
  };
}

/**
 * Manages configuration for the Style Diff Engine
 */
export class EngineConfigManager {
  private config: StyleDiffEngineConfig;
  private static defaultConfig: StyleDiffEngineConfig = {
    analysis: {
      mode: DiffAnalysisMode.SEMANTIC,
      contextDepth: 3,
      includeVariables: true,
      includeImports: true,
      semanticAnalysis: true,
      performanceMode: 'balanced',
      strictMode: false,
      ignoreWhitespace: false,
      ignoreComments: false
    },
    cache: {
      enabled: true,
      maxSize: 100, // number of entries
      ttl: 3600000, // 1 hour
      strategy: 'lru',
      persistToDisk: false,
      compressionEnabled: true
    },
    performance: {
      concurrency: 4,
      timeout: 30000, // 30 seconds
      memoryLimit: 512 * 1024 * 1024, // 512MB
      enableStreaming: true,
      chunkSize: 1024 * 1024, // 1MB
      enableWorkerThreads: false,
      maxWorkers: 2
    },
    output: {
      defaultFormat: DiffRenderFormat.TERMINAL,
      includeMetadata: true,
      includeStatistics: true,
      verboseMode: false,
      colorOutput: true,
      lineNumbers: true,
      contextLines: 3
    },
    validation: {
      enabled: true,
      strictMode: false,
      allowPartialResults: true,
      validateSyntax: true,
      checkFileAccess: true
    },
    integration: {
      gitEnabled: true,
      scssDiscoveryEnabled: true,
      typographyAnalysisEnabled: true,
      accessibilityChecks: true
    }
  };

  constructor(config?: Partial<StyleDiffEngineConfig>) {
    this.config = this.mergeConfig(EngineConfigManager.defaultConfig, config || {});
  }

  /**
   * Get the current configuration
   */
  public getConfig(): StyleDiffEngineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with partial updates
   */
  public updateConfig(updates: Partial<StyleDiffEngineConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    
    // Validate the updated configuration
    const validation = this.validateConfig();
    if (!validation.valid) {
      throw new Error(`Configuration update invalid: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    this.config = { ...EngineConfigManager.defaultConfig };
  }

  /**
   * Validate the current configuration
   */
  public validateConfig(): DiffValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate analysis configuration
    if (this.config.analysis.contextDepth < 0) {
      errors.push('Analysis context depth must be non-negative');
    }
    if (this.config.analysis.contextDepth > 10) {
      warnings.push('High context depth may impact performance');
    }

    // Validate cache configuration
    if (this.config.cache.enabled) {
      if (this.config.cache.maxSize <= 0) {
        errors.push('Cache max size must be positive when caching is enabled');
      }
      if (this.config.cache.ttl <= 0) {
        errors.push('Cache TTL must be positive when caching is enabled');
      }
      if (this.config.cache.maxSize > 1000) {
        warnings.push('Large cache size may consume significant memory');
      }
    }

    // Validate performance configuration
    if (this.config.performance.concurrency <= 0) {
      errors.push('Concurrency must be positive');
    }
    if (this.config.performance.concurrency > 16) {
      warnings.push('High concurrency may not improve performance and could cause resource contention');
    }
    if (this.config.performance.timeout <= 0) {
      errors.push('Timeout must be positive');
    }
    if (this.config.performance.memoryLimit <= 0) {
      errors.push('Memory limit must be positive');
    }
    if (this.config.performance.chunkSize <= 0) {
      errors.push('Chunk size must be positive');
    }

    // Validate output configuration
    if (this.config.output.contextLines < 0) {
      errors.push('Context lines must be non-negative');
    }
    if (this.config.output.contextLines > 20) {
      warnings.push('High context lines may produce verbose output');
    }

    // Performance suggestions
    if (this.config.analysis.performanceMode === 'thorough' && this.config.performance.concurrency > 2) {
      suggestions.push('Consider reducing concurrency in thorough analysis mode for better stability');
    }
    if (!this.config.cache.enabled && this.config.analysis.performanceMode !== 'fast') {
      suggestions.push('Enable caching for better performance in non-fast modes');
    }
    if (this.config.cache.enabled && !this.config.cache.compressionEnabled && this.config.cache.maxSize > 50) {
      suggestions.push('Enable cache compression for large cache sizes to reduce memory usage');
    }

    // Integration warnings
    if (this.config.integration.gitEnabled && !this.config.validation.checkFileAccess) {
      warnings.push('Git integration works best with file access validation enabled');
    }    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the default configuration
   */
  public static getDefaultConfig(): StyleDiffEngineConfig {
    return { ...EngineConfigManager.defaultConfig };
  }

  /**
   * Create a configuration for fast processing
   */
  public static getFastConfig(): StyleDiffEngineConfig {
    return {
      ...EngineConfigManager.defaultConfig,
      analysis: {
        ...EngineConfigManager.defaultConfig.analysis,
        mode: DiffAnalysisMode.TEXT,
        performanceMode: 'fast',
        semanticAnalysis: false,
        includeVariables: false,
        contextDepth: 1
      },
      cache: {
        ...EngineConfigManager.defaultConfig.cache,
        maxSize: 50,
        compressionEnabled: false
      },
      performance: {
        ...EngineConfigManager.defaultConfig.performance,
        concurrency: 2,
        enableStreaming: false,
        chunkSize: 512 * 1024
      },
      output: {
        ...EngineConfigManager.defaultConfig.output,
        includeMetadata: false,
        includeStatistics: false,
        contextLines: 1
      }
    };
  }

  /**
   * Create a configuration for thorough analysis
   */
  public static getThoroughConfig(): StyleDiffEngineConfig {
    return {
      ...EngineConfigManager.defaultConfig,
      analysis: {
        ...EngineConfigManager.defaultConfig.analysis,
        mode: DiffAnalysisMode.SEMANTIC,
        performanceMode: 'thorough',
        semanticAnalysis: true,
        includeVariables: true,
        includeImports: true,
        contextDepth: 5,
        strictMode: true
      },
      cache: {
        ...EngineConfigManager.defaultConfig.cache,
        maxSize: 200,
        ttl: 7200000, // 2 hours
        compressionEnabled: true
      },
      performance: {
        ...EngineConfigManager.defaultConfig.performance,
        concurrency: 2,
        enableStreaming: true,
        timeout: 60000 // 1 minute
      },
      output: {
        ...EngineConfigManager.defaultConfig.output,
        includeMetadata: true,
        includeStatistics: true,
        verboseMode: true,
        contextLines: 5
      },
      validation: {
        ...EngineConfigManager.defaultConfig.validation,
        strictMode: true,
        allowPartialResults: false
      }
    };
  }

  /**
   * Create a configuration optimized for memory usage
   */
  public static getMemoryOptimizedConfig(): StyleDiffEngineConfig {
    return {
      ...EngineConfigManager.defaultConfig,
      cache: {
        ...EngineConfigManager.defaultConfig.cache,
        enabled: false
      },
      performance: {
        ...EngineConfigManager.defaultConfig.performance,
        concurrency: 1,
        memoryLimit: 128 * 1024 * 1024, // 128MB
        enableStreaming: true,
        chunkSize: 512 * 1024,
        enableWorkerThreads: false
      },
      analysis: {
        ...EngineConfigManager.defaultConfig.analysis,
        performanceMode: 'fast',
        contextDepth: 2
      }
    };
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfig(base: StyleDiffEngineConfig, updates: Partial<StyleDiffEngineConfig>): StyleDiffEngineConfig {
    const result = { ...base };

    Object.keys(updates).forEach(key => {
      const updateValue = (updates as any)[key];
      if (updateValue && typeof updateValue === 'object' && !Array.isArray(updateValue)) {
        (result as any)[key] = { ...(base as any)[key], ...updateValue };
      } else {
        (result as any)[key] = updateValue;
      }
    });

    return result;
  }
}
