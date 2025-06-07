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
  CssPropertyChange,
  SemanticAnalysisResult,
  SemanticDiffGroup,
  DEFAULT_DIFF_OPTIONS
} from './types';
import { DiffError, DiffErrorType, DiffAnalysisError } from './errors';
import { CssPropertyCategorizer, defaultPropertyCategorizer } from './css-property-categorizer';
import { ScssContextAnalyzer, defaultScssContextAnalyzer } from './scss-context-analyzer';

/**
 * Enhanced diff analysis engine with semantic CSS understanding
 * Analyzes differences between SCSS files and generates detailed diff results
 * with semantic categorization and impact analysis
 */
export class DiffAnalyzer {
  private options: DiffOptions;
  private propertyCategorizer: CssPropertyCategorizer;
  private contextAnalyzer: ScssContextAnalyzer;

  constructor(options?: Partial<DiffOptions>) {
    this.options = { ...DEFAULT_DIFF_OPTIONS, ...options };
    this.propertyCategorizer = defaultPropertyCategorizer;
    this.contextAnalyzer = defaultScssContextAnalyzer;
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
    
    // Enhance chunks with semantic analysis
    const enhancedChunks = await this.enhanceChunksWithSemanticAnalysis(chunks, content1, content2);
    
    return {
      filePath: filePath || 'unknown',
      changeType,
      chunks: enhancedChunks,
      summary: this.generateFileSummary(enhancedChunks)
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
  }  /**
   * Analyzes CSS property changes within a diff change
   * @param change - The diff change to analyze
   * @returns Array of CSS property changes
   * @throws DiffAnalysisError when property analysis fails
   */
  analyzeCssProperties(change: DiffChange): CssPropertyChange[] {
    try {
      const properties: CssPropertyChange[] = [];
      const lines = change.content.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
          continue;
        }        // Match CSS property declarations (property: value;)
        const propertyMatch = trimmedLine.match(/^\s*([a-zA-Z-]+)\s*:\s*([^;]+);?\s*$/);
        if (propertyMatch) {
          const [, property, value] = propertyMatch;
          const categoryInfo = this.propertyCategorizer.categorizeProperty(property);
          
          properties.push({
            property: property.trim(),
            oldValue: change.type === 'removed' ? value.trim() : undefined,
            newValue: change.type === 'added' ? value.trim() : undefined,
            category: this.mapCategoryToType(categoryInfo.category),
            impact: this.mapImpactToLevel(categoryInfo.impact),
            visualImpact: categoryInfo.visualImpact,
            performanceImpact: categoryInfo.performanceImpact,
            accessibility: categoryInfo.accessibility,
            responsive: categoryInfo.responsive,
            affectedSelectors: [this.extractSelectorFromContext(change.content)]
          });
        }
      }

      return properties;
    } catch (error) {
      throw new DiffAnalysisError(
        `Failed to analyze CSS properties: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract selector context from CSS content
   */
  private extractSelectorFromContext(content: string): string {
    // Simple selector extraction - looks for patterns before opening braces
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.includes('{') && !trimmedLine.startsWith('//')) {
        return trimmedLine.split('{')[0].trim();
      }
    }
    return 'unknown';
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

  /**
   * Map category string to expected type
   */
  private mapCategoryToType(category: string): 'typography' | 'layout' | 'color' | 'animation' | 'other' {
    switch (category.toLowerCase()) {
      case 'typography':
        return 'typography';
      case 'layout':
        return 'layout';
      case 'color':
        return 'color';
      case 'animation':
        return 'animation';
      default:
        return 'other';
    }
  }

  /**
   * Map impact string to expected level
   */
  private mapImpactToLevel(impact: string): 'high' | 'medium' | 'low' {
    switch (impact.toLowerCase()) {
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'low';
    }
  }

  /**
   * Enhance diff chunks with semantic analysis
   */
  private async enhanceChunksWithSemanticAnalysis(
    chunks: DiffChunk[], 
    oldContent: string, 
    newContent: string
  ): Promise<DiffChunk[]> {
    try {
      const enhancedChunks: DiffChunk[] = [];

      for (const chunk of chunks) {
        const enhancedChanges: DiffChange[] = [];

        for (const change of chunk.changes) {
          const cssProperties = this.analyzeCssProperties(change);          // Analyze SCSS context if applicable
          let scssContext: ScssContext | undefined;
          if (change.content.includes('{') || change.content.includes('$') || change.content.includes('@')) {
            const oldAnalysis = this.contextAnalyzer.analyzeContent(oldContent);
            const newAnalysis = this.contextAnalyzer.analyzeContent(newContent);
              scssContext = {
              variables: new Map([...oldAnalysis.variables, ...newAnalysis.variables]),
              mixins: [...oldAnalysis.mixins.keys()],
              imports: [...oldAnalysis.imports],
              nestingPath: [],
              mediaQuery: newAnalysis.mediaQueries[0] || undefined
            };
          }

          const enhancedChange: DiffChange = {
            ...change,
            cssProperties,
            scssContext
          };

          enhancedChanges.push(enhancedChange);
        }

        enhancedChunks.push({
          ...chunk,
          changes: enhancedChanges
        });
      }

      return enhancedChunks;
    } catch (error) {
      // If semantic analysis fails, return original chunks
      console.warn('Semantic analysis failed, falling back to basic diff:', error);
      return chunks;
    }
  }
  /**
   * Generate semantic analysis for file diff results
   */
  async generateSemanticAnalysis(fileDiffResult: FileDiffResult): Promise<SemanticAnalysisResult> {
    try {
      const propertyChanges: CssPropertyChange[] = [];
      
      // Collect all CSS property changes from chunks
      for (const chunk of fileDiffResult.chunks) {
        for (const change of chunk.changes) {
          if (change.cssProperties) {
            propertyChanges.push(...change.cssProperties);
          }
        }
      }

      // Categorize changes by semantic impact
      const categorizedChanges = {
        breaking: propertyChanges.filter(c => c.semanticImpact === 'breaking'),
        visual: propertyChanges.filter(c => c.semanticImpact === 'visual'),
        functional: propertyChanges.filter(c => c.semanticImpact === 'functional'),
        cosmetic: propertyChanges.filter(c => c.semanticImpact === 'cosmetic')
      };

      // Analyze accessibility impact
      const accessibilityAffected = propertyChanges.filter(c => c.accessibility);
      const accessibilityImpact = {
        hasImpact: accessibilityAffected.length > 0,
        affectedProperties: accessibilityAffected.map(c => c.property),
        contrastChanges: accessibilityAffected.some(c => c.category === 'color'),
        focusChanges: accessibilityAffected.some(c => c.property.includes('focus') || c.property.includes('outline'))
      };

      // Analyze performance impact
      const performanceChanges = propertyChanges.filter(c => c.performanceImpact && c.performanceImpact !== 'none');
      const performanceImpact = {
        hasImpact: performanceChanges.length > 0,
        criticalChanges: performanceChanges.filter(c => c.performanceImpact === 'high').map(c => c.property),
        animationChanges: performanceChanges.filter(c => c.category === 'animation').map(c => c.property),
        layoutChanges: performanceChanges.filter(c => c.category === 'layout').map(c => c.property)
      };

      // Cross-category analysis
      const categories = [...new Set(propertyChanges.map(c => c.category))];
      const crossCategoryAnalysis = {
        multiCategoryChanges: categories.length > 1,
        affectedCategories: categories,
        potentialConflicts: this.detectPotentialConflicts(propertyChanges)
      };

      return {
        overallImpact: this.calculateOverallSemanticImpact(categorizedChanges),
        categorizedChanges,
        accessibilityImpact,
        performanceImpact,
        crossCategoryAnalysis
      };
    } catch (error) {
      throw new DiffAnalysisError(
        `Failed to generate semantic analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate overall semantic impact
   */
  private calculateOverallSemanticImpact(categorizedChanges: any): 'breaking' | 'major' | 'minor' | 'none' {
    if (categorizedChanges.breaking.length > 0) return 'breaking';
    if (categorizedChanges.visual.length > 2 || categorizedChanges.functional.length > 0) return 'major';
    if (categorizedChanges.visual.length > 0 || categorizedChanges.cosmetic.length > 3) return 'minor';
    return 'none';
  }

  /**
   * Detect potential conflicts between changes
   */
  private detectPotentialConflicts(changes: CssPropertyChange[]): string[] {
    const conflicts: string[] = [];
    
    // Check for typography consistency issues
    const fontChanges = changes.filter(c => c.property.includes('font'));
    if (fontChanges.length > 1) {
      conflicts.push('Multiple font-related changes may affect consistency');
    }
    
    // Check for layout conflicts
    const layoutChanges = changes.filter(c => c.category === 'layout');
    if (layoutChanges.length > 2) {
      conflicts.push('Multiple layout changes may cause responsive issues');
    }
      return conflicts;
  }

  // ...existing code...
}
