/**
 * Terminal renderer for diff output with ANSI colors and formatting
 * Provides rich terminal display with syntax highlighting
 */

import chalk from 'chalk';
import { StyleDiffResult, DiffRenderOptions, RenderedDiff, DiffChunk, DiffChange, DiffRenderFormat } from '../types';
import { BaseDiffRenderer } from './base-renderer';

export interface TerminalRenderOptions extends DiffRenderOptions {
  useColors?: boolean;
  showProgress?: boolean;
  compactMode?: boolean;
  highlightSyntax?: boolean;
}

export class TerminalRenderer extends BaseDiffRenderer {
  private readonly colors = {
    added: chalk.green,
    removed: chalk.red,
    modified: chalk.yellow,
    context: chalk.gray,
    lineNumber: chalk.cyan,
    fileName: chalk.bold.blue,
    metadata: chalk.dim,
    highlight: chalk.bold,
    warning: chalk.yellow,
    error: chalk.red.bold,
    success: chalk.green.bold,
    header: chalk.bold.white,
    separator: chalk.dim.gray
  };

  protected options: TerminalRenderOptions;

  constructor(options: TerminalRenderOptions = {}) {
    super(options);
    this.options = {
      useColors: true,
      showProgress: false,
      compactMode: false,
      highlightSyntax: true,
      ...options
    };
  }

  async render(diffResult: StyleDiffResult): Promise<RenderedDiff> {
    this.validateOptions();
    
    const output: string[] = [];

    // Add header
    output.push(this.renderHeader(diffResult));
    output.push('');

    // Add summary
    output.push(this.renderSummary(diffResult));
    output.push('');

    // Add file diffs
    for (const fileDiff of diffResult.fileDiffs) {
      if (fileDiff.chunks.length > 0) {
        output.push(this.renderFileDiff(fileDiff));
        output.push('');
      }
    }

    // Add metadata if requested
    if (this.options.includeMetadata) {
      output.push(this.renderMetadata(diffResult));
    }    return {
      format: DiffRenderFormat.TERMINAL,
      content: output.join('\n'),
      metadata: {
        generatedAt: Date.now(),
        options: this.options,
        ...this.generateMetadata(diffResult)
      }
    };
  }
  protected combineRenderedResults(parts: RenderedDiff[]): RenderedDiff {
    const combinedContent = parts.map(part => part.content).join('\n\n');

    return {
      format: DiffRenderFormat.TERMINAL,
      content: combinedContent,
      metadata: {
        generatedAt: Date.now(),
        options: this.options,
        resultCount: parts.length
      }
    };
  }

  private renderHeader(diffResult: StyleDiffResult): string {
    const title = this.options.useColors 
      ? this.colors.header('Style Diff Analysis')
      : 'Style Diff Analysis';
    
    const comparison = this.options.useColors
      ? `${this.colors.fileName(diffResult.branch1)} → ${this.colors.fileName(diffResult.branch2)}`
      : `${diffResult.branch1} → ${diffResult.branch2}`;

    const separator = this.options.useColors
      ? this.colors.separator('═'.repeat(60))
      : '═'.repeat(60);

    return [
      separator,
      title,
      comparison,
      separator
    ].join('\n');
  }

  private renderSummary(diffResult: StyleDiffResult): string {
    const summary = diffResult.summary;
    const lines: string[] = [];

    if (this.options.useColors) {
      lines.push(this.colors.highlight('Summary:'));
      lines.push(`  Files changed: ${this.colors.fileName(summary.filesChanged.toString())}`);
      lines.push(`  Total changes: ${this.colors.modified(summary.totalChanges.toString())}`);
      lines.push(`  Added lines: ${this.colors.added('+' + summary.addedLines)}`);
      lines.push(`  Removed lines: ${this.colors.removed('-' + summary.removedLines)}`);
      lines.push(`  Modified lines: ${this.colors.modified('~' + summary.modifiedLines)}`);
    } else {
      lines.push('Summary:');
      lines.push(`  Files changed: ${summary.filesChanged}`);
      lines.push(`  Total changes: ${summary.totalChanges}`);
      lines.push(`  Added lines: +${summary.addedLines}`);
      lines.push(`  Removed lines: -${summary.removedLines}`);
      lines.push(`  Modified lines: ~${summary.modifiedLines}`);
    }

    return lines.join('\n');
  }

  private renderFileDiff(fileDiff: any): string {
    const lines: string[] = [];
    
    // File header
    const fileName = this.formatFilePath(fileDiff.filePath);
    const fileHeader = this.options.useColors
      ? this.colors.fileName(`diff --scss ${fileName}`)
      : `diff --scss ${fileName}`;
    
    lines.push(fileHeader);

    if (!this.options.compactMode && fileDiff.metadata) {
      lines.push(this.renderFileMetadata(fileDiff.metadata));
    }

    // Render chunks
    fileDiff.chunks.forEach((chunk: DiffChunk, index: number) => {
      lines.push(this.renderChunk(chunk, index));
    });

    return lines.join('\n');
  }

  private renderFileMetadata(metadata: any): string {
    const lines: string[] = [];
    
    if (metadata.variableChanges && metadata.variableChanges.length > 0) {
      const label = this.options.useColors 
        ? this.colors.warning('Variables changed:')
        : 'Variables changed:';
      lines.push(label);
      
      metadata.variableChanges.forEach((change: any) => {
        const varLine = this.options.useColors
          ? `  ${this.colors.modified(change.variable)}: ${change.oldValue} → ${change.newValue}`
          : `  ${change.variable}: ${change.oldValue} → ${change.newValue}`;
        lines.push(varLine);
      });
    }

    return lines.join('\n');
  }

