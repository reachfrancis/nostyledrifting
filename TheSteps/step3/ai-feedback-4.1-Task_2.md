# Task 2: Implement Text-Level Diff Analyzer

## Overview
Implement the core diff analysis functionality with text-level comparison using proven diff algorithms. 
This task focuses on the basic line-by-line comparison capabilities that will serve as the foundation for semantic analysis.

## Objectives
- Implement basic text diff functionality using Myers algorithm
- Create the DiffAnalyzer class with text comparison methods
- Add file content preprocessing and normalization
- Implement chunk generation and context preservation
- Add basic performance optimization

## Implementation Steps

### 1. Install Required Dependencies
Add diff algorithm library to package.json:
```json
{
  "dependencies": {
    "diff": "^5.1.0"
  },
  "devDependencies": {
    "@types/diff": "^5.0.3"
  }
}
```

### 2. Implement DiffAnalyzer (`src/diff/diff-analyzer.ts`)

**Core Class Structure:**
```typescript
import { diff_match_patch } from 'diff-match-patch';
import * as Diff from 'diff';
import { 
  FileDiffResult, 
  DiffChunk, 
  DiffChange, 
  DiffOptions,
  DiffGroup,
  ScssContext 
} from './types';
import { DiffError, DiffErrorType } from './errors';

export class DiffAnalyzer {
  private options: DiffOptions;
  private diffProcessor: diff_match_patch;

  constructor(options: DiffOptions) {
    this.options = options;
    this.diffProcessor = new diff_match_patch();
    this.diffProcessor.Diff_Timeout = 5.0; // 5 second timeout
  }

  /**
   * Analyze differences between two SCSS files
   */
  async analyzeFiles(file1: string, file2: string): Promise<FileDiffResult> {
    try {
      const content1 = await this.readFileContent(file1);
      const content2 = await this.readFileContent(file2);
      
      return await this.analyzeContent(content1, content2, file1);
    } catch (error) {
      throw new DiffError(
        DiffErrorType.FILE_NOT_FOUND,
        `Failed to analyze files: ${error.message}`,
        file1
      );
    }
  }

  /**
   * Analyze differences between two content strings
   */
  async analyzeContent(content1: string, content2: string, filePath?: string): Promise<FileDiffResult> {
    const normalizedContent1 = this.normalizeContent(content1);
    const normalizedContent2 = this.normalizeContent(content2);
    
    const chunks = await this.generateDiffChunks(normalizedContent1, normalizedContent2);
    const changeType = this.determineChangeType(chunks);
    
    return {
      filePath: filePath || 'unknown',
      changeType,
      chunks,
      summary: this.generateFileSummary(chunks)
    };
  }

  /**
   * Generate diff chunks with context
   */
  private async generateDiffChunks(content1: string, content2: string): Promise<DiffChunk[]> {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    
    // Use diff library for line-by-line comparison
    const lineDiffs = Diff.diffLines(content1, content2);
    
    const chunks: DiffChunk[] = [];
    let oldLineNumber = 1;
    let newLineNumber = 1;
    
    for (const part of lineDiffs) {
      if (part.added || part.removed || this.hasContextAroundChange(part, lineDiffs)) {
        const chunk = this.createChunk(part, oldLineNumber, newLineNumber, lines1, lines2);
        if (chunk.changes.length > 0) {
          chunks.push(chunk);
        }
      }
      
      if (!part.added) oldLineNumber += part.count || 0;
      if (!part.removed) newLineNumber += part.count || 0;
    }
    
    return this.mergeNearbyChunks(chunks);
  }

  /**
   * Create a diff chunk from a diff part
   */
  private createChunk(
    part: Diff.Change, 
    oldStart: number, 
    newStart: number, 
    lines1: string[], 
    lines2: string[]
  ): DiffChunk {
    const changes: DiffChange[] = [];
    const lines = part.value.split('\n').filter(line => line !== '');
    
    // Add context lines before
    const contextBefore = this.getContextLines(lines1, oldStart - 1, -this.options.contextLines);
    contextBefore.forEach((line, index) => {
      changes.push({
        type: 'context',
        lineNumber: oldStart - contextBefore.length + index,
        content: line
      });
    });
    
    // Add the actual changes
    lines.forEach((line, index) => {
      const changeType = part.added ? 'added' : part.removed ? 'removed' : 'context';
      changes.push({
        type: changeType,
        lineNumber: part.added ? newStart + index : oldStart + index,
        content: line
      });
    });
    
    // Add context lines after
    const contextAfter = this.getContextLines(
      part.added ? lines2 : lines1, 
      (part.added ? newStart : oldStart) + lines.length, 
      this.options.contextLines
    );
    contextAfter.forEach((line, index) => {
      changes.push({
        type: 'context',
        lineNumber: (part.added ? newStart : oldStart) + lines.length + index,
        content: line
      });
    });
    
    return {
      oldStart,
      oldLength: part.removed ? lines.length : 0,
      newStart,
      newLength: part.added ? lines.length : 0,
      changes,
      context: {
        surroundingLines: this.options.contextLines,
        nestingLevel: this.calculateNestingLevel(lines[0] || ''),
        selector: this.extractSelector(lines[0] || '')
      }
    };
  }
}
```

