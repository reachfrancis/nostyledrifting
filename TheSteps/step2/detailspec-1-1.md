# Story 1.1: Component SCSS File Discovery - Detailed Specifications

## Story Overview
**As a** developer  
**I want to** automatically discover all SCSS files in an Angular project  
**So that** I can ensure complete style coverage in comparisons

## Technical Design

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   SCSS Discovery Engine                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │ Directory       │    │ SCSS File        │               │
│  │ Scanner         │───►│ Classifier       │               │
│  └─────────────────┘    └──────────────────┘               │
│           │                      │                           │
│           ▼                      ▼                           │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │ Path Filter     │    │ Import Resolver  │               │
│  └─────────────────┘    └──────────────────┘               │
│           │                      │                           │
│           └──────────┬───────────┘                          │
│                      ▼                                       │
│             ┌─────────────────┐                             │
│             │ Style Mapper    │                             │
│             └─────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Core Components

#### 2.1 Directory Scanner Module
```typescript
interface DirectoryScannerConfig {
  rootPaths: string[];           // ['dev', 'qa'] directories
  excludePatterns: string[];     // Patterns to exclude
  includePatterns: string[];     // Specific patterns to include
  maxDepth?: number;             // Maximum directory depth
  followSymlinks: boolean;       // Whether to follow symbolic links
}

interface ScanResult {
  branch: 'dev' | 'qa';
  filePath: string;
  relativePath: string;          // Relative to branch root
  stats: FileStats;
}
```

#### 2.2 SCSS File Classifier
```typescript
enum ScssFileType {
  COMPONENT = 'component',       // *.component.scss
  GLOBAL = 'global',            // styles.scss
  THEME = 'theme',              // *theme.scss
  PARTIAL = 'partial',          // _*.scss
  MIXIN = 'mixin',              // _mixins.scss
  VARIABLES = 'variables',      // _variables.scss
  CUSTOM = 'custom'             // Other SCSS files
}

interface ScssFileMetadata {
  type: ScssFileType;
  path: string;
  componentPath?: string;        // Associated component file
  isStandalone: boolean;         // For component styles
  imports: string[];             // Direct imports
  importedBy: string[];          // Reverse dependencies
}
```

#### 2.3 Import Resolver
```typescript
interface ImportResolver {
  resolveImports(filePath: string): ImportGraph;
  buildDependencyTree(files: ScssFileMetadata[]): DependencyTree;
  detectCircularDependencies(): CircularDependency[];
}

interface ImportGraph {
  node: string;
  imports: ImportEdge[];
  resolvedPaths: Map<string, string>;
}
```

### 3. Data Models

#### 3.1 Style Mapping Model
```typescript
interface ComponentStyleMapping {
  componentPath: string;
  componentName: string;
  isStandalone: boolean;
  styleFiles: {
    primary?: string;           // Main component.scss
    inherited: string[];        // From parent components
    imported: string[];         // Via @import
    global: string[];          // Global styles affecting component
  };
  selectors: string[];         // CSS selectors used
  variables: Map<string, string>; // SCSS variables used
}

interface ProjectStyleInventory {
  branch: 'dev' | 'qa';
  timestamp: Date;
  angularVersion: string;
  projectStructure: {
    rootPath: string;
    srcPath: string;
    projects: ProjectInfo[];
  };
  globalStyles: string[];
  themeFiles: string[];
  componentMappings: Map<string, ComponentStyleMapping>;
  importGraph: ImportGraph;
}
```

### 4. Implementation Details

#### 4.1 File Discovery Algorithm
```typescript
class ScssDiscoveryEngine {
  private readonly DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.angular/**',
    '**/coverage/**',
    '**/*.spec.scss'
  ];

  private readonly SCSS_PATTERNS = [
    '**/*.scss',
    '**/*.sass'
  ];

  async discoverScssFiles(config: DirectoryScannerConfig): Promise<ScanResult[]> {
    // Implementation details in section 4.2
  }
}
```

#### 4.2 Scanning Strategy
1. **Parallel Scanning**: Process 'dev' and 'qa' directories concurrently
2. **Stream Processing**: Use Node.js streams for memory efficiency
3. **Caching**: Cache discovered files with modification timestamps
4. **Incremental Updates**: Support incremental discovery for changed files

#### 4.3 Component Association Logic
```typescript
class ComponentStyleAssociator {
  associateStyles(componentPath: string, scssFiles: ScssFileMetadata[]): ComponentStyleMapping {
    // 1. Find direct component.scss file
    // 2. Check for styleUrls in component metadata
    // 3. Identify inherited styles from parent components
    // 4. Track global styles that affect component
    // 5. Build complete style dependency graph
  }
}
```

### 5. API Specification

#### 5.1 Main Service Interface
```typescript
interface IScssDiscoveryService {
  // Initialize discovery for both branches
  initialize(devPath: string, qaPath: string): Promise<void>;
  
  // Discover all SCSS files
  discoverAll(): Promise<DiscoveryResult>;
  
  // Discover SCSS for specific component
  discoverForComponent(componentPath: string): Promise<ComponentStyleMapping>;
  
  // Get style inventory for branch
  getInventory(branch: 'dev' | 'qa'): ProjectStyleInventory;
  
  // Refresh discovery for changed files
  refresh(changedFiles?: string[]): Promise<DiscoveryResult>;
}
```

