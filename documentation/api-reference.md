# API Reference

## Classes

### GitBranchComparer

The main class for comparing Git branches and creating temporary directories.

```typescript
class GitBranchComparer {
  constructor(options?: CompareOptions)
  compare(branch1: string, branch2: string): Promise<CompareResult>
  cleanup(): void
}
```

#### Constructor

```typescript
constructor(options?: CompareOptions)
```

Creates a new GitBranchComparer instance.

**Parameters:**
- `options` (optional): Configuration options

**Example:**
```typescript
const comparer = new GitBranchComparer({
  keepTemp: false,
  verbose: true
});
```

#### Methods

##### compare()

```typescript
async compare(branch1: string, branch2: string): Promise<CompareResult>
```

Compares two Git branches by creating temporary directories with their content.

**Parameters:**
- `branch1` (string): Name of the first branch to compare
- `branch2` (string): Name of the second branch to compare

**Returns:** Promise<CompareResult>

**Throws:**
- `NotGitRepositoryError`: When not in a Git repository
- `BranchNotFoundError`: When a specified branch doesn't exist
- `Error`: When branch names are identical

**Example:**
```typescript
try {
  const result = await comparer.compare('main', 'feature/new-ui');
  console.log('Branch 1:', result.branch1.path);
  console.log('Branch 2:', result.branch2.path);
} catch (error) {
  console.error('Comparison failed:', error.message);
}
```

##### cleanup()

```typescript
cleanup(): void
```

Manually cleans up temporary directories. Called automatically unless `keepTemp` option is true.

**Example:**
```typescript
comparer.cleanup(); // Removes all temporary directories
```

## Interfaces

### CompareOptions

Configuration options for GitBranchComparer.

```typescript
interface CompareOptions {
  keepTemp?: boolean;
  verbose?: boolean;
}
```

**Properties:**
- `keepTemp` (optional, boolean): Keep temporary directories after comparison. Default: false
- `verbose` (optional, boolean): Enable detailed logging. Default: false

### CompareResult

Result object returned by the compare() method.

```typescript
interface CompareResult {
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
```

**Properties:**
- `branch1.name`: Name of the first branch
- `branch1.path`: Absolute path to temporary directory containing first branch content
- `branch1.commit`: Short commit hash (7 characters) of the first branch
- `branch2.name`: Name of the second branch  
- `branch2.path`: Absolute path to temporary directory containing second branch content
- `branch2.commit`: Short commit hash (7 characters) of the second branch

### BranchInfo

Information about a single branch.

```typescript
interface BranchInfo {
  name: string;
  path: string;
  commit: string;
}
```

**Properties:**
- `name`: Branch name
- `path`: Temporary directory path
- `commit`: Short commit hash

## Error Classes

### GitCompareError

Base error class for all Git comparison errors.

```typescript
class GitCompareError extends Error {
  constructor(message: string)
}
```

### BranchNotFoundError

Thrown when a specified branch cannot be found.

```typescript
class BranchNotFoundError extends GitCompareError {
  constructor(branch: string)
}
```

**Example:**
```typescript
try {
  await comparer.compare('main', 'invalid-branch');
} catch (error) {
  if (error instanceof BranchNotFoundError) {
    console.log('Branch not found, try: git fetch');
  }
}
```

### NotGitRepositoryError

Thrown when the tool is not run from within a Git repository.

```typescript
class NotGitRepositoryError extends GitCompareError {
  constructor()
}
```

## CLI Interface

### Command

```bash
ng-style-compare <branch1> <branch2> [options]
```

### Arguments

- `branch1`: First branch to compare (required)
- `branch2`: Second branch to compare (required)

### Options

- `--keep-temp`: Keep temporary directories after comparison
- `--verbose`: Show detailed output
- `-V, --version`: Output the version number
- `-h, --help`: Display help for command

### Examples

```bash
# Basic comparison
ng-style-compare main feature/new-ui

# With verbose output
ng-style-compare main develop --verbose

# Keep temporary directories
ng-style-compare main feature/styles --keep-temp

# Compare with remote branch
ng-style-compare main origin/feature-branch

# Compare commits or tags
ng-style-compare v1.0.0 v2.0.0
```

### Exit Codes

- `0`: Success
- `1`: Error (invalid arguments, Git errors, file system errors)

## Usage Examples

### Basic Usage

```typescript
import { GitBranchComparer } from 'nostyledrifting';

async function compareBranches() {
  const comparer = new GitBranchComparer();
  
  try {
    const result = await comparer.compare('main', 'feature/new-styles');
    
    // Process the temporary directories
    console.log('Analyzing branch 1:', result.branch1.path);
    console.log('Analyzing branch 2:', result.branch2.path);
    
    // Your SCSS analysis code would go here
    
  } catch (error) {
    console.error('Failed to compare branches:', error.message);
  }
}
```

### With Custom Configuration

```typescript
const comparer = new GitBranchComparer({
  keepTemp: true,    // Keep directories for manual inspection
  verbose: true      // Show detailed progress
});

const result = await comparer.compare('main', 'develop');

// Directories will persist after this call
console.log('Branch directories created:');
console.log('  Main:', result.branch1.path);
console.log('  Develop:', result.branch2.path);

// Manual cleanup when done
// comparer.cleanup();
```

### Error Handling

```typescript
import { 
  GitBranchComparer, 
  BranchNotFoundError, 
  NotGitRepositoryError 
} from 'nostyledrifting';

async function safeComparison(branch1: string, branch2: string) {
  const comparer = new GitBranchComparer();
  
  try {
    return await comparer.compare(branch1, branch2);
  } catch (error) {
    if (error instanceof NotGitRepositoryError) {
      console.error('Please run this command from your Git repository');
    } else if (error instanceof BranchNotFoundError) {
      console.error('Branch not found. Try running: git fetch');
    } else {
      console.error('Unexpected error:', error.message);
    }
    throw error;
  }
}
```

### Integration with File Processing

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';

async function analyzeStyleChanges(branch1: string, branch2: string) {
  const comparer = new GitBranchComparer({ verbose: true });
  const result = await comparer.compare(branch1, branch2);
  
  // Find all SCSS files in both branches
  const scssFiles1 = await findScssFiles(result.branch1.path);
  const scssFiles2 = await findScssFiles(result.branch2.path);
  
  console.log(`Found ${scssFiles1.length} SCSS files in ${branch1}`);
  console.log(`Found ${scssFiles2.length} SCSS files in ${branch2}`);
  
  // Process files here...
}

async function findScssFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(currentDir: string) {
    const items = await fs.readdir(currentDir);
    
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        await scan(itemPath);
      } else if (item.endsWith('.scss')) {
        files.push(itemPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}
```

## Performance Notes

### Memory Usage

- Base memory: ~20MB for dependencies
- Per branch: 1-5MB depending on project size
- Peak usage: Usually < 100MB for typical Angular projects

### Timing

- Small projects (< 100 files): 2-5 seconds
- Medium projects (100-1000 files): 5-15 seconds  
- Large projects (1000+ files): 15-60 seconds

### Optimization Tips

1. Use `--keep-temp` only when debugging to avoid disk space usage
2. Run from project root to minimize file copying distance
3. Ensure adequate disk space (2x project size minimum)
4. Close other applications if experiencing memory issues
