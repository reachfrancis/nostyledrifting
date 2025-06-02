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
