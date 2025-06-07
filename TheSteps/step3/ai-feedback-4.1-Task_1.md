# Task 1: Create Core Diff Infrastructure and Type Definitions

## Overview
Establish the foundational infrastructure for the Style Diff Engine by creating the directory structure, core type definitions, and base interfaces.

## Objectives
- Create the `src/diff/` directory structure
- Define all core TypeScript interfaces and types
- Establish error handling classes for diff operations
- Create base configuration interfaces

## Implementation Steps

### 1. Create Directory Structure
```
src/diff/
├── types.ts              # Core diff type definitions
├── errors.ts             # Diff-specific error classes
├── style-diff-engine.ts  # Main orchestrator (stub)
├── diff-analyzer.ts      # Core diff analysis (stub)
├── diff-formatter.ts     # Diff formatting (stub)
├── diff-renderer.ts      # Diff rendering (stub)
└── __tests__/            # Test directory
    ├── types.test.ts
    └── errors.test.ts
```

### 2. Implement Core Types (`src/diff/types.ts`)

**Priority Interfaces to Implement:**
```typescript
interface DiffOptions {
  viewMode: 'unified' | 'split' | 'summary'
  contextLines: number
  groupRelatedChanges: boolean
  resolveVariables: boolean
  showOnlyChanges: boolean
  format: 'terminal' | 'json' | 'html'
}

interface StyleDiffResult {
  branch1: string
  branch2: string
  fileDiffs: FileDiffResult[]
  summary: DiffSummary
  metadata: DiffMetadata
}

interface FileDiffResult {
  filePath: string
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  chunks: DiffChunk[]
  summary: FileDiffSummary
}

interface DiffChunk {
  oldStart: number
  oldLength: number
  newStart: number
  newLength: number
  changes: DiffChange[]
  context: ChunkContext
}

interface DiffChange {
  type: 'added' | 'removed' | 'modified' | 'context'
  lineNumber: number
  content: string
  cssProperties?: CssPropertyChange[]
  scssContext?: ScssContext
}

interface CssPropertyChange {
  property: string
  oldValue?: string
  newValue?: string
  category: 'typography' | 'layout' | 'color' | 'animation' | 'other'
  impact: 'high' | 'medium' | 'low'
}

interface DiffGroup {
  category: string
  selector: string
  changes: DiffChange[]
  related: boolean
}
```

**Supporting Types:**
```typescript
interface DiffSummary {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  linesModified: number
  propertiesChanged: number
  highImpactChanges: number
  mediumImpactChanges: number
  lowImpactChanges: number
}

interface FileDiffSummary {
  linesAdded: number
  linesRemoved: number
  linesModified: number
  propertiesChanged: number
  changeComplexity: 'low' | 'medium' | 'high'
}

interface DiffMetadata {
  comparisonTime: Date
  processingTimeMs: number
  diffAlgorithm: string
  version: string
  options: DiffOptions
}

interface ChunkContext {
  surroundingLines: number
  selector?: string
  nestingLevel: number
  mediaQuery?: string
}

interface ScssContext {
  variables: Map<string, string>
  mixins: string[]
  imports: string[]
  nestingPath: string[]
}
```

### 3. Implement Error Classes (`src/diff/errors.ts`)

```typescript
export enum DiffErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  INVALID_DIFF_OPTIONS = 'INVALID_DIFF_OPTIONS',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE'
}

export class DiffError extends Error {
  public readonly type: DiffErrorType
  public readonly filePath?: string
  public readonly context?: any
  
  constructor(type: DiffErrorType, message: string, filePath?: string, context?: any) {
    super(message)
    this.name = 'DiffError'
    this.type = type
    this.filePath = filePath
    this.context = context
  }
}

export class DiffAnalysisError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.ANALYSIS_TIMEOUT, message, filePath, context)
    this.name = 'DiffAnalysisError'
  }
}

export class DiffParseError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.PARSE_ERROR, message, filePath, context)
    this.name = 'DiffParseError'
  }
}
```

### 4. Create Stub Files

Create empty stub files with basic class structures for:
- `style-diff-engine.ts`
- `diff-analyzer.ts` 
- `diff-formatter.ts`
- `diff-renderer.ts`

Each should export a class with the basic interface but throw "Not Implemented" errors.

### 5. Basic Unit Tests

Create tests for:
- Type definition validation
- Error class construction and inheritance
- Basic stub class instantiation

## Integration Requirements

### Dependencies to Add
No new dependencies required for this task - uses existing project dependencies.

### Integration Points
- Import existing SCSS discovery types from `../scss-discovery.ts`
- Import existing typography types from `../typography/types.ts`
- Import existing parser types from `../parser/ast-nodes.ts`

## Acceptance Criteria

- [ ] All type interfaces are defined and exported
- [ ] Error classes extend base Error with proper typing
- [ ] Directory structure is created
- [ ] Stub files compile without errors
- [ ] Basic unit tests pass
- [ ] All types are properly documented with JSDoc comments
- [ ] Integration with existing type system is verified

## Files to Create/Modify

**New Files:**
- `src/diff/types.ts`
- `src/diff/errors.ts`
- `src/diff/style-diff-engine.ts` (stub)
- `src/diff/diff-analyzer.ts` (stub)
- `src/diff/diff-formatter.ts` (stub)
- `src/diff/diff-renderer.ts` (stub)
- `src/diff/__tests__/types.test.ts`
- `src/diff/__tests__/errors.test.ts`

**No Existing Files Modified** in this task.

## Time Estimate
2-3 hours

## Dependencies
None - this is the foundation task for all subsequent diff engine work.
