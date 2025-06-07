import { StyleDiffEngine } from './style-diff-engine';
import { EngineConfigManager, StyleDiffEngineConfig } from './engine-config';
import { StyleDiffOptions } from './types';

export type DiffEnginePreset = 
  | 'fast' 
  | 'balanced' 
  | 'thorough' 
  | 'memory-optimized' 
  | 'development' 
  | 'production'
  | 'ci-cd'
  | 'large-files';

export interface DiffEnginePresetConfig {
  name: DiffEnginePreset;
  description: string;
  config: StyleDiffEngineConfig;
  recommended: string[];
  limitations?: string[];
}

/**
 * Factory for creating Style Diff Engine instances with predefined configurations
 */
export class StyleDiffEngineFactory {
  private static presets: Map<DiffEnginePreset, DiffEnginePresetConfig> = new Map();

  static {
    // Initialize presets when the class is first loaded
    StyleDiffEngineFactory.initializePresets();
  }

  /**
   * Create an engine with a predefined preset
   */
  public static createEngine(preset: DiffEnginePreset = 'balanced'): StyleDiffEngine {
    const presetConfig = this.presets.get(preset);
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    return new StyleDiffEngine(presetConfig.config as Partial<StyleDiffOptions>);
  }

  /**
   * Create an engine with custom configuration
   */
  public static createCustomEngine(config: Partial<StyleDiffEngineConfig>): StyleDiffEngine {
    return new StyleDiffEngine(config as Partial<StyleDiffOptions>);
  }

  /**
   * Create an engine by merging a preset with custom options
   */
  public static createEngineWithOverrides(
    preset: DiffEnginePreset, 
    overrides: Partial<StyleDiffEngineConfig>
  ): StyleDiffEngine {
    const presetConfig = this.presets.get(preset);
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    // Deep merge preset config with overrides
    const mergedConfig = this.deepMerge(presetConfig.config, overrides);
    return new StyleDiffEngine(mergedConfig as Partial<StyleDiffOptions>);
  }

