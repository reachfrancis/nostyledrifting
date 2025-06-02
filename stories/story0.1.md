### Story 0.1: Git Branch Comparison Setup
**As a** developer  
**I want to** specify two Git branches to compare  
**So that** I can analyze style changes between different versions of my Angular project

**Acceptance Criteria:**
- Accept project repository path as input
- Accept two branch names (e.g., 'main' and 'feature/update-styles')
- Validate that both branches exist in the repository
- Clone/checkout each branch into separate temporary directories
- Handle authentication for private repositories
- Support both local and remote repositories
- Clean up temporary directories after analysis
- Provide option to use existing directories instead of branches

**Technical Notes:**
- Use Git CLI or NodeGit for repository operations
- Implement secure credential handling
- Support SSH and HTTPS authentication
- Handle large repositories efficiently with shallow clones
- Preserve directory structure for accurate path mapping

**CLI Example:**
```bash
ng-style-compare --repo /path/to/angular-project --branch1 main --branch2 feature/new-ui
# OR
ng-style-compare --url https://github.com/org/repo.git --branch1 v1.0.0 --branch2 v2.0.0
```

---