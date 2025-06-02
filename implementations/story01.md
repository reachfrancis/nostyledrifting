# Simplified Git Branch Comparison - Run Inside Angular Project

## Overview
Since the tool will run inside the Angular project, we can eliminate most of the complexity around repository discovery, authentication, and remote handling. The tool simply needs to checkout different branches and create temporary directories for comparison.

## Simplified Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Interface (Minimal)                       │
│                         branch1, branch2                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────────┐
│                    Branch Validator                              │
│              (Verify branches exist locally)                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────────┐
│                  Git Checkout Manager                            │
│            (Create temp dirs with branch content)               │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────────┐
│                    Cleanup Handler                               │
│                 (Remove temp directories)                        │
└──────────────────────────────────────────────────────────────────┘
```

## Core Implementation

### 1. Main Entry Point
```typescript
// src/index.ts
#!/usr/bin/env node

import { program } from 'commander';
import { GitBranchComparer } from './git-branch-comparer';
import * as chalk from 'chalk';

program
  .name('ng-style-compare')
  .description('Compare Angular styles between git branches')
  .argument('<branch1>', 'First branch to compare')
  .argument('<branch2>', 'Second branch to compare')
  .option('--keep-temp', 'Keep temporary directories after comparison')
  .option('--verbose', 'Show detailed output')
  .action(async (branch1: string, branch2: string, options) => {
    try {
      const comparer = new GitBranchComparer({
        keepTemp: options.keepTemp,
        verbose: options.verbose
      });

      const result = await comparer.compare(branch1, branch2);
      
      console.log(chalk.green('✓ Branches ready for comparison:'));
      console.log(`  ${branch1}: ${result.branch1.path}`);
      console.log(`  ${branch2}: ${result.branch2.path}`);
      
      // Here you would continue with the SCSS analysis
      
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
```

### 2. Core Comparison Class
```typescript
// src/git-branch-comparer.ts
import * as simpleGit from 'simple-git';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface CompareOptions {
  keepTemp?: boolean;
  verbose?: boolean;
}

export interface CompareResult {
  branch1: {
    name: string;
    path: string;
    commit: string;
  };
  branch2: {
    name: string;
    path: string;
    commit: string;
  };
}

export class GitBranchComparer {
  private git: simpleGit.SimpleGit;
  private tempDirs: string[] = [];
  private options: CompareOptions;
  private projectRoot: string;

  constructor(options: CompareOptions = {}) {
    this.options = options;
    this.projectRoot = process.cwd();
    this.git = simpleGit.simpleGit(this.projectRoot);
    this.setupCleanup();
  }

  async compare(branch1: string, branch2: string): Promise<CompareResult> {
    // 1. Validate we're in a git repository
    await this.validateGitRepository();

    // 2. Validate both branches exist
    await this.validateBranches(branch1, branch2);

    // 3. Get current branch to restore later
    const currentBranch = await this.getCurrentBranch();

    // 4. Create temp directories for each branch
    const [dir1, dir2] = await Promise.all([
      this.createBranchDirectory(branch1),
      this.createBranchDirectory(branch2)
    ]);

    // 5. Restore original branch
    if (currentBranch && currentBranch !== branch1 && currentBranch !== branch2) {
      await this.git.checkout(currentBranch);
    }

    // 6. Get commit info
    const [commit1, commit2] = await Promise.all([
      this.getCommitHash(branch1),
      this.getCommitHash(branch2)
    ]);

    return {
      branch1: { name: branch1, path: dir1, commit: commit1 },
      branch2: { name: branch2, path: dir2, commit: commit2 }
    };
  }

  private async validateGitRepository(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Not a git repository. Please run this command from within your Angular project.');
    }
  }

  private async validateBranches(branch1: string, branch2: string): Promise<void> {
    if (branch1 === branch2) {
      throw new Error('Branch names must be different');
    }

    const branches = await this.git.branchLocal();
    const allBranches = branches.all;

    // Also check remote branches
    const remoteBranches = await this.git.branch(['-r']);
    allBranches.push(...remoteBranches.all);

    if (!this.branchExists(branch1, allBranches)) {
      throw new Error(`Branch '${branch1}' not found. Run 'git fetch' if it's a remote branch.`);
    }

    if (!this.branchExists(branch2, allBranches)) {
      throw new Error(`Branch '${branch2}' not found. Run 'git fetch' if it's a remote branch.`);
    }
  }

  private branchExists(branch: string, branches: string[]): boolean {
    return branches.some(b => 
      b === branch || 
      b.endsWith(`/${branch}`) || // For remote branches like origin/main
      b === `remotes/origin/${branch}`
    );
  }

  private async getCurrentBranch(): Promise<string | null> {
    try {
      const status = await this.git.status();
      return status.current;
    } catch {
      return null;
    }
  }

  private async createBranchDirectory(branch: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'ng-style-compare', `${branch}-${uuidv4().substring(0, 8)}`);
    await fs.ensureDir(tempDir);
    this.tempDirs.push(tempDir);

    if (this.options.verbose) {
      console.log(`Creating temporary directory for ${branch}...`);
    }

    // Use git archive to export the branch content
    // This is much faster than checkout + copy
    await this.git.raw([
      'archive',
      branch,
      '--format=tar',
      '--output=' + path.join(tempDir, 'archive.tar')
    ]);

    // Extract the archive
    await this.git.raw([
      'tar',
      '-xf',
      path.join(tempDir, 'archive.tar'),
      '-C',
      tempDir
    ]);

    // Remove the archive file
    await fs.remove(path.join(tempDir, 'archive.tar'));

    return tempDir;
  }

  private async getCommitHash(branch: string): Promise<string> {
    const commit = await this.git.revparse([branch]);
    return commit.trim().substring(0, 7);
  }

  private setupCleanup(): void {
    const cleanup = () => {
      if (!this.options.keepTemp) {
        this.tempDirs.forEach(dir => {
          try {
            fs.removeSync(dir);
            if (this.options.verbose) {
              console.log(`Cleaned up: ${dir}`);
            }
          } catch (error) {
            console.error(`Failed to cleanup ${dir}:`, error);
          }
        });
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit();
    });
  }
}
```

### 3. Simplified Types
```typescript
// src/types.ts
export interface BranchInfo {
  name: string;
  path: string;
  commit: string;
}

export interface ComparisonResult {
  branch1: BranchInfo;
  branch2: BranchInfo;
}
```

### 4. Error Handling
```typescript
// src/errors.ts
export class GitCompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitCompareError';
  }
}