#### 5.2 Discovery Result Structure
```typescript
interface DiscoveryResult {
  dev: BranchDiscovery;
  qa: BranchDiscovery;
  summary: {
    totalFilesDiscovered: number;
    componentMappings: number;
    globalStyles: number;
    themes: number;
    partials: number;
    errors: DiscoveryError[];
  };
}

interface BranchDiscovery {
  branch: 'dev' | 'qa';
  files: ScssFileMetadata[];
  mappings: ComponentStyleMapping[];
  importGraph: ImportGraph;
  timestamp: Date;
}
```

### 6. Error Handling

#### 6.1 Error Types
```typescript
enum DiscoveryErrorType {
  FILE_ACCESS = 'FILE_ACCESS',
  PARSE_ERROR = 'PARSE_ERROR',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MISSING_IMPORT = 'MISSING_IMPORT',
  INVALID_PATH = 'INVALID_PATH'
}

interface DiscoveryError {
  type: DiscoveryErrorType;
  message: string;
  filePath?: string;
  branch: 'dev' | 'qa';
  details?: any;
}
```

#### 6.2 Error Recovery Strategies
- Continue scanning on non-critical errors
- Log all errors with context
- Provide fallback for missing imports
- Mark problematic files in results

### 7. Performance Considerations

#### 7.1 Optimization Strategies
- **Concurrent Processing**: Use worker threads for parallel scanning
- **File System Caching**: Cache fs.stat results
- **Lazy Import Resolution**: Resolve imports only when needed
- **Memory Management**: Stream large directories instead of loading all at once

#### 7.2 Performance Metrics
```typescript
interface PerformanceMetrics {
  scanDuration: number;         // Total scan time in ms
  filesProcessed: number;       // Total files scanned
  filesPerSecond: number;       // Processing rate
  memoryUsage: {
    peak: number;               // Peak memory in MB
    average: number;            // Average memory in MB
  };
  cacheHitRate: number;         // Percentage of cache hits
}
```

### 8. Configuration Options

```typescript
interface ScssDiscoveryConfig {
  // Scanning options
  scanner: {
    excludePatterns?: string[];
    includePatterns?: string[];
    maxDepth?: number;
    followSymlinks?: boolean;
    concurrency?: number;       // Number of parallel workers
  };
  
  // Classification options
  classifier: {
    customPatterns?: Record<string, RegExp>;
    componentStylePattern?: RegExp;
  };
  
  // Import resolution
  importResolver: {
    aliases?: Record<string, string>;  // Path aliases
    includePaths?: string[];          // Additional include paths
    resolveExtensions?: string[];     // Extensions to try
  };
  
  // Performance tuning
  performance: {
    enableCaching?: boolean;
    cacheDirectory?: string;
    maxCacheAge?: number;            // Cache TTL in seconds
    streamThreshold?: number;        // File size threshold for streaming
  };
}
```

### 9. Testing Strategy

#### 9.1 Unit Tests
- Directory scanner with mock file system
- SCSS classifier with various file types
- Import resolver with complex dependency graphs
- Component association logic

#### 9.2 Integration Tests
- Full project scanning with sample Angular projects
- Performance tests with large codebases
- Error recovery scenarios
- Cache invalidation testing

#### 9.3 Test Data Structure
```
test-fixtures/
├── simple-app/
│   ├── src/
│   │   ├── styles.scss
│   │   └── app/
│   │       └── app.component.scss
├── complex-app/
│   ├── projects/
│   │   ├── lib1/
│   │   └── lib2/
│   └── src/
└── edge-cases/
    ├── circular-imports/
    ├── missing-files/
    └── deeply-nested/
```

### 10. Integration Points

#### 10.1 With Existing ng-style-compare
- Utilize existing 'dev' and 'qa' directory structure
- Integrate with current branch management
- Extend CLI commands for discovery operations

#### 10.2 Future Stories Integration
- Provide discovered file list to SCSS Parser (Story 1.2)
- Feed component mappings to Style Extractor (Story 1.3)
- Supply import graph to Comparison Engine (Epic 2)

### 11. Success Metrics

- **Coverage**: 100% of SCSS files discovered
- **Accuracy**: Correct component-style associations
- **Performance**: < 5 seconds for projects with 1000+ files
- **Reliability**: < 0.1% error rate in production
- **Memory**: < 100MB for typical Angular projects

### 12. Dependencies

```json
{
  "dependencies": {
    "glob": "^8.0.0",          // File pattern matching
    "chokidar": "^3.5.0",      // File watching
    "micromatch": "^4.0.0",    // Advanced pattern matching
    "p-limit": "^4.0.0"        // Concurrency control
  },
  "devDependencies": {
    "@types/glob": "^8.0.0",
    "@types/micromatch": "^4.0.0",
    "memfs": "^3.0.0"          // In-memory fs for testing
  }
}
```