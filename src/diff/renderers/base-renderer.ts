/**
 * Abstract base class for all diff renderers
 * Provides common functionality and interface definition
 */

import { StyleDiffResult, DiffRenderOptions, RenderedDiff } from '../types';

export abstract class BaseDiffRenderer {
  protected options: DiffRenderOptions;

  constructor(options: DiffRenderOptions = {}) {
    this.options = {
      includeMetadata: true,
      includeStatistics: true,
      includeLineNumbers: true,
      maxWidth: 120,
      ...options
    };
  }

  /**
   * Main rendering method - must be implemented by subclasses
   */
  abstract render(diffResult: StyleDiffResult): Promise<RenderedDiff>;

  /**
   * Render multiple diff results
   */
  async renderMultiple(diffResults: StyleDiffResult[]): Promise<RenderedDiff> {
    const renderedParts = await Promise.all(
      diffResults.map(result => this.render(result))
    );

    return this.combineRenderedResults(renderedParts);
  }

  /**
   * Combine multiple rendered results into a single output
   */
  protected abstract combineRenderedResults(parts: RenderedDiff[]): RenderedDiff;

  /**
   * Generate metadata section for the diff
   */
  protected generateMetadata(diffResult: StyleDiffResult): Record<string, any> {
    if (!this.options.includeMetadata) {
      return {};
    }

    return {
      timestamp: new Date().toISOString(),
      comparison: {
        branch1: diffResult.branch1,
        branch2: diffResult.branch2,
        filesCompared: diffResult.fileDiffs.length
      },
      statistics: this.generateStatistics(diffResult),
      summary: {
        totalChanges: diffResult.summary.totalChanges,
        addedLines: diffResult.summary.addedLines,
        removedLines: diffResult.summary.removedLines,
        modifiedLines: diffResult.summary.modifiedLines
      }
    };
  }

  /**
   * Generate statistics for the diff
   */
  protected generateStatistics(diffResult: StyleDiffResult): Record<string, any> {
    if (!this.options.includeStatistics) {
      return {};
    }

    const stats = {
      totalFiles: diffResult.fileDiffs.length,
      changedFiles: diffResult.fileDiffs.filter(f => f.chunks.length > 0).length,
      totalChunks: diffResult.fileDiffs.reduce((sum, f) => sum + f.chunks.length, 0),
      impactAnalysis: {
        high: 0,
        medium: 0,
        low: 0
      },
      propertyTypes: new Map<string, number>()
    };

    // Analyze property changes for statistics
    diffResult.fileDiffs.forEach(fileDiff => {
      fileDiff.chunks.forEach(chunk => {
        chunk.changes.forEach(change => {        if (change.cssProperties) {
          change.cssProperties.forEach(propChange => {
              // Count impact levels
              stats.impactAnalysis[propChange.impact]++;

              // Count property categories
              const category = propChange.category;
              stats.propertyTypes.set(
                category,
                (stats.propertyTypes.get(category) || 0) + 1
              );
            });
          }
        });
      });
    });

    return {
      ...stats,
      propertyTypes: Object.fromEntries(stats.propertyTypes)
    };
  }

  /**
   * Truncate content if it exceeds maximum width
   */
  protected truncateContent(content: string, maxWidth?: number): string {
    const width = maxWidth || this.options.maxWidth || 120;
    if (content.length <= width) {
      return content;
    }

    return content.substring(0, width - 3) + '...';
  }

  /**
   * Format file path for display
   */
  protected formatFilePath(filePath: string): string {
    // Normalize path separators and remove leading ./
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * Calculate percentage for statistics
   */
  protected calculatePercentage(part: number, total: number): string {
    if (total === 0) return '0.0';
    return ((part / total) * 100).toFixed(1);
  }

  /**
   * Get change type symbol for terminal display
   */
  protected getChangeSymbol(type: 'add' | 'remove' | 'modify'): string {
    switch (type) {
      case 'add': return '+';
      case 'remove': return '-';
      case 'modify': return '~';
      default: return ' ';
    }
  }

  /**
   * Validate render options
   */
  protected validateOptions(): void {
    if (this.options.maxWidth && this.options.maxWidth < 40) {
      throw new Error('maxWidth must be at least 40 characters');
    }
  }
}
