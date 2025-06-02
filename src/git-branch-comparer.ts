import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { CompareOptions, CompareResult } from './types';
import { NotGitRepositoryError, BranchNotFoundError } from './errors';

export class GitBranchComparer {
  private git: SimpleGit;
  private tempDirs: string[] = [];
  private options: CompareOptions;
  private projectRoot: string;

  constructor(options: CompareOptions = {}) {
    this.options = options;
    this.projectRoot = process.cwd();
    this.git = simpleGit(this.projectRoot);
    this.setupCleanup();
  }
  async compare(branch1: string, branch2: string): Promise<CompareResult> {
    // 1. Validate we're in a git repository
    await this.validateGitRepository();

    // 2. Validate both branches exist
    await this.validateBranches(branch1, branch2);

    // 3. Get current branch to restore later
    const currentBranch = await this.getCurrentBranch();

    // 4. Create temp directories for each branch sequentially to avoid index.lock conflicts
    // Running these in parallel can cause Git index conflicts
    if (this.options.verbose) {
      console.log('Creating branch directories sequentially to avoid Git conflicts...');
    }
    
    const dir1 = await this.createBranchDirectory(branch1);
    const dir2 = await this.createBranchDirectory(branch2);

    // 5. Restore original branch (only if we're not using git archive)
    if (currentBranch && currentBranch !== branch1 && currentBranch !== branch2) {
      try {
        await this.git.checkout(currentBranch);
      } catch (error) {
        if (this.options.verbose) {
          console.log('Warning: Could not restore original branch:', error);
        }
      }
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
      throw new NotGitRepositoryError();
    }

    // Check for and clean up stale lock files before starting
    await this.cleanupStaleLockFiles();
  }

  private async cleanupStaleLockFiles(): Promise<void> {
    const lockPath = path.join(this.projectRoot, '.git', 'index.lock');
    
    try {
      if (await fs.pathExists(lockPath)) {
        // Check if lock file is stale (older than 5 minutes)
        const stats = await fs.stat(lockPath);
        const now = new Date();
        const lockAge = now.getTime() - stats.mtime.getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (lockAge > fiveMinutes) {
          await fs.remove(lockPath);
          if (this.options.verbose) {
            console.log('Removed stale Git index.lock file');
          }
        } else if (this.options.verbose) {
          console.log('Git index.lock file exists but appears to be in use');
        }
      }
    } catch (error) {
      // Ignore cleanup errors - they're not critical
      if (this.options.verbose) {
        console.log('Could not check/cleanup index.lock file:', error);
      }
    }
  }