### 3. Implement Supporting Methods

**Content Processing:**
```typescript
/**
 * Normalize content for consistent comparison
 */
private normalizeContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\t/g, '  ')    // Convert tabs to spaces
    .trim();                 // Remove leading/trailing whitespace
}

/**
 * Get context lines around a change
 */
private getContextLines(lines: string[], startIndex: number, count: number): string[] {
  const start = Math.max(0, startIndex);
  const end = Math.min(lines.length, startIndex + Math.abs(count));
  
  if (count < 0) {
    // Get lines before
    return lines.slice(Math.max(0, startIndex + count), start);
  } else {
    // Get lines after
    return lines.slice(start, end);
  }
}

/**
 * Calculate nesting level from indentation
 */
private calculateNestingLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? Math.floor(match[1].length / 2) : 0;
}

/**
 * Extract CSS selector from line
 */
private extractSelector(line: string): string | undefined {
  const trimmed = line.trim();
  if (trimmed.includes('{')) {
    return trimmed.split('{')[0].trim();
  }
  return undefined;
}

/**
 * Determine overall change type for file
 */
private determineChangeType(chunks: DiffChunk[]): 'added' | 'removed' | 'modified' | 'unchanged' {
  if (chunks.length === 0) return 'unchanged';
  
  const hasAdditions = chunks.some(chunk => chunk.changes.some(change => change.type === 'added'));
  const hasRemovals = chunks.some(chunk => chunk.changes.some(change => change.type === 'removed'));
  
  if (hasAdditions && hasRemovals) return 'modified';
  if (hasAdditions) return 'added';
  if (hasRemovals) return 'removed';
  return 'unchanged';
}
```

### 4. Implement File Summary Generation

```typescript
/**
 * Generate summary statistics for file diff
 */
private generateFileSummary(chunks: DiffChunk[]): FileDiffSummary {
  let linesAdded = 0;
  let linesRemoved = 0;
  let linesModified = 0;
  
  chunks.forEach(chunk => {
    chunk.changes.forEach(change => {
      switch (change.type) {
        case 'added':
          linesAdded++;
          break;
        case 'removed':
          linesRemoved++;
          break;
        case 'modified':
          linesModified++;
          break;
      }
    });
  });
  
  const totalChanges = linesAdded + linesRemoved + linesModified;
  let changeComplexity: 'low' | 'medium' | 'high' = 'low';
  
  if (totalChanges > 50) changeComplexity = 'high';
  else if (totalChanges > 20) changeComplexity = 'medium';
  
  return {
    linesAdded,
    linesRemoved,
    linesModified,
    propertiesChanged: 0, // Will be implemented in semantic analysis task
    changeComplexity
  };
}
```

### 5. Add Chunk Optimization