export class BranchNotFoundError extends GitCompareError {
  constructor(branch: string) {
    super(`Branch '${branch}' not found. Try running 'git fetch' first.`);
  }
}

export class NotGitRepositoryError extends GitCompareError {
  constructor() {
    super('Not a git repository. Please run this command from within your Angular project.');
  }
}
```

## Usage Examples

```bash
# From within your Angular project directory:

# Compare two local branches
ng-style-compare main feature/new-ui

# Compare with a remote branch (after git fetch)
ng-style-compare main origin/feature/new-ui

# Compare tags
ng-style-compare v1.0.0 v2.0.0

# With options
ng-style-compare main develop --verbose --keep-temp

# Compare current branch with another
ng-style-compare HEAD feature/new-styles
```

## Simplified package.json

```json
{
  "name": "ng-style-compare",
  "version": "1.0.0",
  "description": "Compare Angular styles between git branches",
  "bin": {
    "ng-style-compare": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "simple-git": "^3.19.1",
    "fs-extra": "^11.1.1",
    "chalk": "^5.3.0",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/fs-extra": "^11.0.2",
    "typescript": "^5.2.2",
    "ts-node": "^10.9.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1"
  }
}
```

## Simplified tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Key Simplifications

1. **No Repository Management**: Since we're running inside the project, we don't need to handle repo paths or URLs
2. **No Authentication**: Working with local repository means Git uses existing credentials
3. **No Complex Validation**: Just check if branches exist locally or as remotes
4. **Simplified CLI**: Just two arguments (branch names) with minimal options
5. **Faster Export**: Using `git archive` instead of clone for better performance
6. **Minimal Dependencies**: Only essential packages needed

## Installation and Usage

```bash
# Install globally
npm install -g ng-style-compare

# Or run directly with npx from within your Angular project
cd /path/to/your/angular-project
npx ng-style-compare main feature/new-ui

# Or add as a dev dependency to your project
npm install --save-dev ng-style-compare

# Then add to package.json scripts
{
  "scripts": {
    "style:compare": "ng-style-compare"
  }
}

# Run with npm
npm run style:compare main develop
```

## Benefits of This Approach

1. **Simplicity**: Minimal configuration and setup required
2. **Speed**: Uses `git archive` which is much faster than cloning
3. **Local First**: Works with your existing Git setup
4. **Lightweight**: Minimal dependencies and code
5. **Project Context**: Runs in the context of your Angular project

This simplified version is much easier to implement and use while still providing all the core functionality needed for comparing branches within an Angular project.