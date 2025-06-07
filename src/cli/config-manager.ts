import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { DiffPreset, DiffEngineOptions } from '../diff/types';

/**
 * Configuration interface for CLI settings
 */
export interface CLIConfig {
  defaultPreset: DiffPreset;
  defaultOutputFormat: 'terminal' | 'json' | 'html';
  performanceMetrics: boolean;
  verboseOutput: boolean;
  cacheEnabled: boolean;
  maxConcurrency: number;
  excludePatterns: string[];
  includePatterns: string[];
  outputDirectory: string;
  customPresets: Record<string, Partial<DiffEngineOptions>>;
}

/**
 * Default CLI configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
  defaultPreset: 'balanced',
  defaultOutputFormat: 'terminal',
  performanceMetrics: false,
  verboseOutput: false,
  cacheEnabled: true,
  maxConcurrency: 4,
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.min.css'],
  includePatterns: ['**/*.scss', '**/*.css'],
  outputDirectory: './diff-results',
  customPresets: {}
};

/**
 * Configuration Manager for CLI settings
 */
export class ConfigManager {
  private config: CLIConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), '.nostyledrifting.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<CLIConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const userConfig = JSON.parse(configData);
      this.config = { ...DEFAULT_CONFIG, ...userConfig };
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      await fs.mkdir(dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CLIConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CLIConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get configuration value by key
   */
  get<K extends keyof CLIConfig>(key: K): CLIConfig[K] {
    return this.config[key];
  }

  /**
   * Set configuration value by key
   */
  set<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Validate configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate preset
    const validPresets: DiffPreset[] = ['fast', 'balanced', 'thorough', 'accessibility', 'performance'];
    if (!validPresets.includes(this.config.defaultPreset)) {
      errors.push(`Invalid default preset: ${this.config.defaultPreset}`);
    }

    // Validate output format
    const validFormats = ['terminal', 'json', 'html'];
    if (!validFormats.includes(this.config.defaultOutputFormat)) {
      errors.push(`Invalid default output format: ${this.config.defaultOutputFormat}`);
    }

    // Validate concurrency
    if (this.config.maxConcurrency < 1 || this.config.maxConcurrency > 20) {
      errors.push('Max concurrency must be between 1 and 20');
    }

    // Validate patterns
    if (!Array.isArray(this.config.excludePatterns)) {
      errors.push('Exclude patterns must be an array');
    }

    if (!Array.isArray(this.config.includePatterns)) {
      errors.push('Include patterns must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Add custom preset
   */
  addCustomPreset(name: string, options: Partial<DiffEngineOptions>): void {
    this.config.customPresets[name] = options;
  }

  /**
   * Remove custom preset
   */
  removeCustomPreset(name: string): void {
    delete this.config.customPresets[name];
  }

  /**
   * Get all available presets (built-in + custom)
   */
  getAvailablePresets(): string[] {
    const builtInPresets: DiffPreset[] = ['fast', 'balanced', 'thorough', 'accessibility', 'performance'];
    const customPresets = Object.keys(this.config.customPresets);
    return [...builtInPresets, ...customPresets];
  }

  /**
   * Get preset configuration
   */
  getPresetConfig(preset: string): Partial<DiffEngineOptions> | null {
    if (preset in this.config.customPresets) {
      return this.config.customPresets[preset];
    }
    return null; // Built-in presets are handled by the diff engine
  }

  /**
   * Export configuration for sharing
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from string
   */
  importConfig(configString: string): void {
    try {
      const importedConfig = JSON.parse(configString);
      this.config = { ...DEFAULT_CONFIG, ...importedConfig };
    } catch (error) {
      throw new Error(`Invalid configuration format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get configuration summary for display
   */
  getSummary(): Record<string, any> {
    return {
      'Default Preset': this.config.defaultPreset,
      'Output Format': this.config.defaultOutputFormat,
      'Performance Metrics': this.config.performanceMetrics ? 'Enabled' : 'Disabled',
      'Cache': this.config.cacheEnabled ? 'Enabled' : 'Disabled',
      'Max Concurrency': this.config.maxConcurrency,
      'Custom Presets': Object.keys(this.config.customPresets).length,
      'Exclude Patterns': this.config.excludePatterns.length,
      'Include Patterns': this.config.includePatterns.length
    };
  }
}

/**
 * Global configuration manager instance
 */
export const globalConfig = new ConfigManager();
