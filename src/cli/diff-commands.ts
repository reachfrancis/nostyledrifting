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

export interface DirectoryDiffSummary {
  totalFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  totalChanges: number;
  changesByType: Record<string, number>;
  changesByFile: Array<{
    file: string;
    changes: number;
    impact: 'low' | 'medium' | 'high';
  }>;
}

export interface DiffAnalysis {
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  patterns: string[];
  recommendations: string[];
  semanticChanges: Array<{
    type: string;
    description: string;
    severity: 'info' | 'warning' | 'error';
  }>;
}

/**
 * Handles CLI commands for the Style Diff Engine
 */
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

      // Execute batch comparison with progress tracking
      const results = [];
      const total = comparisons.length;

      for (let i = 0; i < total; i++) {
        const comparison = comparisons[i];
        const config_item = config.comparisons[i];
        
        if (options.progress) {
          const percent = Math.round(((i + 1) / total) * 100);
          process.stdout.write(`\r${chalk.blue('Processing:')} ${percent}% (${i + 1}/${total}) - ${config_item.name}`);
        }

        try {
          const result = await engine.compareFiles(
            comparison.file1, 
            comparison.file2, 
            comparison.options
          );
          results.push({ ...result, name: config_item.name });
        } catch (error) {
          console.error(chalk.red(`\n❌ Failed to compare ${config_item.name}: ${error.message}`));
          if (!options.continueOnError) {
            throw error;
          }
        }
      }

      if (options.progress) {
        console.log(); // New line after progress
      }

      // Process results
      const outputDir = options.outputDir || config.outputDir || './diff-results';
      await fs.ensureDir(outputDir);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const comparison = config.comparisons[i];
        
        if (!result) continue; // Skip failed comparisons
        
        const format = this.parseRenderFormat(options.format);
        const rendered = await engine.render(result, format);
        
        const outputFile = path.join(outputDir, `${comparison.name}.${this.getFileExtension(options.format)}`);
        await fs.writeFile(outputFile, rendered);
        
        if (options.verbose) {
          console.log(chalk.green(`✓ ${comparison.name}: ${outputFile}`));
        }
      }

      // Generate summary report
      const summaryFile = path.join(outputDir, 'summary.json');
      const summary = this.generateBatchSummary(results, config.comparisons);
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));

      console.log(chalk.green(`🎉 Batch diff completed: ${results.length}/${total} comparisons successful`));
      console.log(chalk.cyan(`📄 Results saved to: ${outputDir}`));

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
      // Validate directories exist
      await Promise.all([
        fs.access(dir1, fs.constants.F_OK),
        fs.access(dir2, fs.constants.F_OK)
      ]);

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

      if (filesToCompare.length === 0) {
        console.log(chalk.yellow('⚠️  No common SCSS files found to compare'));
        return;
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

      // Execute comparisons with progress
      const results = [];
      const total = comparisons.length;

      for (let i = 0; i < total; i++) {
        const comparison = comparisons[i];
        const file = filesToCompare[i];
        
        if (options.verbose) {
          const percent = Math.round(((i + 1) / total) * 100);
          process.stdout.write(`\r${chalk.blue('Comparing:')} ${percent}% - ${file}`);
        }

        try {
          const result = await engine.compareFiles(
            comparison.file1, 
            comparison.file2, 
            comparison.options
          );
          results.push({ ...result, filePath: file });
        } catch (error) {
          console.error(chalk.red(`\n❌ Failed to compare ${file}: ${error.message}`));
          if (!options.continueOnError) {
            throw error;
          }
        }
      }

      if (options.verbose) {
        console.log(); // New line after progress
      }

      // Generate summary
      const summary = this.generateDirectoryDiffSummary(results, filesToCompare);

      // Render and output
      const format = this.parseRenderFormat(options.format);
      let output = '';

      if (format === DiffRenderFormat.TERMINAL && (options.format === 'summary' || !options.detailed)) {
        output = this.renderDirectorySummary(summary);
      } else {
        // Render individual diffs
        output += this.renderDirectorySummary(summary);
        output += '\n' + chalk.bold('='.repeat(60)) + '\n';
        output += chalk.bold('📋 Detailed File Differences') + '\n';
        output += '='.repeat(60) + '\n';

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const file = filesToCompare[i];
          
          if (result && (result.chunks.length > 0 || options.includeUnchanged)) {
            output += `\n${chalk.bold.blue(`=== ${file} ===`)}\n`;
            const rendered = await engine.render(result, format);
            output += rendered;
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

      // Save detailed results if requested
      if (options.saveResults) {
        const resultsFile = options.output ? 
          options.output.replace(/\.[^.]*$/, '.json') : 
          './directory-diff-results.json';
        
        await fs.writeFile(resultsFile, JSON.stringify({
          summary,
          results: results.map((r, i) => ({ ...r, filePath: filesToCompare[i] }))
        }, null, 2));
        
        console.log(chalk.cyan(`📄 Detailed results saved to: ${resultsFile}`));
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

      if (options.verbose) {
        console.log(chalk.blue('🔍 Analyzing diff results...'));
        console.log(chalk.gray(`Source: ${diffFile}`));
      }

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

      // Show summary metrics
      if (options.metrics) {
        console.log(chalk.blue('\n📊 Analysis Metrics:'));
        console.log(`  Complexity: ${analysis.complexity}`);
        console.log(`  Impact: ${analysis.impact}`);
        console.log(`  Patterns found: ${analysis.patterns.length}`);
        console.log(`  Recommendations: ${analysis.recommendations.length}`);
        console.log(`  Semantic changes: ${analysis.semanticChanges.length}`);
      }

    } catch (error) {
      console.error(chalk.red('❌ Diff analysis failed:'), error.message);
      process.exit(1);
    }
  }

  // Helper methods

  /**
   * Parse render format string to enum
   */
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

  /**
   * Get file extension for output format
   */
  private static getFileExtension(format: string): string {
    switch (format.toLowerCase()) {
      case 'json': return 'json';
      case 'html': return 'html';
      default: return 'txt';
    }
  }

  /**
   * Generate batch comparison summary
   */
  private static generateBatchSummary(results: any[], comparisons: any[]): any {
    const successful = results.filter(r => r).length;
    const failed = results.length - successful;
    const totalChanges = results.reduce((sum, r) => r ? sum + (r.chunks?.length || 0) : sum, 0);

    return {
      timestamp: new Date().toISOString(),
      totalComparisons: comparisons.length,
      successful,
      failed,
      totalChanges,
      comparisons: comparisons.map((comp, i) => ({
        name: comp.name,
        file1: comp.file1,
        file2: comp.file2,
        status: results[i] ? 'success' : 'failed',
        changes: results[i]?.chunks?.length || 0
      }))
    };
  }

  /**
   * Generate directory diff summary
   */
  private static generateDirectoryDiffSummary(results: any[], files: string[]): DirectoryDiffSummary {
    const validResults = results.filter(r => r);
    const changedFiles = validResults.filter(r => r.chunks && r.chunks.length > 0);
    const unchangedFiles = validResults.filter(r => !r.chunks || r.chunks.length === 0);
    
    const changesByFile = changedFiles.map((result, i) => {
      const changes = result.chunks?.length || 0;
      return {
        file: result.filePath || files[results.indexOf(result)],
        changes,
        impact: this.calculateChangeImpact(changes)
      };
    });

    return {
      totalFiles: files.length,
      changedFiles: changedFiles.length,
      unchangedFiles: unchangedFiles.length,
      totalChanges: changedFiles.reduce((sum, r) => sum + (r.chunks?.length || 0), 0),
      changesByType: this.categorizeChanges(changedFiles),
      changesByFile
    };
  }

  /**
   * Calculate impact level based on number of changes
   */
  private static calculateChangeImpact(changes: number): 'low' | 'medium' | 'high' {
    if (changes <= 2) return 'low';
    if (changes <= 10) return 'medium';
    return 'high';
  }

  /**
   * Render directory summary
   */
  private static renderDirectorySummary(summary: DirectoryDiffSummary): string {
    const impactColor = (impact: string) => {
      switch (impact) {
        case 'high': return chalk.red;
        case 'medium': return chalk.yellow;
        default: return chalk.green;
      }
    };

    let output = chalk.bold('📊 Directory Diff Summary') + '\n';
    output += '='.repeat(30) + '\n\n';

    output += chalk.green('Files:\n');
    output += `  Total: ${summary.totalFiles}\n`;
    output += `  Changed: ${chalk.yellow(summary.changedFiles)}\n`;
    output += `  Unchanged: ${chalk.green(summary.unchangedFiles)}\n\n`;

    output += chalk.blue('Changes:\n');
    output += `  Total: ${summary.totalChanges}\n`;
    
    Object.entries(summary.changesByType).forEach(([type, count]) => {
      output += `  ${type}: ${count}\n`;
    });

    if (summary.changesByFile.length > 0) {
      output += '\n' + chalk.bold('Changed Files:') + '\n';
      summary.changesByFile
        .sort((a, b) => b.changes - a.changes)
        .slice(0, 10) // Show top 10 most changed files
        .forEach(file => {
          const impactStr = impactColor(file.impact)(file.impact.toUpperCase());
          output += `  ${file.file}: ${file.changes} changes [${impactStr}]\n`;
        });

      if (summary.changesByFile.length > 10) {
        output += `  ... and ${summary.changesByFile.length - 10} more files\n`;
      }
    }

    return output;
  }

  /**
   * Categorize changes by type
   */
  private static categorizeChanges(results: any[]): Record<string, number> {
    // This would categorize changes by type based on diff analysis
    // For now, providing basic categorization
    return {
      additions: results.reduce((sum, r) => sum + (r.additions || 0), 0),
      deletions: results.reduce((sum, r) => sum + (r.deletions || 0), 0),
      modifications: results.reduce((sum, r) => sum + (r.modifications || 0), 0)
    };
  }

  /**
   * Analyze diff result for patterns, complexity, and impact
   */
  private static analyzeDiffResult(diffResult: any): DiffAnalysis {
    const chunks = diffResult.chunks || [];
    const totalChanges = chunks.length;
    
    // Analyze complexity
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (totalChanges > 20) complexity = 'high';
    else if (totalChanges > 5) complexity = 'medium';

    // Analyze impact
    let impact: 'low' | 'medium' | 'high' = 'low';
    const hasVariableChanges = chunks.some(chunk => 
      chunk.content && chunk.content.includes('$')
    );
    const hasImportChanges = chunks.some(chunk => 
      chunk.content && chunk.content.includes('@import')
    );
    
    if (hasVariableChanges || hasImportChanges) impact = 'high';
    else if (totalChanges > 10) impact = 'medium';

    // Identify patterns
    const patterns = [];
    if (hasVariableChanges) patterns.push('Variable modifications detected');
    if (hasImportChanges) patterns.push('Import structure changes detected');
    if (chunks.some(c => c.content?.includes('@media'))) patterns.push('Media query changes detected');
    if (chunks.some(c => c.content?.includes('color'))) patterns.push('Color changes detected');

    // Generate recommendations
    const recommendations = [];
    if (complexity === 'high') {
      recommendations.push('Consider breaking down large changes into smaller, focused commits');
    }
    if (hasVariableChanges) {
      recommendations.push('Review variable changes for potential global impact');
    }
    if (impact === 'high') {
      recommendations.push('Test thoroughly across different components and breakpoints');
    }

    // Identify semantic changes
    const semanticChanges = [];
    if (hasVariableChanges) {
      semanticChanges.push({
        type: 'variable_modification',
        description: 'SCSS variables have been modified',
        severity: 'warning' as const
      });
    }
    if (hasImportChanges) {
      semanticChanges.push({
        type: 'import_structure',
        description: 'Import structure has been changed',
        severity: 'error' as const
      });
    }

    return {
      complexity,
      impact,
      patterns,
      recommendations,
      semanticChanges
    };
  }

  /**
   * Generate formatted analysis report
   */
  private static generateAnalysisReport(analysis: DiffAnalysis, options: any): string {
    if (options.format === 'json') {
      return JSON.stringify(analysis, null, 2);
    }

    // Terminal format
    let report = chalk.bold('🔍 Diff Analysis Report') + '\n';
    report += '='.repeat(30) + '\n\n';

    // Overview
    report += chalk.blue('Overview:\n');
    report += `  Complexity: ${this.formatComplexity(analysis.complexity)}\n`;
    report += `  Impact: ${this.formatImpact(analysis.impact)}\n\n`;

    // Patterns
    if (analysis.patterns.length > 0) {
      report += chalk.green('Patterns Detected:\n');
      analysis.patterns.forEach(pattern => {
        report += `  • ${pattern}\n`;
      });
      report += '\n';
    }

    // Semantic changes
    if (analysis.semanticChanges.length > 0) {
      report += chalk.yellow('Semantic Changes:\n');
      analysis.semanticChanges.forEach(change => {
        const severityColor = change.severity === 'error' ? chalk.red : 
                            change.severity === 'warning' ? chalk.yellow : chalk.blue;
        report += `  ${severityColor('●')} ${change.description} [${change.severity.toUpperCase()}]\n`;
      });
      report += '\n';
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      report += chalk.cyan('Recommendations:\n');
      analysis.recommendations.forEach(rec => {
        report += `  💡 ${rec}\n`;
      });
    }

    return report;
  }

  /**
   * Format complexity with colors
   */
  private static formatComplexity(complexity: string): string {
    switch (complexity) {
      case 'high': return chalk.red(complexity.toUpperCase());
      case 'medium': return chalk.yellow(complexity.toUpperCase());
      default: return chalk.green(complexity.toUpperCase());
    }
  }

  /**
   * Format impact with colors
   */
  private static formatImpact(impact: string): string {
    switch (impact) {
      case 'high': return chalk.red(impact.toUpperCase());
      case 'medium': return chalk.yellow(impact.toUpperCase());
      default: return chalk.green(impact.toUpperCase());
    }
  }
}
