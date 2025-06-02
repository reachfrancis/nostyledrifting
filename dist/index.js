#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const git_branch_comparer_1 = require("./git-branch-comparer");
const chalk_1 = __importDefault(require("chalk"));
commander_1.program
    .name('ng-style-compare')
    .description('Compare Angular styles between git branches')
    .version('1.0.0')
    .argument('<branch1>', 'First branch to compare')
    .argument('<branch2>', 'Second branch to compare')
    .option('--keep-temp', 'Keep temporary directories after comparison')
    .option('--verbose', 'Show detailed output')
    .action(async (branch1, branch2, options) => {
    try {
        if (options.verbose) {
            console.log(chalk_1.default.blue('🔍 Starting branch comparison...'));
            console.log(chalk_1.default.gray(`Comparing: ${branch1} vs ${branch2}`));
        }
        const comparer = new git_branch_comparer_1.GitBranchComparer({
            keepTemp: options.keepTemp,
            verbose: options.verbose
        });
        const result = await comparer.compare(branch1, branch2);
        console.log(chalk_1.default.green('✓ Branches ready for comparison:'));
        console.log(chalk_1.default.cyan(`  ${branch1} (${result.branch1.commit}): ${result.branch1.path}`));
        console.log(chalk_1.default.cyan(`  ${branch2} (${result.branch2.commit}): ${result.branch2.path}`));
        if (options.keepTemp) {
            console.log(chalk_1.default.yellow('\n📁 Temporary directories preserved for manual inspection'));
        }
        // Here you would continue with the SCSS analysis
        console.log(chalk_1.default.green('\n🎉 Branch comparison setup complete!'));
        console.log(chalk_1.default.gray('Next: SCSS analysis would be performed here...'));
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error.message);
        if (options.verbose && error instanceof Error) {
            console.error(chalk_1.default.gray('Stack trace:'), error.stack);
        }
        process.exit(1);
    }
});
// Add a command to show help if no arguments provided
if (process.argv.length <= 2) {
    commander_1.program.help();
}
commander_1.program.parse();
//# sourceMappingURL=index.js.map