  private renderChunk(chunk: DiffChunk, index: number): string {
    const lines: string[] = [];
    
    // Chunk header
    const header = this.options.useColors
      ? this.colors.metadata(`@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`)
      : `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`;
    
    lines.push(header);

    // Render changes
    chunk.changes.forEach(change => {
      lines.push(this.renderChange(change));
    });

    return lines.join('\n');
  }

  private renderChange(change: DiffChange): string {
    const symbol = this.getChangeSymbol(change.type);
    let line = '';

    // Add line number if requested
    if (this.options.includeLineNumbers) {
      const lineNum = this.options.useColors
        ? this.colors.lineNumber(change.lineNumber?.toString().padStart(4) || '    ')
        : (change.lineNumber?.toString().padStart(4) || '    ');
      line += lineNum + ' ';
    }

    // Add change symbol and content
    const content = this.truncateContent(change.content);
    
    if (this.options.useColors) {
      const coloredSymbol = this.colorizeChangeSymbol(symbol, change.type);
      const coloredContent = this.colorizeContent(content, change.type);
      line += coloredSymbol + ' ' + coloredContent;
    } else {
      line += symbol + ' ' + content;
    }

    // Add CSS property analysis if available
    if (change.cssPropertyChanges && change.cssPropertyChanges.length > 0) {
      const propertyInfo = this.renderPropertyChanges(change.cssPropertyChanges);
      if (propertyInfo) {
        line += '\n' + propertyInfo;
      }
    }

    return line;
  }

  private colorizeChangeSymbol(symbol: string, type: 'add' | 'remove' | 'modify'): string {
    switch (type) {
      case 'add': return this.colors.added(symbol);
      case 'remove': return this.colors.removed(symbol);
      case 'modify': return this.colors.modified(symbol);
      default: return symbol;
    }
  }

  private colorizeContent(content: string, type: 'add' | 'remove' | 'modify'): string {
    if (!this.options.highlightSyntax) {
      switch (type) {
        case 'add': return this.colors.added(content);
        case 'remove': return this.colors.removed(content);
        case 'modify': return this.colors.modified(content);
        default: return this.colors.context(content);
      }
    }

    // Basic SCSS syntax highlighting
    const highlighted = this.applySyntaxHighlighting(content);
    
    switch (type) {
      case 'add': return this.colors.added(highlighted);
      case 'remove': return this.colors.removed(highlighted);
      case 'modify': return this.colors.modified(highlighted);
      default: return this.colors.context(highlighted);
    }
  }

  private applySyntaxHighlighting(content: string): string {
    if (!this.options.useColors || !this.options.highlightSyntax) {
      return content;
    }

    // Simple SCSS syntax highlighting
    return content
      .replace(/(\$[\w-]+)/g, this.colors.highlight('$1')) // Variables
      .replace(/([\w-]+)(\s*):/g, `${this.colors.highlight('$1')}$2:`) // Properties
      .replace(/(#[0-9a-fA-F]{3,6})/g, this.colors.highlight('$1')) // Colors
      .replace(/(\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw))/g, this.colors.highlight('$1')); // Units
  }

  private renderPropertyChanges(changes: any[]): string {
    if (!changes.length) return '';

    const lines: string[] = [];
    
    changes.forEach(change => {
      const impact = change.impact.toUpperCase();
      const category = change.category.toUpperCase();
      
      const info = this.options.useColors
        ? `    ${this.colors.metadata('↳')} ${this.colors.warning(impact)} ${category} property`
        : `    ↳ ${impact} ${category} property`;
      
      lines.push(info);
    });

    return lines.join('\n');
  }

  private renderMetadata(diffResult: StyleDiffResult): string {
    const metadata = this.generateMetadata(diffResult);
    const lines: string[] = [];

    const title = this.options.useColors
      ? this.colors.header('Metadata & Statistics')
      : 'Metadata & Statistics';
    
    lines.push(title);
    lines.push(this.options.useColors ? this.colors.separator('─'.repeat(40)) : '─'.repeat(40));

    // Statistics
    if (metadata.statistics) {
      lines.push(this.renderStatistics(metadata.statistics));
    }

    return lines.join('\n');
  }

  private renderStatistics(stats: any): string {
    const lines: string[] = [];
    
    if (this.options.useColors) {
      lines.push(this.colors.highlight('Statistics:'));
      lines.push(`  Total files: ${this.colors.fileName(stats.totalFiles)}`);
      lines.push(`  Changed files: ${this.colors.modified(stats.changedFiles)}`);
      lines.push(`  Total chunks: ${this.colors.metadata(stats.totalChunks)}`);
    } else {
      lines.push('Statistics:');
      lines.push(`  Total files: ${stats.totalFiles}`);
      lines.push(`  Changed files: ${stats.changedFiles}`);
      lines.push(`  Total chunks: ${stats.totalChunks}`);
    }

    // Impact analysis
    if (stats.impactAnalysis) {
      const impactTitle = this.options.useColors
        ? this.colors.highlight('Impact Analysis:')
        : 'Impact Analysis:';
      
      lines.push(impactTitle);
      lines.push(`  High impact: ${stats.impactAnalysis.high}`);
      lines.push(`  Medium impact: ${stats.impactAnalysis.medium}`);
      lines.push(`  Low impact: ${stats.impactAnalysis.low}`);
    }

    return lines.join('\n');
  }
}
