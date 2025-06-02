import { CompareOptions, CompareResult } from './types';
export declare class GitBranchComparer {
    private git;
    private tempDirs;
    private options;
    private projectRoot;
    constructor(options?: CompareOptions);
    compare(branch1: string, branch2: string): Promise<CompareResult>;
    private validateGitRepository;
    private validateBranches;
    private branchExists;
    private getCurrentBranch;
    private createBranchDirectory;
    private copyProjectToTemp;
    private getCommitHash;
    private setupCleanup;
    cleanup(): void;
}
