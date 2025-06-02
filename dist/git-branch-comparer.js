"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitBranchComparer = void 0;
const simple_git_1 = require("simple-git");
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
const errors_1 = require("./errors");
class GitBranchComparer {
    git;
    tempDirs = [];
    options;
    projectRoot;
    constructor(options = {}) {
        this.options = options;
        this.projectRoot = process.cwd();
        this.git = (0, simple_git_1.simpleGit)(this.projectRoot);
        this.setupCleanup();
    }
    async compare(branch1, branch2) {
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
    async validateGitRepository() {
        const isRepo = await this.git.checkIsRepo();
        if (!isRepo) {
            throw new errors_1.NotGitRepositoryError();
        }
    }
    async validateBranches(branch1, branch2) {
        if (branch1 === branch2) {
            throw new Error('Branch names must be different');
        }
        const branches = await this.git.branchLocal();
        const allBranches = branches.all;
        // Also check remote branches
        try {
            const remoteBranches = await this.git.branch(['-r']);
            allBranches.push(...remoteBranches.all);
        }
        catch (error) {
            // Continue if remote branch listing fails
            if (this.options.verbose) {
                console.log('Warning: Could not list remote branches');
            }
        }
        if (!this.branchExists(branch1, allBranches)) {
            throw new errors_1.BranchNotFoundError(branch1);
        }
        if (!this.branchExists(branch2, allBranches)) {
            throw new errors_1.BranchNotFoundError(branch2);
        }
    }
    branchExists(branch, branches) {
        return branches.some(b => b === branch ||
            b.endsWith(`/${branch}`) || // For remote branches like origin/main
            b === `remotes/origin/${branch}`);
    }
    async getCurrentBranch() {
        try {
            const status = await this.git.status();
            return status.current;
        }
        catch {
            return null;
        }
    }
    async createBranchDirectory(branch) {
        const tempDir = path.join(os.tmpdir(), 'ng-style-compare', `${branch.replace(/[^a-zA-Z0-9-]/g, '_')}-${(0, uuid_1.v4)().substring(0, 8)}`);
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
        }
        catch (error) {
            throw new Error(`Failed to create directory for branch ${branch}: ${error.message}`);
        }
        return tempDir;
    }
    async copyProjectToTemp(tempDir) {
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
                }
                catch (error) {
                    if (this.options.verbose) {
                        console.log(`Warning: Could not copy ${item}: ${error.message}`);
                    }
                }
            }
        }
    }
    async getCommitHash(branch) {
        try {
            const commit = await this.git.revparse([branch]);
            return commit.trim().substring(0, 7);
        }
        catch (error) {
            return 'unknown';
        }
    }
    setupCleanup() {
        const cleanup = () => {
            if (!this.options.keepTemp) {
                this.tempDirs.forEach(dir => {
                    try {
                        fs.removeSync(dir);
                        if (this.options.verbose) {
                            console.log(`Cleaned up: ${dir}`);
                        }
                    }
                    catch (error) {
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
    cleanup() {
        if (!this.options.keepTemp) {
            this.tempDirs.forEach(dir => {
                try {
                    fs.removeSync(dir);
                    if (this.options.verbose) {
                        console.log(`Cleaned up: ${dir}`);
                    }
                }
                catch (error) {
                    if (this.options.verbose) {
                        console.error(`Failed to cleanup ${dir}:`, error);
                    }
                }
            });
            this.tempDirs = [];
        }
    }
}
exports.GitBranchComparer = GitBranchComparer;
//# sourceMappingURL=git-branch-comparer.js.map