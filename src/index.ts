#!/usr/bin/env node

import { program } from 'commander';
import { GitBranchComparer } from './git-branch-comparer';
import { ScssDiscoveryService } from './scss-discovery';
import { DiffCommandHandler } from './cli/diff-commands';
import { ConfigManager, globalConfig } from './cli/config-manager';
import { createProgressHandler } from './cli/progress-handler';
import chalk from 'chalk';

// Initialize global configuration
globalConfig.loadConfig().catch(() => {
  // Ignore config loading errors, use defaults
});

program
  .name('ng-style-compare')
  .description('Compare Angular styles between git branches with advanced diff analysis')
  .version('1.0.0')
  .argument('<branch1>', 'First branch to compare')
  .argument('<branch2>', 'Second branch to compare')
  .option('--keep-temp', 'Keep temporary directories after comparison')
  .option('--verbose', 'Show detailed output')
  .option('--discover-scss', 'Discover and analyze SCSS files')
  .option('--analyze-diff', 'Perform detailed style diff analysis')
  .option('--preset <preset>', 'Diff analysis preset (fast, balanced, thorough, accessibility, performance)', 'balanced')
  .option('--format <format>', 'Output format (terminal, json, html)', 'terminal')
  .option('--output <path>', 'Output directory for diff results')
  .action(async (branch1: string, branch2: string, options) => {
    try {
      if (options.verbose) {
        console.log(chalk.blue('🔍 Starting branch comparison...'));
        console.log(chalk.gray(`Comparing: ${branch1} vs ${branch2}`));
      }

      const comparer = new GitBranchComparer({
        keepTemp: options.keepTemp,
        verbose: options.verbose
      });

      const result = await comparer.compare(branch1, branch2);
        console.log(chalk.green('✓ Branches ready for comparison:'));
      console.log(chalk.cyan(`  ${branch1} (${result.branch1.commit}): ${result.branch1.path}`));
      console.log(chalk.cyan(`  ${branch2} (${result.branch2.commit}): ${result.branch2.path}`));
      
      // SCSS Discovery (Story 1.1)
      if (options.discoverScss) {
        console.log(chalk.blue('\n🎨 Discovering SCSS files...'));
        
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

        console.log(chalk.green('✓ SCSS Discovery completed:'));
        console.log(chalk.cyan(`  Total files found: ${discovery.summary.totalFilesDiscovered}`));
        console.log(chalk.cyan(`  Component mappings: ${discovery.summary.componentMappings}`));
        console.log(chalk.cyan(`  Global styles: ${discovery.summary.globalStyles}`));
        console.log(chalk.cyan(`  Theme files: ${discovery.summary.themes}`));
        console.log(chalk.cyan(`  Partial files: ${discovery.summary.partials}`));
        
        if (discovery.summary.errors.length > 0) {
          console.log(chalk.yellow(`  Warnings: ${discovery.summary.errors.length}`));
          if (options.verbose) {
            discovery.summary.errors.forEach(error => {
              console.log(chalk.yellow(`    ${error.message}`));
            });
          }
        }

        // Show detailed breakdown for each branch
        if (options.verbose) {
          console.log(chalk.blue(`\n📊 ${branch1} Details:`));
          console.log(`  SCSS files: ${discovery.branch1.files.length}`);
          console.log(`  Components: ${discovery.branch1.mappings.length}`);
          console.log(`  Global: ${discovery.branch1.files.filter(f => f.type === 'global').length}`);
          console.log(`  Themes: ${discovery.branch1.files.filter(f => f.type === 'theme').length}`);
          console.log(`  Partials: ${discovery.branch1.files.filter(f => f.type === 'partial').length}`);
          
          console.log(chalk.blue(`\n📊 ${branch2} Details:`));
          console.log(`  SCSS files: ${discovery.branch2.files.length}`);
          console.log(`  Components: ${discovery.branch2.mappings.length}`);
          console.log(`  Global: ${discovery.branch2.files.filter(f => f.type === 'global').length}`);
          console.log(`  Themes: ${discovery.branch2.files.filter(f => f.type === 'theme').length}`);
          console.log(`  Partials: ${discovery.branch2.files.filter(f => f.type === 'partial').length}`);
        }
      }
      
      if (options.keepTemp) {
        console.log(chalk.yellow('\n📁 Temporary directories preserved for manual inspection'));
      }
      
      console.log(chalk.green('\n🎉 Branch comparison setup complete!'));
      
      if (!options.discoverScss) {
        console.log(chalk.gray('💡 Use --discover-scss to analyze SCSS files'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), (error as Error).message);
      
      if (options.verbose && error instanceof Error) {
        console.error(chalk.gray('Stack trace:'), error.stack);
      }
      
      process.exit(1);
    }  });

// Add specific SCSS discovery command
program
  .command('discover')
  .description('Discover SCSS files in project directories')
  .argument('<path>', 'Project path to analyze')
  .option('--verbose', 'Show detailed output')
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action(async (projectPath: string, options) => {
    try {
      console.log(chalk.blue(`🔍 Discovering SCSS files in: ${projectPath}`));
      
      const scssService = new ScssDiscoveryService();
      const discovery = await scssService.discoverForBranches(
        projectPath,
        'current',
        projectPath,
        'current'
      );

      console.log(chalk.green('✓ Discovery completed:'));
      console.log(`  Total SCSS files: ${discovery.branch1.files.length}`);
      console.log(`  Component styles: ${discovery.branch1.files.filter(f => f.type === 'component').length}`);
      console.log(`  Global styles: ${discovery.branch1.files.filter(f => f.type === 'global').length}`);
      console.log(`  Theme files: ${discovery.branch1.files.filter(f => f.type === 'theme').length}`);
      console.log(`  Partial files: ${discovery.branch1.files.filter(f => f.type === 'partial').length}`);
      console.log(`  Custom files: ${discovery.branch1.files.filter(f => f.type === 'custom').length}`);

      if (options.verbose) {
        console.log(chalk.blue('\n📋 File Details:'));
        
        if (options.format === 'json') {
          console.log(JSON.stringify(discovery.branch1, null, 2));
        } else {
          // Table format
          console.table(
            discovery.branch1.files.map(file => ({
              Type: file.type,
              Path: file.relativePath,
              Size: `${(file.size / 1024).toFixed(1)}KB`,
              Imports: file.imports.length,
              'Imported By': file.importedBy.length
            }))
          );
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Add a command to show help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