  private async validateBranches(branch1: string, branch2: string): Promise<void> {
    if (branch1 === branch2) {
      throw new Error('Branch names must be different');
    }

    const branches = await this.git.branchLocal();
    const allBranches = branches.all;

    // Also check remote branches
    try {
      const remoteBranches = await this.git.branch(['-r']);
      allBranches.push(...remoteBranches.all);
    } catch (error) {
      // Continue if remote branch listing fails
      if (this.options.verbose) {
        console.log('Warning: Could not list remote branches');
      }
    }

    if (!this.branchExists(branch1, allBranches)) {
      throw new BranchNotFoundError(branch1);
    }

    if (!this.branchExists(branch2, allBranches)) {
      throw new BranchNotFoundError(branch2);
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
    const tempDir = path.join(os.tmpdir(), 'ng-style-compare', `${branch.replace(/[^a-zA-Z0-9-]/g, '_')}-${uuidv4().substring(0, 8)}`);
    await fs.ensureDir(tempDir);
    this.tempDirs.push(tempDir);

    if (this.options.verbose) {
      console.log(`Creating temporary directory for ${branch}...`);
    }

    try {
      // Use git archive to safely extract branch content without checkout
      // This avoids .git/index.lock conflicts from concurrent checkout operations
      await this.extractBranchToTemp(branch, tempDir);
    } catch (error) {
      throw new Error(`Failed to create directory for branch ${branch}: ${(error as Error).message}`);
    }

    return tempDir;
  }

  private async extractBranchToTemp(branch: string, tempDir: string): Promise<void> {
    try {
      // Try using git archive first (safest method)
      const archivePath = path.join(tempDir, 'archive.tar');
      
      if (this.options.verbose) {
        console.log(`Extracting ${branch} using git archive...`);
      }

      // Create archive from branch
      await this.git.raw([
        'archive',
        '--format=tar',
        '--output=' + archivePath,
        branch
      ]);

      // Extract archive
      await this.git.raw([
        'tar',
        '-xf',
        archivePath,
        '-C',
        tempDir
      ]);

      // Clean up archive file
      await fs.remove(archivePath);

    } catch (archiveError) {
      // Fallback to checkout method with proper locking
      if (this.options.verbose) {
        console.log(`Archive failed, falling back to checkout method...`);
      }
      await this.fallbackCheckoutMethod(branch, tempDir);
    }
  }

  private async fallbackCheckoutMethod(branch: string, tempDir: string): Promise<void> {
    // Add retry logic with exponential backoff for index.lock conflicts
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait before retry (exponential backoff)
        if (attempt > 1) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 2s, 4s, 8s
          if (this.options.verbose) {
            console.log(`Waiting ${delay}ms before retry (attempt ${attempt}/${maxRetries})...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Save current branch
        const currentBranch = await this.getCurrentBranch();
        
        // Checkout the target branch
        await this.git.checkout(branch);
        
        // Copy the entire project to temp directory
        await this.copyProjectToTemp(tempDir);
        
        // Restore original branch if needed
        if (currentBranch && currentBranch !== branch) {
          await this.git.checkout(currentBranch);
        }

        // Success - break out of retry loop
        return;

      } catch (error) {
        lastError = error as Error;
        
        if (this.options.verbose) {
          console.log(`Attempt ${attempt} failed: ${lastError.message}`);
        }

        // Check if it's an index.lock error
        if (lastError.message.includes('index.lock')) {
          // Try to clean up the lock file
          const lockPath = path.join(this.projectRoot, '.git', 'index.lock');
          try {
            if (await fs.pathExists(lockPath)) {
              await fs.remove(lockPath);
              if (this.options.verbose) {
                console.log('Removed stale index.lock file');
              }
            }
          } catch (lockError) {
            if (this.options.verbose) {
              console.log('Could not remove index.lock file:', lockError);
            }
          }
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }
  }

  private async copyProjectToTemp(tempDir: string): Promise<void> {
    // Copy all files except git directory and node_modules
    const sourceDir = this.projectRoot;
    const excludePatterns = ['.git', 'node_modules', 'dist', '.angular'];
    
    const items = await fs.readdir(sourceDir);
    
    for (const item of items) {
      if (!excludePatterns.includes(item)) {
        const sourcePath = path.join(sourceDir, item);
        const destPath = path.join(tempDir, item);
        
        try {
          await fs.copy(sourcePath, destPath);
        } catch (error) {
          if (this.options.verbose) {
            console.log(`Warning: Could not copy ${item}: ${(error as Error).message}`);
          }
        }
      }
    }
  }

  private async getCommitHash(branch: string): Promise<string> {
    try {
      const commit = await this.git.revparse([branch]);
      return commit.trim().substring(0, 7);
    } catch (error) {
      return 'unknown';
    }
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
            if (this.options.verbose) {
              console.error(`Failed to cleanup ${dir}:`, error);
            }
          }
        });
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit();
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit();
    });
  }

  public cleanup(): void {
    if (!this.options.keepTemp) {
      this.tempDirs.forEach(dir => {
        try {
          fs.removeSync(dir);
          if (this.options.verbose) {
            console.log(`Cleaned up: ${dir}`);
          }
        } catch (error) {
          if (this.options.verbose) {
            console.error(`Failed to cleanup ${dir}:`, error);
          }
        }
      });
      this.tempDirs = [];
    }
  }
}
