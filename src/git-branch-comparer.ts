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
      throw new NotGitRepositoryError();
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
      // For Windows compatibility, we'll use a simpler approach
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
    } catch (error) {
      throw new Error(`Failed to create directory for branch ${branch}: ${(error as Error).message}`);
    }

    return tempDir;
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
