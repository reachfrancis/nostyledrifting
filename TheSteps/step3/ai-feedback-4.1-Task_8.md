# Task 8: CLI Integration and Command Interface

## Overview
Extend the existing CLI interface in NoStyleDrifting to integrate the new Style Diff Engine, providing command-line access to semantic SCSS comparison functionality. This task builds upon the existing CLI structure while adding new diff-specific commands and options.

## Implementation Requirements

### 1. CLI Command Structure

#### Enhanced Main CLI (`src/index.ts`)

```typescript
#!/usr/bin/env node

import { program } from 'commander';
import { GitBranchComparer } from './git-branch-comparer';
import { ScssDiscoveryService } from './scss-discovery';
import { StyleDiffEngine } from './diff/style-diff-engine';
import { StyleDiffEngineFactory } from './diff/engine-factory';
import { DiffRenderFormat } from './diff/types';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

// Enhanced main comparison command with diff integration
program
  .name('ng-style-compare')
  .description('Compare Angular styles between git branches with semantic diff analysis')
  .version('1.0.0')
  .argument('<branch1>', 'First branch to compare')
  .argument('<branch2>', 'Second branch to compare')
  .option('--keep-temp', 'Keep temporary directories after comparison')
  .option('--verbose', 'Show detailed output')
  .option('--discover-scss', 'Discover and analyze SCSS files')
  .option('--diff-engine', 'Enable semantic style diff analysis')
  .option('--diff-preset <preset>', 'Use diff engine preset (fast|balanced|thorough|memory-optimized|development|production|ci-cd|large-files)', 'balanced')
  .option('--diff-format <format>', 'Diff output format (terminal|json|html|unified|split|summary)', 'terminal')
  .option('--diff-context <lines>', 'Number of context lines in diff output', '3')
  .option('--export-diff <path>', 'Export diff results to file')
  .option('--semantic-analysis', 'Enable semantic SCSS analysis')
  .option('--include-variables', 'Include variable resolution in diff')
  .option('--include-imports', 'Include import analysis in diff')
  .action(async (branch1: string, branch2: string, options) => {
    // Existing branch comparison logic...
    // Add diff engine integration when --diff-engine is specified
  });
```

#### New Diff-Specific Commands

```typescript
// Style Diff Command
program
  .command('diff')
  .description('Perform semantic SCSS diff analysis')
  .argument('<file1>', 'First SCSS file to compare')
  .argument('<file2>', 'Second SCSS file to compare')
  .option('--preset <preset>', 'Engine preset to use', 'balanced')
  .option('--format <format>', 'Output format (terminal|json|html|unified|split|summary)', 'terminal')
  .option('--output <file>', 'Output file (default: stdout)')
  .option('--context <lines>', 'Context lines', '3')
  .option('--semantic', 'Enable semantic analysis')
  .option('--variables', 'Include variable resolution')
  .option('--imports', 'Include import analysis')
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Verbose output')
  .action(async (file1: string, file2: string, options) => {
    // Implementation details below
  });

// Batch Diff Command
program
  .command('batch-diff')
  .description('Perform batch SCSS file comparisons')
  .argument('<config-file>', 'JSON configuration file with comparison pairs')
  .option('--preset <preset>', 'Engine preset to use', 'balanced')
  .option('--format <format>', 'Output format', 'terminal')
  .option('--output-dir <dir>', 'Output directory for results')
  .option('--concurrency <num>', 'Concurrent comparisons', '4')
  .option('--progress', 'Show progress bar')
  .action(async (configFile: string, options) => {
    // Implementation details below
  });

// Directory Diff Command
program
  .command('diff-dir')
  .description('Compare SCSS files between two directories')
  .argument('<dir1>', 'First directory')
  .argument('<dir2>', 'Second directory')
  .option('--pattern <glob>', 'File pattern to match', '**/*.scss')
  .option('--preset <preset>', 'Engine preset to use', 'balanced')
  .option('--format <format>', 'Output format', 'summary')
  .option('--output <file>', 'Output file')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .option('--include-unchanged', 'Include unchanged files in output')
  .action(async (dir1: string, dir2: string, options) => {
    // Implementation details below
  });

// Diff Analysis Command
program
  .command('analyze-diff')
  .description('Analyze existing diff results')
  .argument('<diff-file>', 'Diff result file to analyze')
  .option('--format <format>', 'Analysis output format', 'terminal')
  .option('--output <file>', 'Output file')
  .option('--metrics', 'Include performance metrics')
  .option('--summary', 'Show summary only')
  .action(async (diffFile: string, options) => {
    // Implementation details below
  });
```