  /**
   * Get a preset configuration
   */
  public static getPreset(preset: DiffEnginePreset): DiffEnginePresetConfig {
    const presetConfig = this.presets.get(preset);
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }
    return { ...presetConfig };
  }

  /**
   * List all available presets
   */
  public static listPresets(): DiffEnginePresetConfig[] {
    return Array.from(this.presets.values()).map(preset => ({ ...preset }));
  }

  /**
   * Register a custom preset
   */
  public static registerPreset(preset: DiffEnginePresetConfig): void {
    this.presets.set(preset.name, preset);
  }

  /**
   * Get recommended preset based on use case
   */
  public static getRecommendedPreset(useCase: string): DiffEnginePreset {
    const lowerUseCase = useCase.toLowerCase();
    
    if (lowerUseCase.includes('ci') || lowerUseCase.includes('pipeline')) {
      return 'ci-cd';
    }
    if (lowerUseCase.includes('large') || lowerUseCase.includes('big')) {
      return 'large-files';
    }
    if (lowerUseCase.includes('memory') || lowerUseCase.includes('constrained')) {
      return 'memory-optimized';
    }
    if (lowerUseCase.includes('fast') || lowerUseCase.includes('quick')) {
      return 'fast';
    }
    if (lowerUseCase.includes('thorough') || lowerUseCase.includes('complete')) {
      return 'thorough';
    }
    if (lowerUseCase.includes('dev') || lowerUseCase.includes('development')) {
      return 'development';
    }
    if (lowerUseCase.includes('prod') || lowerUseCase.includes('production')) {
      return 'production';
    }

    return 'balanced';
  }

  // Private methods

  private static initializePresets(): void {
    // Fast preset - optimized for speed
    this.presets.set('fast', {
      name: 'fast',
      description: 'Optimized for speed with minimal analysis',
      config: EngineConfigManager.getFastConfig(),
      recommended: [
        'Quick comparisons',
        'Large batches',
        'CI/CD pipelines with time constraints',
        'Real-time feedback scenarios'
      ],
      limitations: [
        'Limited semantic analysis',
        'No variable resolution',
        'Basic change detection'
      ]
    });

    // Balanced preset - good balance of speed and features
    this.presets.set('balanced', {
      name: 'balanced',
      description: 'Balanced configuration suitable for most use cases',
      config: EngineConfigManager.getDefaultConfig(),
      recommended: [
        'General purpose diffing',
        'Development workflows',
        'Code review processes',
        'Regular testing'
      ]
    });

    // Thorough preset - comprehensive analysis
    this.presets.set('thorough', {
      name: 'thorough',
      description: 'Comprehensive analysis with all features enabled',
      config: EngineConfigManager.getThoroughConfig(),
      recommended: [
        'Critical code reviews',
        'Release preparations',
        'Detailed style audits',
        'Quality assurance processes'
      ],
      limitations: [
        'Slower processing',
        'Higher memory usage',
        'May timeout on very large files'
      ]
    });

    // Memory optimized preset
    this.presets.set('memory-optimized', {
      name: 'memory-optimized',
      description: 'Optimized for environments with limited memory',
      config: EngineConfigManager.getMemoryOptimizedConfig(),
      recommended: [
        'Constrained environments',
        'Docker containers',
        'Serverless functions',
        'Large file processing'
      ],
      limitations: [
        'Caching disabled',
        'Single-threaded processing',
        'Reduced context depth'
      ]
    });

    // Development preset
    this.presets.set('development', {
      name: 'development',
      description: 'Optimized for development workflows with verbose output',
      config: {
        ...EngineConfigManager.getDefaultConfig(),
        output: {
          ...EngineConfigManager.getDefaultConfig().output,
          verboseMode: true,
          includeMetadata: true,
          includeStatistics: true,
          contextLines: 5
        },
        validation: {
          ...EngineConfigManager.getDefaultConfig().validation,
          strictMode: false,
          allowPartialResults: true
        },
        cache: {
          ...EngineConfigManager.getDefaultConfig().cache,
          enabled: false // Disable caching for development
        }
      },
      recommended: [
        'Local development',
        'Debugging style issues',
        'Learning and experimentation',
        'Interactive use'
      ]
    });

    // Production preset
    this.presets.set('production', {
      name: 'production',
      description: 'Optimized for production environments with reliability focus',
      config: {
        ...EngineConfigManager.getDefaultConfig(),
        validation: {
          ...EngineConfigManager.getDefaultConfig().validation,
          strictMode: true,
          allowPartialResults: false,
          validateSyntax: true
        },
        cache: {
          ...EngineConfigManager.getDefaultConfig().cache,
          enabled: true,
          maxSize: 200,
          ttl: 7200000, // 2 hours
          persistToDisk: true
        },
        performance: {
          ...EngineConfigManager.getDefaultConfig().performance,
          timeout: 60000, // 1 minute
          enableWorkerThreads: true
        }
      },
      recommended: [
        'Production deployments',
        'Automated processes',
        'High-reliability requirements',
        'Long-running services'
      ]
    });

    // CI/CD preset
    this.presets.set('ci-cd', {
      name: 'ci-cd',
      description: 'Optimized for CI/CD pipelines with fast execution and machine-readable output',
      config: {
        ...EngineConfigManager.getFastConfig(),
        output: {
          ...EngineConfigManager.getFastConfig().output,
          defaultFormat: 'json' as any,
          colorOutput: false,
          verboseMode: false,
          includeMetadata: true,
          includeStatistics: false
        },
        validation: {
          ...EngineConfigManager.getFastConfig().validation,
          strictMode: true,
          allowPartialResults: false
        },
        performance: {
          ...EngineConfigManager.getFastConfig().performance,
          timeout: 45000, // 45 seconds
          concurrency: 2 // Conservative for CI environments
        }
      },
      recommended: [
        'GitHub Actions',
        'Jenkins pipelines',
        'Azure DevOps',
        'Automated testing'
      ],
      limitations: [
        'No color output',
        'Limited analysis depth',
        'JSON output only'
      ]
    });

    // Large files preset
    this.presets.set('large-files', {
      name: 'large-files',
      description: 'Optimized for processing large SCSS files efficiently',
      config: {
        ...EngineConfigManager.getMemoryOptimizedConfig(),
        performance: {
          ...EngineConfigManager.getMemoryOptimizedConfig().performance,
          enableStreaming: true,
          chunkSize: 2 * 1024 * 1024, // 2MB chunks
          timeout: 300000, // 5 minutes
          concurrency: 1 // Single threaded for large files
        },
        analysis: {
          ...EngineConfigManager.getMemoryOptimizedConfig().analysis,
          contextDepth: 1, // Minimal context for performance
          performanceMode: 'fast'
        },
        cache: {
          ...EngineConfigManager.getMemoryOptimizedConfig().cache,
          enabled: true,
          maxSize: 20, // Small cache
          compressionEnabled: true
        }
      },
      recommended: [
        'Files > 10MB',
        'Generated CSS files',
        'Concatenated stylesheets',
        'Legacy codebases'
      ],
      limitations: [
        'Minimal semantic analysis',
        'Single-threaded processing',
        'Limited context information'
      ]
    });
  }

  private static deepMerge(target: any, source: any): any {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }
}

// Convenience functions for common use cases

/**
 * Create a quick engine for simple comparisons
 */
export function createQuickEngine(): StyleDiffEngine {
  return StyleDiffEngineFactory.createEngine('fast');
}

/**
 * Create a production-ready engine
 */
export function createProductionEngine(): StyleDiffEngine {
  return StyleDiffEngineFactory.createEngine('production');
}

/**
 * Create a development-optimized engine
 */
export function createDevelopmentEngine(): StyleDiffEngine {
  return StyleDiffEngineFactory.createEngine('development');
}

/**
 * Create an engine optimized for CI/CD environments
 */
export function createCiCdEngine(): StyleDiffEngine {
  return StyleDiffEngineFactory.createEngine('ci-cd');
}

/**
 * Create an engine for processing large files
 */
export function createLargeFileEngine(): StyleDiffEngine {
  return StyleDiffEngineFactory.createEngine('large-files');
}

/**
 * Create an engine with automatic preset selection based on environment
 */
export function createAutoEngine(): StyleDiffEngine {
  // Detect environment and choose appropriate preset
  if (typeof process !== 'undefined') {
    const env = process.env.NODE_ENV || '';
    const ci = process.env.CI || process.env.CONTINUOUS_INTEGRATION;
    
    if (ci) {
      return createCiCdEngine();
    } else if (env === 'production') {
      return createProductionEngine();
    } else if (env === 'development') {
      return createDevelopmentEngine();
    }
  }
  
  // Default to balanced
  return StyleDiffEngineFactory.createEngine('balanced');
}