```typescript
/**
 * Merge nearby chunks to reduce fragmentation
 */
private mergeNearbyChunks(chunks: DiffChunk[]): DiffChunk[] {
  if (chunks.length <= 1) return chunks;
  
  const merged: DiffChunk[] = [];
  let current = chunks[0];
  
  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];
    const gap = next.oldStart - (current.oldStart + current.oldLength);
    
    // Merge if chunks are close enough (within 2 * context lines)
    if (gap <= this.options.contextLines * 2) {
      current = this.mergeChunks(current, next);
    } else {
      merged.push(current);
      current = next;
    }
  }
  
  merged.push(current);
  return merged;
}

/**
 * Merge two adjacent chunks
 */
private mergeChunks(chunk1: DiffChunk, chunk2: DiffChunk): DiffChunk {
  return {
    oldStart: chunk1.oldStart,
    oldLength: chunk1.oldLength + chunk2.oldLength,
    newStart: chunk1.newStart,
    newLength: chunk1.newLength + chunk2.newLength,
    changes: [...chunk1.changes, ...chunk2.changes],
    context: chunk1.context
  };
}
```

### 6. Add Error Handling and Utilities

```typescript
/**
 * Read file content with error handling
 */
private async readFileContent(filePath: string): Promise<string> {
  try {
    const fs = await import('fs-extra');
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new DiffError(
      DiffErrorType.FILE_NOT_FOUND,
      `Cannot read file: ${filePath}`,
      filePath,
      error
    );
  }
}

/**
 * Check if a part has context around changes
 */
private hasContextAroundChange(part: Diff.Change, allParts: Diff.Change[]): boolean {
  const index = allParts.indexOf(part);
  const hasChangeNearby = 
    (index > 0 && (allParts[index - 1].added || allParts[index - 1].removed)) ||
    (index < allParts.length - 1 && (allParts[index + 1].added || allParts[index + 1].removed));
  
  return hasChangeNearby;
}
```

### 7. Stub Methods for Future Implementation

```typescript
/**
 * Group related changes (will be implemented in semantic analysis task)
 */
async groupRelatedChanges(changes: DiffChange[]): Promise<DiffGroup[]> {
  throw new Error('Not implemented - will be added in semantic analysis task');
}

/**
 * Resolve SCSS context (will be implemented in semantic analysis task)
 */
async resolveScssContext(change: DiffChange, context: ScssContext): Promise<any> {
  throw new Error('Not implemented - will be added in semantic analysis task');
}
```

## Integration Requirements

### Dependencies to Add
```bash
npm install diff@^5.1.0
npm install --save-dev @types/diff@^5.0.3
```

### Integration Points
- Uses types from `./types.ts` created in Task 1
- Uses errors from `./errors.ts` created in Task 1
- Integrates with existing `fs-extra` for file operations

## Testing Requirements

### 1. Unit Tests (`src/diff/__tests__/diff-analyzer.test.ts`)

Test scenarios:
- Basic text diff generation
- Context line preservation
- Chunk merging logic
- File summary generation
- Error handling for missing files
- Performance with large files

### 2. Test Data Setup

Create test SCSS files with:
- Simple property changes
- Added/removed selectors
- Complex nested structures
- Large files for performance testing

## Acceptance Criteria

- [ ] DiffAnalyzer class implements basic text comparison
- [ ] Generates accurate diff chunks with proper line numbers
- [ ] Preserves context lines around changes
- [ ] Merges nearby chunks appropriately
- [ ] Handles file reading errors gracefully
- [ ] Generates accurate file summaries
- [ ] Performance is acceptable for files up to 10,000 lines
- [ ] All unit tests pass
- [ ] Memory usage is reasonable for large files

## Files to Create/Modify

**New Files:**
- `src/diff/__tests__/diff-analyzer.test.ts`
- `src/diff/__tests__/test-data/` (directory with test SCSS files)

**Modified Files:**
- `src/diff/diff-analyzer.ts` (implement full class)
- `package.json` (add diff dependencies)

## Time Estimate
4-6 hours

## Dependencies
- Requires Task 1 (Core Infrastructure) to be completed
- Will be extended by Task 4 (Semantic Analysis)
