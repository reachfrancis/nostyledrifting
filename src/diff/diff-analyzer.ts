import * as Diff from 'diff';
import * as fs from 'fs-extra';
import { 
  FileDiffResult, 
  DiffChunk, 
  DiffChange, 
  DiffOptions,
  DiffGroup,
  ScssContext,
  FileDiffSummary,
  ChunkContext,
  DEFAULT_DIFF_OPTIONS
} from './types';
import { DiffError, DiffErrorType, DiffAnalysisError } from './errors';

/**
 * Core diff analysis engine for text-level comparison
 * Analyzes differences between SCSS files and generates detailed diff results
 */
export class DiffAnalyzer {
  private options: DiffOptions;

  constructor(options?: Partial<DiffOptions>) {
    this.options = { ...DEFAULT_DIFF_OPTIONS, ...options };
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
        `Failed to analyze files: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Analyzes differences between two SCSS file contents
   * @param oldContent - Content of the file in the first branch
   * @param newContent - Content of the file in the second branch
   * @param filePath - Path to the file being analyzed
   * @param options - Diff analysis options
   * @returns Promise resolving to file diff result
   * @throws DiffAnalysisError when analysis fails
   */
  async analyzeFile(
    oldContent: string,
    newContent: string, 
    filePath: string,
    options?: DiffOptions
  ): Promise<FileDiffResult> {
    const mergedOptions = { ...this.options, ...options };
    this.options = mergedOptions;
    
    return await this.analyzeContent(oldContent, newContent, filePath);
  }  /**
   * Generate diff chunks with context
   * @returns Array of diff chunks
   * @throws DiffAnalysisError when chunk creation fails
   */
  createDiffChunks(
    oldLines: string[],
    newLines: string[],
    contextLines: number = 3
  ): DiffChunk[] {
    try {
      const changes = Diff.diffLines(oldLines.join('\n'), newLines.join('\n'));
      const chunks: DiffChunk[] = [];
      let oldLineNumber = 1;
      let newLineNumber = 1;

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const lines = change.value.split('\n').filter(line => line !== '' || i < changes.length - 1);

        if (change.added || change.removed) {
          const chunk: DiffChunk = {
            oldStart: oldLineNumber,
            oldLength: change.removed ? lines.length : 0,
            newStart: newLineNumber,
            newLength: change.added ? lines.length : 0,
            context: this.createChunkContext(oldLineNumber, newLineNumber, contextLines),
            changes: [{
              type: change.added ? 'added' : 'removed',
              lineNumber: change.added ? newLineNumber : oldLineNumber,
              content: change.value
            }]
          };
          chunks.push(chunk);
        }

        if (!change.removed) {
          newLineNumber += lines.length;
        }
        if (!change.added) {
          oldLineNumber += lines.length;
        }
      }

      return chunks;
    } catch (error) {
      throw new DiffAnalysisError(
        `Failed to create diff chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Analyzes CSS property changes within a diff change
   * @param change - The diff change to analyze
   * @returns Array of CSS property changes
   * @throws DiffAnalysisError when property analysis fails
   */
  analyzeCssProperties(change: DiffChange): DiffChange {
    try {
      // For now, return the change as-is
      // This can be enhanced later to analyze specific CSS properties
      return change;
    } catch (error) {
      throw new DiffAnalysisError(
        `Failed to analyze CSS properties: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Read file content with proper error handling
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new DiffError(
        DiffErrorType.FILE_NOT_FOUND,
        `Cannot read file: ${filePath}`,
        filePath
      );
    }
  }
  /**
   * Normalize content for consistent diff analysis
   */
  private normalizeContent(content: string): string {
    // For now, just normalize line endings
    // The ignoreWhitespace option is not defined in DiffOptions yet
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '  '); // Convert tabs to spaces
  }

  /**
   * Generate diff chunks from normalized content
   */
  private async generateDiffChunks(content1: string, content2: string): Promise<DiffChunk[]> {
    try {
      const changes = Diff.diffLines(content1, content2);
      const chunks: DiffChunk[] = [];
      let oldLineNumber = 1;
      let newLineNumber = 1;

      for (const change of changes) {
        if (change.added || change.removed) {
          const lines = change.value.split('\n').filter((line, index, array) => 
            line !== '' || index < array.length - 1
          );

          const diffChange: DiffChange = {
            type: change.added ? 'added' : 'removed',
            lineNumber: change.added ? newLineNumber : oldLineNumber,
            content: change.value
          };

          const chunk: DiffChunk = {
            oldStart: oldLineNumber,
            oldLength: change.removed ? (change.count || 0) : 0,
            newStart: newLineNumber,
            newLength: change.added ? (change.count || 0) : 0,
            context: this.createChunkContext(oldLineNumber, newLineNumber, this.options.contextLines),
            changes: [diffChange]
          };

          chunks.push(chunk);
        }

        if (!change.removed) {
          newLineNumber += change.count || 0;
        }
        if (!change.added) {
          oldLineNumber += change.count || 0;
        }
      }

      return chunks;
    } catch (error) {
      throw new DiffAnalysisError(
        `Failed to generate diff chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create chunk context with line numbers
   */
  private createChunkContext(oldLineNumber: number, newLineNumber: number, contextLines: number): ChunkContext {
    return {
      surroundingLines: contextLines,
      nestingLevel: 0
    };
  }

  /**
   * Determine the type of change based on chunks
   */
  private determineChangeType(chunks: DiffChunk[]): 'added' | 'removed' | 'modified' {
    if (chunks.length === 0) {
      return 'modified';
    }

    const hasAdditions = chunks.some(chunk => 
      chunk.changes.some(change => change.type === 'added')
    );
    const hasRemovals = chunks.some(chunk => 
      chunk.changes.some(change => change.type === 'removed')
    );

    if (hasAdditions && hasRemovals) {
      return 'modified';
    } else if (hasAdditions) {
      return 'added';
    } else {
      return 'removed';
    }
  }
  /**
   * Generate file summary from chunks
   */
  private generateFileSummary(chunks: DiffChunk[]): FileDiffSummary {
    let linesAdded = 0;
    let linesRemoved = 0;
    let linesModified = 0;

    for (const chunk of chunks) {
      for (const change of chunk.changes) {
        const lineCount = (change.content.match(/\n/g) || []).length + 1;
        if (change.type === 'added') {
          linesAdded += lineCount;
        } else if (change.type === 'removed') {
          linesRemoved += lineCount;
        } else if (change.type === 'modified') {
          linesModified += lineCount;
        }
      }
    }

    return {
      linesAdded,
      linesRemoved,
      linesModified,
      propertiesChanged: 0, // Will be enhanced later
      changeComplexity: this.determineChangeComplexity(linesAdded, linesRemoved, linesModified)
    };
  }

  /**
   * Determine change complexity based on line counts
   */
  private determineChangeComplexity(added: number, removed: number, modified: number): 'low' | 'medium' | 'high' {
    const totalChanges = added + removed + modified;
    if (totalChanges > 50) {
      return 'high';
    } else if (totalChanges > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}