### 2. CLI Helper Functions

#### Diff Command Handlers (`src/cli/diff-commands.ts`)

```typescript
import { StyleDiffEngine } from '../diff/style-diff-engine';
import { StyleDiffEngineFactory } from '../diff/engine-factory';
import { DiffRenderFormat } from '../diff/types';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

export interface DiffCommandOptions {
  preset: string;
  format: string;
  output?: string;
  context: string;
  semantic?: boolean;
  variables?: boolean;
  imports?: boolean;
  color?: boolean;
  verbose?: boolean;
}

export interface BatchDiffConfig {
  comparisons: Array<{
    name: string;
    file1: string;
    file2: string;
    options?: any;
  }>;
  outputDir?: string;
  globalOptions?: any;
}

export class DiffCommandHandler {
  
  /**
   * Handle single file diff command
   */
  public static async handleFileDiff(
    file1: string, 
    file2: string, 
    options: DiffCommandOptions
  ): Promise<void> {
    try {
      // Validate files exist
      await Promise.all([
        fs.access(file1, fs.constants.F_OK),
        fs.access(file2, fs.constants.F_OK)
      ]);

      if (options.verbose) {
        console.log(chalk.blue('🔍 Starting SCSS diff analysis...'));
        console.log(chalk.gray(`Comparing: ${file1} vs ${file2}`));
        console.log(chalk.gray(`Using preset: ${options.preset}`));
      }

      // Create engine with specified preset
      const engine = StyleDiffEngineFactory.createEngine(options.preset as any);

      // Configure engine options
      const diffOptions = {
        analysisMode: options.semantic ? 'semantic' : 'text',
        contextDepth: parseInt(options.context),
        includeVariables: options.variables,
        includeImports: options.imports
      };

      // Perform comparison
      const result = await engine.compareFiles(file1, file2, diffOptions);

      // Render result
      const format = this.parseRenderFormat(options.format);
      const rendered = await engine.render(result, format, {
        colorOutput: options.color !== false,
        verbose: options.verbose
      });

      // Output result
      if (options.output) {
        await fs.writeFile(options.output, rendered);
        console.log(chalk.green(`✓ Diff saved to: ${options.output}`));
      } else {
        console.log(rendered);
      }

      // Show metrics if verbose
      if (options.verbose) {
        const metrics = engine.getPerformanceMetrics();
        console.log(chalk.blue('\n📊 Performance Metrics:'));
        console.log(`  Processing time: ${metrics.averageProcessingTime}ms`);
        console.log(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Memory usage: ${(metrics.memoryUsage.current / 1024 / 1024).toFixed(1)}MB`);
      }

    } catch (error) {
      console.error(chalk.red('❌ Diff analysis failed:'), error.message);
      if (options.verbose) {
        console.error(chalk.gray('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Handle batch diff command
   */
  public static async handleBatchDiff(
    configFile: string, 
    options: any
  ): Promise<void> {
    try {
      // Load configuration
      const config: BatchDiffConfig = await fs.readJson(configFile);
      
      if (options.verbose) {
        console.log(chalk.blue('🔄 Starting batch diff analysis...'));
        console.log(chalk.gray(`Comparisons: ${config.comparisons.length}`));
        console.log(chalk.gray(`Using preset: ${options.preset}`));
      }

      // Create engine
      const engine = StyleDiffEngineFactory.createEngine(options.preset);

      // Prepare batch comparisons
      const comparisons = config.comparisons.map(comp => ({
        type: 'files' as const,
        file1: comp.file1,
        file2: comp.file2,
        options: { ...config.globalOptions, ...comp.options }
      }));

      // Execute batch comparison
      const results = await engine.batchCompare(comparisons);

      // Process results
      const outputDir = options.outputDir || config.outputDir || './diff-results';
      await fs.ensureDir(outputDir);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const comparison = config.comparisons[i];
        
        const format = this.parseRenderFormat(options.format);
        const rendered = await engine.render(result, format);
        
        const outputFile = path.join(outputDir, `${comparison.name}.${options.format}`);
        await fs.writeFile(outputFile, rendered);
        
        if (options.verbose) {
          console.log(chalk.green(`✓ ${comparison.name}: ${outputFile}`));
        }
      }

      console.log(chalk.green(`🎉 Batch diff completed: ${results.length} comparisons`));

    } catch (error) {
      console.error(chalk.red('❌ Batch diff failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Handle directory diff command
   */
  public static async handleDirectoryDiff(
    dir1: string, 
    dir2: string, 
    options: any
  ): Promise<void> {
    try {
      // Find matching files in both directories
      const pattern = options.pattern || '**/*.scss';
      const [files1, files2] = await Promise.all([
        glob(pattern, { cwd: dir1 }),
        glob(pattern, { cwd: dir2 })
      ]);

      // Find common files
      const commonFiles = files1.filter(file => files2.includes(file));
      const excludePatterns = options.exclude || [];
      
      const filesToCompare = commonFiles.filter(file => {
        return !excludePatterns.some(pattern => file.match(new RegExp(pattern)));
      });

      if (options.verbose) {
        console.log(chalk.blue('📂 Directory diff analysis...'));
        console.log(chalk.gray(`Directory 1: ${dir1} (${files1.length} files)`));
        console.log(chalk.gray(`Directory 2: ${dir2} (${files2.length} files)`));
        console.log(chalk.gray(`Common files to compare: ${filesToCompare.length}`));
      }

      // Create engine
      const engine = StyleDiffEngineFactory.createEngine(options.preset);

      // Prepare comparisons
      const comparisons = filesToCompare.map(file => ({
        type: 'files' as const,
        file1: path.join(dir1, file),
        file2: path.join(dir2, file),
        options: { filePath: file }
      }));

      // Execute comparisons
      const results = await engine.batchCompare(comparisons);

      // Generate summary
      const summary = this.generateDirectoryDiffSummary(results, filesToCompare);

      // Render and output
      const format = this.parseRenderFormat(options.format);
      let output = '';

      if (format === DiffRenderFormat.SUMMARY || options.format === 'summary') {
        output = this.renderDirectorySummary(summary);
      } else {
        // Render individual diffs
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const file = filesToCompare[i];
          
          if (result.chunks.length > 0 || options.includeUnchanged) {
            output += `\n${chalk.bold(`=== ${file} ===`)}\n`;
            output += await engine.render(result, format);
            output += '\n';
          }
        }
      }

      // Output result
      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`✓ Directory diff saved to: ${options.output}`));
      } else {
        console.log(output);
      }

    } catch (error) {
      console.error(chalk.red('❌ Directory diff failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Handle diff analysis command
   */
  public static async handleDiffAnalysis(
    diffFile: string, 
    options: any
  ): Promise<void> {
    try {
      // Load diff result
      const diffResult = await fs.readJson(diffFile);

      // Analyze the diff
      const analysis = this.analyzeDiffResult(diffResult);

      // Generate report
      const report = this.generateAnalysisReport(analysis, options);

      // Output result
      if (options.output) {
        await fs.writeFile(options.output, report);
        console.log(chalk.green(`✓ Analysis saved to: ${options.output}`));
      } else {
        console.log(report);
      }

    } catch (error) {
      console.error(chalk.red('❌ Diff analysis failed:'), error.message);
      process.exit(1);
    }
  }

  // Helper methods
  private static parseRenderFormat(format: string): DiffRenderFormat {
    switch (format.toLowerCase()) {
      case 'terminal': return DiffRenderFormat.TERMINAL;
      case 'json': return DiffRenderFormat.JSON;
      case 'html': return DiffRenderFormat.HTML;
      case 'unified': return DiffRenderFormat.TERMINAL; // Use terminal with unified style
      case 'split': return DiffRenderFormat.TERMINAL; // Use terminal with split style
      case 'summary': return DiffRenderFormat.TERMINAL; // Use terminal with summary style
      default: return DiffRenderFormat.TERMINAL;
    }
  }

  private static generateDirectoryDiffSummary(results: any[], files: string[]): any {
    const changedFiles = results.filter(r => r.chunks.length > 0);
    const unchangedFiles = results.filter(r => r.chunks.length === 0);
    
    return {
      totalFiles: files.length,
      changedFiles: changedFiles.length,
      unchangedFiles: unchangedFiles.length,
      totalChanges: changedFiles.reduce((sum, r) => sum + r.chunks.length, 0),
      changesByType: this.categorizeChanges(changedFiles)
    };
  }

  private static renderDirectorySummary(summary: any): string {
    return `
${chalk.bold('📊 Directory Diff Summary')}

${chalk.green('Files:')}
  Total: ${summary.totalFiles}
  Changed: ${summary.changedFiles}
  Unchanged: ${summary.unchangedFiles}

${chalk.blue('Changes:')}
  Total: ${summary.totalChanges}
  ${Object.entries(summary.changesByType).map(([type, count]) => 
    `  ${type}: ${count}`
  ).join('\n  ')}
`;
  }

  private static categorizeChanges(results: any[]): Record<string, number> {
    // This would categorize changes by type (additions, deletions, modifications, etc.)
    // Implementation depends on the diff result structure
    return {
      additions: 0,
      deletions: 0,
      modifications: 0
    };
  }

  private static analyzeDiffResult(diffResult: any): any {
    // Analyze diff result for patterns, complexity, impact, etc.
    return {
      complexity: 'medium',
      impact: 'low',
      patterns: [],
      recommendations: []
    };
  }

  private static generateAnalysisReport(analysis: any, options: any): string {
    // Generate formatted analysis report
    return JSON.stringify(analysis, null, 2);
  }
}
```

### 3. Configuration File Support

#### Configuration Manager (`src/cli/config-manager.ts`)

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import { StyleDiffEngineConfig } from '../diff/engine-config';

export interface CliConfig {
  defaultPreset: string;
  defaultFormat: string;
  outputDirectory: string;
  colorOutput: boolean;
  verboseMode: boolean;
  engineConfig: Partial<StyleDiffEngineConfig>;
  aliases: Record<string, string>;
}

export class ConfigManager {
  private static readonly CONFIG_FILE = '.nostyledrifting.json';
  
  /**
   * Load configuration from file or use defaults
   */
  public static async loadConfig(configPath?: string): Promise<CliConfig> {
    const configFile = configPath || this.findConfigFile();
    
    if (configFile && await fs.pathExists(configFile)) {
      try {
        const config = await fs.readJson(configFile);
        return { ...this.getDefaultConfig(), ...config };
      } catch (error) {
        console.warn(`Warning: Failed to load config from ${configFile}, using defaults`);
      }
    }
    
    return this.getDefaultConfig();
  }

  /**
   * Save configuration to file
   */
  public static async saveConfig(config: CliConfig, configPath?: string): Promise<void> {
    const configFile = configPath || path.join(process.cwd(), this.CONFIG_FILE);
    await fs.writeJson(configFile, config, { spaces: 2 });
  }

  /**
   * Get default configuration
   */
  public static getDefaultConfig(): CliConfig {
    return {
      defaultPreset: 'balanced',
      defaultFormat: 'terminal',
      outputDirectory: './diff-results',
      colorOutput: true,
      verboseMode: false,
      engineConfig: {
        analysis: {
          contextDepth: 3,
          semanticAnalysis: true,
          includeVariables: true,
          includeImports: true
        },
        output: {
          colorOutput: true,
          lineNumbers: true,
          contextLines: 3
        }
      },
      aliases: {
        'quick': 'fast',
        'detailed': 'thorough'
      }
    };
  }

  /**
   * Find configuration file in current directory or parent directories
   */
  private static findConfigFile(): string | null {
    let dir = process.cwd();
    
    while (dir !== path.dirname(dir)) {
      const configPath = path.join(dir, this.CONFIG_FILE);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
      dir = path.dirname(dir);
    }
    
    return null;
  }
}
```

### 4. Progress and Status Display

#### Progress Handler (`src/cli/progress-handler.ts`)

```typescript
import chalk from 'chalk';

export interface ProgressOptions {
  showProgress: boolean;
  showTiming: boolean;
  showMemory: boolean;
  verbose: boolean;
}

export class ProgressHandler {
  private startTime: number;
  private lastUpdate: number;
  
  constructor(private options: ProgressOptions) {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
  }

  /**
   * Start progress tracking
   */
  public start(message: string): void {
    if (this.options.showProgress) {
      console.log(chalk.blue(`🔍 ${message}`));
    }
  }

  /**
   * Update progress
   */
  public update(current: number, total: number, message?: string): void {
    if (!this.options.showProgress) return;

    const percent = Math.round((current / total) * 100);
    const elapsed = Date.now() - this.startTime;
    const eta = total > 0 ? (elapsed / current) * (total - current) : 0;

    const progressBar = this.createProgressBar(percent);
    const timeInfo = this.options.showTiming ? 
      ` (${this.formatTime(elapsed)} elapsed, ETA: ${this.formatTime(eta)})` : '';
    
    const statusMessage = message ? ` - ${message}` : '';
    
    process.stdout.write(`\r${progressBar} ${percent}%${timeInfo}${statusMessage}`);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Complete progress tracking
   */
  public complete(message: string): void {
    const elapsed = Date.now() - this.startTime;
    const memoryUsage = this.options.showMemory ? 
      ` (Memory: ${this.formatMemory(process.memoryUsage().heapUsed)})` : '';
    
    console.log(chalk.green(`✓ ${message} (${this.formatTime(elapsed)})${memoryUsage}`));
  }

  /**
   * Report error
   */
  public error(message: string, error?: Error): void {
    console.log(); // Ensure we're on a new line
    console.error(chalk.red(`❌ ${message}`));
    
    if (error && this.options.verbose) {
      console.error(chalk.gray(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  /**
   * Show step information
   */
  public step(message: string): void {
    if (this.options.verbose) {
      console.log(chalk.cyan(`  → ${message}`));
    }
  }

  private createProgressBar(percent: number): string {
    const width = 30;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)}MB`;
  }
}
```

### 5. Enhanced Main CLI Integration

#### Updated Main CLI (`src/index.ts` - Enhanced)

```typescript
#!/usr/bin/env node

import { program } from 'commander';
import { GitBranchComparer } from './git-branch-comparer';
import { ScssDiscoveryService } from './scss-discovery';
import { DiffCommandHandler } from './cli/diff-commands';
import { ConfigManager } from './cli/config-manager';
import { ProgressHandler } from './cli/progress-handler';
import chalk from 'chalk';

// Load configuration
let config: any;
(async () => {
  config = await ConfigManager.loadConfig();
})();

// Enhanced main command with diff integration
program
  .name('ng-style-compare')
  .description('Compare Angular styles between git branches with semantic diff analysis')
  .version('1.0.0')
  .argument('<branch1>', 'First branch to compare')
  .argument('<branch2>', 'Second branch to compare')
  .option('--keep-temp', 'Keep temporary directories after comparison')
  .option('--verbose', 'Show detailed output')
  .option('--discover-scss', 'Discover and analyze SCSS files')
  .option('--diff-engine', 'Enable semantic style diff analysis')
  .option('--diff-preset <preset>', 'Use diff engine preset', config?.defaultPreset || 'balanced')
  .option('--diff-format <format>', 'Diff output format', config?.defaultFormat || 'terminal')
  .option('--diff-context <lines>', 'Number of context lines in diff output', '3')
  .option('--export-diff <path>', 'Export diff results to file')
  .option('--semantic-analysis', 'Enable semantic SCSS analysis')
  .option('--include-variables', 'Include variable resolution in diff')
  .option('--include-imports', 'Include import analysis in diff')
  .action(async (branch1: string, branch2: string, options) => {
    const progress = new ProgressHandler({
      showProgress: !options.quiet,
      showTiming: options.verbose,
      showMemory: options.verbose,
      verbose: options.verbose
    });

    try {
      progress.start('Starting branch comparison with diff analysis...');

      // Existing branch comparison logic
      const comparer = new GitBranchComparer({
        keepTemp: options.keepTemp,
        verbose: options.verbose
      });

      const result = await comparer.compare(branch1, branch2);
      
      // SCSS Discovery (if requested)
      if (options.discoverScss) {
        progress.step('Discovering SCSS files...');
        
        const scssService = new ScssDiscoveryService({
          concurrency: 4,
          followSymlinks: false
        });

        const discovery = await scssService.discoverForBranches(
          result.branch1.path,
          branch1,
          result.branch2.path,
          branch2
        );

        // Diff Analysis (if requested)
        if (options.diffEngine) {
          progress.step('Performing semantic diff analysis...');
          
          await performBranchDiffAnalysis(
            discovery,
            result,
            options,
            progress
          );
        }
      }

      progress.complete('Branch comparison completed successfully');

    } catch (error) {
      progress.error('Branch comparison failed', error);
      process.exit(1);
    }
  });

// Add diff-specific commands
program
  .command('diff')
  .description('Perform semantic SCSS diff analysis')
  .argument('<file1>', 'First SCSS file to compare')
  .argument('<file2>', 'Second SCSS file to compare')
  .option('--preset <preset>', 'Engine preset to use', config?.defaultPreset || 'balanced')
  .option('--format <format>', 'Output format', config?.defaultFormat || 'terminal')
  .option('--output <file>', 'Output file (default: stdout)')
  .option('--context <lines>', 'Context lines', '3')
  .option('--semantic', 'Enable semantic analysis')
  .option('--variables', 'Include variable resolution')
  .option('--imports', 'Include import analysis')
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Verbose output')
  .action(DiffCommandHandler.handleFileDiff);

program
  .command('batch-diff')
  .description('Perform batch SCSS file comparisons')
  .argument('<config-file>', 'JSON configuration file with comparison pairs')
  .option('--preset <preset>', 'Engine preset to use', config?.defaultPreset || 'balanced')
  .option('--format <format>', 'Output format', config?.defaultFormat || 'terminal')
  .option('--output-dir <dir>', 'Output directory for results')
  .option('--concurrency <num>', 'Concurrent comparisons', '4')
  .option('--progress', 'Show progress bar')
  .action(DiffCommandHandler.handleBatchDiff);

program
  .command('diff-dir')
  .description('Compare SCSS files between two directories')
  .argument('<dir1>', 'First directory')
  .argument('<dir2>', 'Second directory')
  .option('--pattern <glob>', 'File pattern to match', '**/*.scss')
  .option('--preset <preset>', 'Engine preset to use', config?.defaultPreset || 'balanced')
  .option('--format <format>', 'Output format', 'summary')
  .option('--output <file>', 'Output file')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .option('--include-unchanged', 'Include unchanged files in output')
  .action(DiffCommandHandler.handleDirectoryDiff);

program
  .command('analyze-diff')
  .description('Analyze existing diff results')
  .argument('<diff-file>', 'Diff result file to analyze')
  .option('--format <format>', 'Analysis output format', 'terminal')
  .option('--output <file>', 'Output file')
  .option('--metrics', 'Include performance metrics')
  .option('--summary', 'Show summary only')
  .action(DiffCommandHandler.handleDiffAnalysis);

// Configuration command
program
  .command('config')
  .description('Manage configuration')
  .option('--show', 'Show current configuration')
  .option('--set <key=value...>', 'Set configuration values')
  .option('--reset', 'Reset to default configuration')
  .option('--save <file>', 'Save configuration to file')
  .action(async (options) => {
    if (options.show) {
      console.log(JSON.stringify(config, null, 2));
    }
    // Additional config management logic...
  });

// Helper function for branch diff analysis
async function performBranchDiffAnalysis(
  discovery: any,
  branchResult: any,
  options: any,
  progress: ProgressHandler
): Promise<void> {
  // Implementation for analyzing diffs between discovered SCSS files
  // This would integrate the diff engine with the discovery results
  // and generate comprehensive diff reports for all discovered files
}

// Show help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
```

## Implementation Steps

### Step 1: CLI Command Structure
1. Enhance existing CLI with diff engine options
2. Add new diff-specific commands (diff, batch-diff, diff-dir, analyze-diff)
3. Implement command argument parsing and validation
4. Add configuration file support

### Step 2: Command Handlers
1. Create `DiffCommandHandler` class with methods for each command
2. Implement file, batch, and directory diff handling
3. Add result analysis and reporting
4. Integrate with existing SCSS discovery and Git operations

### Step 3: Configuration Management
1. Implement `ConfigManager` for loading/saving CLI configuration
2. Add support for `.nostyledrifting.json` configuration files
3. Create configuration validation and defaults
4. Add command for configuration management

### Step 4: Progress and Status Display
1. Create `ProgressHandler` for user feedback
2. Implement progress bars, timing, and memory usage display
3. Add verbose mode with detailed step information
4. Integrate error reporting and recovery

### Step 5: Integration and Testing
1. Integrate new commands with existing CLI structure
2. Add comprehensive error handling and validation
3. Test all commands with various options and file types
4. Validate integration with existing NoStyleDrifting components

## Testing Requirements

### Unit Tests (`src/cli/__tests__/`)

```typescript
describe('CLI Integration', () => {
  describe('DiffCommandHandler', () => {
    test('should handle file diff commands correctly');
    test('should process batch diff configurations');
    test('should compare directories successfully');
    test('should analyze diff results');
  });

  describe('ConfigManager', () => {
    test('should load configuration from file');
    test('should use defaults when no config exists');
    test('should save configuration correctly');
    test('should validate configuration values');
  });

  describe('ProgressHandler', () => {
    test('should display progress correctly');
    test('should handle timing and memory reporting');
    test('should format output appropriately');
  });
});
```

### Integration Tests

```typescript
describe('CLI End-to-End', () => {
  test('should execute diff command with all options');
  test('should integrate with existing branch comparison');
  test('should handle configuration files correctly');
  test('should provide appropriate exit codes');
});
```

## Configuration Examples

### CLI Configuration File (`.nostyledrifting.json`)

```json
{
  "defaultPreset": "balanced",
  "defaultFormat": "terminal",
  "outputDirectory": "./diff-results",
  "colorOutput": true,
  "verboseMode": false,
  "engineConfig": {
    "analysis": {
      "contextDepth": 3,
      "semanticAnalysis": true,
      "includeVariables": true,
      "includeImports": true
    },
    "output": {
      "colorOutput": true,
      "lineNumbers": true,
      "contextLines": 3
    },
    "cache": {
      "enabled": true,
      "maxSize": 100
    }
  },
  "aliases": {
    "quick": "fast",
    "detailed": "thorough"
  }
}
```

### Batch Diff Configuration Example

```json
{
  "comparisons": [
    {
      "name": "main-components",
      "file1": "./src/app/component1.scss",
      "file2": "./src/app/component1-updated.scss"
    },
    {
      "name": "theme-variables",
      "file1": "./src/themes/dark.scss",
      "file2": "./src/themes/light.scss",
      "options": {
        "includeVariables": true,
        "semanticAnalysis": true
      }
    }
  ],
  "outputDir": "./diff-results",
  "globalOptions": {
    "contextDepth": 5,
    "includeImports": true
  }
}
```

## Usage Examples

### Basic File Comparison
```bash
# Simple file diff
ng-style-compare diff style1.scss style2.scss

# With semantic analysis and custom output
ng-style-compare diff style1.scss style2.scss --semantic --variables --format html --output diff.html

# Using a specific preset
ng-style-compare diff style1.scss style2.scss --preset thorough --verbose
```

### Branch Comparison with Diff
```bash
# Enhanced branch comparison with diff analysis
ng-style-compare main feature-branch --diff-engine --semantic-analysis --diff-format summary

# Export diff results
ng-style-compare main dev --diff-engine --export-diff ./branch-diff-report.json
```

### Batch and Directory Operations
```bash
# Batch comparison from configuration
ng-style-compare batch-diff batch-config.json --progress --output-dir ./results

# Directory comparison
ng-style-compare diff-dir ./src/styles-v1 ./src/styles-v2 --format summary --output summary.txt

# Exclude certain patterns
ng-style-compare diff-dir ./old ./new --exclude "**/_*.scss" "**/*.min.scss"
```

### Configuration Management
```bash
# Show current configuration
ng-style-compare config --show

# Set default preset
ng-style-compare config --set defaultPreset=thorough

# Reset configuration
ng-style-compare config --reset
```

## Performance Considerations

1. **Command Performance**: Optimize command startup time and responsiveness
2. **Memory Usage**: Monitor memory consumption during large batch operations
3. **Progress Feedback**: Provide meaningful progress information for long operations
4. **Error Recovery**: Graceful handling of failures in batch operations
5. **Configuration Caching**: Cache configuration loading for better performance

## Dependencies

- Existing NoStyleDrifting CLI infrastructure
- Style Diff Engine (Task 7)
- Commander.js for CLI framework
- Chalk for colored output
- fs-extra for file operations
- glob for file pattern matching

## Success Criteria

1. **Functionality**: All CLI commands work correctly with appropriate options
2. **Integration**: Seamless integration with existing NoStyleDrifting commands
3. **Usability**: Intuitive command structure with helpful error messages
4. **Performance**: Responsive interface with appropriate progress feedback
5. **Configuration**: Flexible configuration system with sensible defaults
6. **Documentation**: Clear usage examples and help text

## Next Steps

After Task 8 completion:
- Task 9: Integration with Existing Git Comparer and SCSS Discovery
- Task 10: Testing, Performance Optimization, and Documentation

This CLI integration will provide a comprehensive command-line interface for the Style Diff Engine, making it easily accessible to developers and CI/CD systems while maintaining compatibility with the existing NoStyleDrifting functionality.
