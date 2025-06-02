export declare class GitCompareError extends Error {
    constructor(message: string);
}
export declare class BranchNotFoundError extends GitCompareError {
    constructor(branch: string);
}
export declare class NotGitRepositoryError extends GitCompareError {
    constructor();
}
