#!/usr/bin/env node

import { program } from 'commander';
import { GitBranchComparer } from './git-branch-comparer';
import chalk from 'chalk';

program
  .name('ng-style-compare')
  .description('Compare Angular styles between git branches')
  .version('1.0.0')
  .argument('<branch1>', 'First branch to compare')
  .argument('<branch2>', 'Second branch to compare')
  .option('--keep-temp', 'Keep temporary directories after comparison')
  .option('--verbose', 'Show detailed output')
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
      
      if (options.keepTemp) {
        console.log(chalk.yellow('\n📁 Temporary directories preserved for manual inspection'));
      }
      
      // Here you would continue with the SCSS analysis
      console.log(chalk.green('\n🎉 Branch comparison setup complete!'));
      console.log(chalk.gray('Next: SCSS analysis would be performed here...'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), (error as Error).message);
      
      if (options.verbose && error instanceof Error) {
        console.error(chalk.gray('Stack trace:'), error.stack);
      }
      
      process.exit(1);
    }
  });

// Add a command to show help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
