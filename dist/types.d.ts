export interface BranchInfo {
    name: string;
    path: string;
    commit: string;
}
export interface ComparisonResult {
    branch1: BranchInfo;
    branch2: BranchInfo;
}
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
