"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotGitRepositoryError = exports.BranchNotFoundError = exports.GitCompareError = void 0;
class GitCompareError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GitCompareError';
    }
}
exports.GitCompareError = GitCompareError;
class BranchNotFoundError extends GitCompareError {
    constructor(branch) {
        super(`Branch '${branch}' not found. Try running 'git fetch' first.`);
    }
}
exports.BranchNotFoundError = BranchNotFoundError;
class NotGitRepositoryError extends GitCompareError {
    constructor() {
        super('Not a git repository. Please run this command from within your Angular project.');
    }
}
exports.NotGitRepositoryError = NotGitRepositoryError;
//# sourceMappingURL=errors.js.map