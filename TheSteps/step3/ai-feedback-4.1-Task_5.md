# Task 5: Diff Formatting (Unified, Split, Summary)

## Overview
This task implements comprehensive diff formatting capabilities that transform the analyzed 
diff data into various human-readable and machine-processable formats. Building on the 
contextual analysis from previous tasks, this task provides unified, split-view, and 
summary formatting options with customizable styling and output preferences.

## Prerequisites
- Task 1: Core Diff Infrastructure and Type Definitions (completed)
- Task 2: Text-Level Diff Analyzer (completed)
- Task 3: Semantic CSS Analysis and Property Categorization (completed)
- Task 4: SCSS Variable Resolution and Context Analysis (completed)

## Dependencies
- Existing type definitions from previous tasks
- Terminal styling with chalk
- Optional HTML template generation

## Task Breakdown

### 5.1 Base Diff Formatter (`src/diff/base-diff-formatter.ts`)

Create an abstract base class for all diff formatters:

```typescript
import { 
  DiffChunk, 
  DiffFormatOptions, 
  FormattedDiffResult,
  ContextualDiffResult 
} from './types';

export abstract class BaseDiffFormatter {
  protected options: DiffFormatOptions;

  constructor(options: DiffFormatOptions = {}) {
    this.options = {
      showLineNumbers: true,
      showContext: true,
      contextLines: 3,
      highlightSyntax: false,
      showVariableResolution: true,
      showSemanticAnalysis: true,
      colorOutput: true,
      showMetadata: false,
      ...options
    };
  }

  /**
   * Format a contextual diff result
   */
  public abstract format(diffResult: ContextualDiffResult): Promise<FormattedDiffResult>;

  /**
   * Format individual diff chunks
   */
  protected abstract formatChunks(chunks: DiffChunk[]): string;

  /**
   * Format metadata information
   */
  protected formatMetadata(diffResult: ContextualDiffResult): string {
    if (!this.options.showMetadata) return '';

    const metadata: string[] = [
      `File: ${diffResult.filePath}`,
      `Summary: ${diffResult.summary}`
    ];

    if (diffResult.variableImpact.modifiedVariables.length > 0) {
      metadata.push(`Variables: ${diffResult.variableImpact.modifiedVariables.length} modified`);
    }

    if (diffResult.selectorChanges.length > 0) {
      metadata.push(`Selectors: ${diffResult.selectorChanges.length} changed`);
    }

    if (diffResult.importChanges.length > 0) {
      metadata.push(`Imports: ${diffResult.importChanges.length} changed`);
    }

    return metadata.join('\n') + '\n\n';
  }

  /**
   * Format variable impact information
   */
  protected formatVariableImpact(diffResult: ContextualDiffResult): string {
    if (!this.options.showVariableResolution || diffResult.variableImpact.modifiedVariables.length === 0) {
      return '';
    }

    const sections: string[] = [];

    // Modified variables
    if (diffResult.variableImpact.modifiedVariables.length > 0) {
      sections.push('Modified Variables:');
      diffResult.variableImpact.modifiedVariables.forEach(variable => {
        sections.push(`  $${variable.variable.name}: ${variable.oldValue} → ${variable.newValue} (${variable.impact} impact)`);
      });
    }

    // Cascade effects
    if (diffResult.variableImpact.cascadeEffects.length > 0) {
      sections.push('\nCascade Effects:');
      diffResult.variableImpact.cascadeEffects.forEach(effect => {
        if (effect.affectedVariables.length > 0) {
          sections.push(`  $${effect.variableName} affects ${effect.affectedVariables.length} variables (depth: ${effect.cascadeDepth})`);
        }
      });
    }

    // Recommendations
    if (diffResult.variableImpact.recommendations.length > 0) {
      sections.push('\nRecommendations:');
      diffResult.variableImpact.recommendations.forEach(rec => {
        sections.push(`  • ${rec}`);
      });
    }

    return sections.length > 0 ? sections.join('\n') + '\n\n' : '';
  }

  /**
   * Format selector changes
   */
  protected formatSelectorChanges(diffResult: ContextualDiffResult): string {
    if (diffResult.selectorChanges.length === 0) return '';

    const sections: string[] = ['Selector Changes:'];

    diffResult.selectorChanges.forEach(change => {
      switch (change.type) {
        case 'added':
          sections.push(`  + ${change.newSelector} (line ${change.line})`);
          break;
        case 'removed':
          sections.push(`  - ${change.oldSelector} (line ${change.line})`);
          break;
        case 'modified':
          sections.push(`  ~ ${change.oldSelector} → ${change.newSelector} (line ${change.line})`);
          sections.push(`    ${change.reasoning} (${change.impact} impact)`);
          break;
      }
    });

    return sections.join('\n') + '\n\n';
  }

  /**
   * Format import changes
   */
  protected formatImportChanges(diffResult: ContextualDiffResult): string {
    if (diffResult.importChanges.length === 0) return '';

    const sections: string[] = ['Import Changes:'];

    diffResult.importChanges.forEach(change => {
      const prefix = change.type === 'added' ? '+' : '-';
      sections.push(`  ${prefix} @import '${change.importPath}' (line ${change.line})`);
      sections.push(`    ${change.reasoning}`);
    });

    return sections.join('\n') + '\n\n';
  }

  /**
   * Get line number string with padding
   */
  protected formatLineNumber(lineNumber: number, maxLineNumber: number): string {
    if (!this.options.showLineNumbers) return '';
    
    const padding = maxLineNumber.toString().length;
    return lineNumber.toString().padStart(padding, ' ');
  }

  /**
   * Escape special characters for output format
   */
  protected escapeContent(content: string): string {
    // Base implementation - can be overridden by subclasses
    return content;
  }

  /**
   * Apply syntax highlighting if enabled
   */
  protected applySyntaxHighlighting(content: string, language: string = 'scss'): string {
    if (!this.options.highlightSyntax) return content;
    
    // Basic SCSS syntax highlighting
    return content
      .replace(/(\$[a-zA-Z0-9_-]+)/g, '{{variable}}$1{{/variable}}')
      .replace(/(@[a-zA-Z-]+)/g, '{{directive}}$1{{/directive}}')
      .replace(/(\/\*.*?\*\/)/gs, '{{comment}}$1{{/comment}}')
      .replace(/(\/\/.*$)/gm, '{{comment}}$1{{/comment}}')
      .replace(/([.#][a-zA-Z0-9_-]+)/g, '{{selector}}$1{{/selector}}')
      .replace(/([a-zA-Z-]+)(\s*:)/g, '{{property}}$1{{/property}}$2');
  }

  /**
   * Get max line number for formatting
   */
  protected getMaxLineNumber(chunks: DiffChunk[]): number {
    let maxLine = 0;
    
    for (const chunk of chunks) {
      for (const change of chunk.changes) {
        maxLine = Math.max(maxLine, change.lineNumber);
      }
    }
    
    return maxLine;
  }
}
```

### 5.2 Unified Diff Formatter (`src/diff/unified-diff-formatter.ts`)

Create a unified diff formatter (similar to Git diff format):

```typescript
import { BaseDiffFormatter } from './base-diff-formatter';
import { 
  DiffChunk, 
  DiffChange, 
  ContextualDiffResult, 
  FormattedDiffResult 
} from './types';
import chalk from 'chalk';

export class UnifiedDiffFormatter extends BaseDiffFormatter {
  
  public async format(diffResult: ContextualDiffResult): Promise<FormattedDiffResult> {
    const sections: string[] = [];

    // Add metadata if enabled
    if (this.options.showMetadata) {
      sections.push(this.formatMetadata(diffResult));
    }

    // Add variable impact analysis
    sections.push(this.formatVariableImpact(diffResult));

    // Add selector changes
    sections.push(this.formatSelectorChanges(diffResult));

    // Add import changes
    sections.push(this.formatImportChanges(diffResult));

    // Add formatted chunks
    sections.push(this.formatChunks(diffResult.chunks));

    const formattedContent = sections.filter(s => s.trim()).join('');

    return {
      format: 'unified',
      content: formattedContent,
      metadata: {
        totalChunks: diffResult.chunks.length,
        totalChanges: diffResult.chunks.reduce((sum, chunk) => sum + chunk.changes.length, 0),
        variableChanges: diffResult.variableImpact.modifiedVariables.length,
        selectorChanges: diffResult.selectorChanges.length,
        importChanges: diffResult.importChanges.length
      }
    };
  }

  protected formatChunks(chunks: DiffChunk[]): string {
    if (chunks.length === 0) return 'No changes detected.\n';

    const maxLineNumber = this.getMaxLineNumber(chunks);
    const formatted: string[] = [];

    for (const chunk of chunks) {
      formatted.push(this.formatChunkHeader(chunk));
      formatted.push(this.formatChunkChanges(chunk, maxLineNumber));
      
      // Add semantic summary if available
      if (this.options.showSemanticAnalysis && chunk.context?.semanticSummary) {
        formatted.push(this.formatSemanticSummary(chunk.context.semanticSummary));
      }
      
      formatted.push(''); // Empty line between chunks
    }

    return formatted.join('\n');
  }

  private formatChunkHeader(chunk: DiffChunk): string {
    const header = `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`;
    
    if (this.options.colorOutput) {
      return chalk.cyan(header);
    }
    
    return header;
  }

  private formatChunkChanges(chunk: DiffChunk, maxLineNumber: number): string {
    const changes: string[] = [];

    for (const change of chunk.changes) {
      changes.push(this.formatChange(change, maxLineNumber));
      
      // Add CSS property details if available
      if (this.options.showSemanticAnalysis && change.cssProperties && change.cssProperties.length > 0) {
        changes.push(this.formatCssPropertyDetails(change.cssProperties));
      }

      // Add variable resolution details if available
      if (this.options.showVariableResolution && change.resolvedOldValue !== undefined) {
        changes.push(this.formatVariableResolution(change));
      }
    }

    return changes.join('\n');
  }

  private formatChange(change: DiffChange, maxLineNumber: number): string {
    const lineNum = this.formatLineNumber(change.lineNumber, maxLineNumber);
    const prefix = this.getChangePrefix(change.type);
    const content = this.applySyntaxHighlighting(this.escapeContent(change.content));

    let formatted = `${lineNum}${prefix}${content}`;

    if (this.options.colorOutput) {
      formatted = this.applyColorToChange(formatted, change.type);
    }

    return formatted;
  }

  private getChangePrefix(changeType: string): string {
    switch (changeType) {
      case 'added': return this.options.showLineNumbers ? ' +' : '+';
      case 'removed': return this.options.showLineNumbers ? ' -' : '-';
      case 'context': return this.options.showLineNumbers ? '  ' : ' ';
      default: return this.options.showLineNumbers ? '  ' : ' ';
    }
  }

  private applyColorToChange(content: string, changeType: string): string {
    switch (changeType) {
      case 'added':
        return chalk.green(content);
      case 'removed':
        return chalk.red(content);
      case 'context':
        return chalk.gray(content);
      default:
        return content;
    }
  }

  private formatCssPropertyDetails(cssProperties: any[]): string {
    const details: string[] = [];

    for (const property of cssProperties) {
      const impact = property.impact ? ` (${property.impact} impact)` : '';
      const category = property.category ? ` [${property.category}]` : '';
      
      if (property.oldValue && property.newValue) {
        details.push(`    CSS: ${property.property}${category}: ${property.oldValue} → ${property.newValue}${impact}`);
      } else if (property.newValue) {
        details.push(`    CSS: +${property.property}${category}: ${property.newValue}${impact}`);
      } else if (property.oldValue) {
        details.push(`    CSS: -${property.property}${category}: ${property.oldValue}${impact}`);
      }

      if (property.reasoning) {
        details.push(`         ${property.reasoning}`);
      }
    }

    if (details.length > 0) {
      if (this.options.colorOutput) {
        return chalk.dim(details.join('\n'));
      }
      return details.join('\n');
    }

    return '';
  }

  private formatVariableResolution(change: DiffChange): string {
    const details: string[] = [];

    if (change.resolvedOldValue && change.resolvedOldValue !== change.content) {
      details.push(`    Resolved: ${change.resolvedOldValue}`);
    }

    if (change.resolvedNewValue && change.resolvedNewValue !== change.content) {
      details.push(`    Resolved: ${change.resolvedNewValue}`);
    }

    if (change.variableResolutions && change.variableResolutions.length > 0) {
      change.variableResolutions.forEach(resolution => {
        details.push(`    Variable: $${resolution.variableName}: ${resolution.originalValue} → ${resolution.resolvedValue}`);
      });
    }

    if (details.length > 0) {
      if (this.options.colorOutput) {
        return chalk.dim(details.join('\n'));
      }
      return details.join('\n');
    }

    return '';
  }

  private formatSemanticSummary(summary: string): string {
    const formatted = `    Summary: ${summary}`;
    
    if (this.options.colorOutput) {
      return chalk.italic.dim(formatted);
    }
    
    return formatted;
  }

  protected escapeContent(content: string): string {
    // For terminal output, no escaping needed
    return content;
  }

  protected applySyntaxHighlighting(content: string): string {
    if (!this.options.highlightSyntax || !this.options.colorOutput) {
      return content;
    }

    return super.applySyntaxHighlighting(content)
      .replace(/\{\{variable\}\}([^{]+)\{\{\/variable\}\}/g, chalk.blue('$1'))
      .replace(/\{\{directive\}\}([^{]+)\{\{\/directive\}\}/g, chalk.magenta('$1'))
      .replace(/\{\{comment\}\}([^{]+)\{\{\/comment\}\}/g, chalk.gray('$1'))
      .replace(/\{\{selector\}\}([^{]+)\{\{\/selector\}\}/g, chalk.yellow('$1'))
      .replace(/\{\{property\}\}([^{]+)\{\{\/property\}\}/g, chalk.cyan('$1'));
  }
}
```

### 5.3 Split View Diff Formatter (`src/diff/split-diff-formatter.ts`)

Create a split-view diff formatter (side-by-side comparison):

```typescript
import { BaseDiffFormatter } from './base-diff-formatter';
import { 
  DiffChunk, 
  DiffChange, 
  ContextualDiffResult, 
  FormattedDiffResult 
} from './types';
import chalk from 'chalk';

export class SplitDiffFormatter extends BaseDiffFormatter {
  private readonly columnWidth: number;
  private readonly separator: string;

  constructor(options: any = {}) {
    super(options);
    this.columnWidth = options.columnWidth || 60;
    this.separator = options.separator || ' │ ';
  }

  public async format(diffResult: ContextualDiffResult): Promise<FormattedDiffResult> {
    const sections: string[] = [];

    // Add header
    sections.push(this.formatHeader(diffResult));

    // Add metadata if enabled
    if (this.options.showMetadata) {
      sections.push(this.formatMetadata(diffResult));
    }

    // Add variable impact analysis
    sections.push(this.formatVariableImpact(diffResult));

    // Add selector changes
    sections.push(this.formatSelectorChanges(diffResult));

    // Add import changes
    sections.push(this.formatImportChanges(diffResult));

    // Add formatted chunks
    sections.push(this.formatChunks(diffResult.chunks));

    const formattedContent = sections.filter(s => s.trim()).join('');

    return {
      format: 'split',
      content: formattedContent,
      metadata: {
        totalChunks: diffResult.chunks.length,
        totalChanges: diffResult.chunks.reduce((sum, chunk) => sum + chunk.changes.length, 0),
        variableChanges: diffResult.variableImpact.modifiedVariables.length,
        selectorChanges: diffResult.selectorChanges.length,
        importChanges: diffResult.importChanges.length,
        columnWidth: this.columnWidth
      }
    };
  }

  protected formatChunks(chunks: DiffChunk[]): string {
    if (chunks.length === 0) return 'No changes detected.\n';

    const maxLineNumber = this.getMaxLineNumber(chunks);
    const formatted: string[] = [];

    for (const chunk of chunks) {
      formatted.push(this.formatChunkHeader(chunk));
      formatted.push(this.formatSplitChunkChanges(chunk, maxLineNumber));
      
      // Add semantic summary if available
      if (this.options.showSemanticAnalysis && chunk.context?.semanticSummary) {
        formatted.push(this.formatSemanticSummary(chunk.context.semanticSummary));
      }
      
      formatted.push(''); // Empty line between chunks
    }

    return formatted.join('\n');
  }

  private formatHeader(diffResult: ContextualDiffResult): string {
    const title = `Diff: ${diffResult.filePath}`;
    const separator = '─'.repeat(Math.max(title.length, this.columnWidth * 2 + this.separator.length));
    
    const leftHeader = 'Before';
    const rightHeader = 'After';
    const headerLine = this.padToWidth(leftHeader, this.columnWidth) + 
                      this.separator + 
                      this.padToWidth(rightHeader, this.columnWidth);

    const lines = [
      title,
      separator,
      headerLine,
      separator,
      ''
    ];

    if (this.options.colorOutput) {
      return lines.map(line => 
        line === title ? chalk.bold(line) :
        line === headerLine ? chalk.dim(line) :
        line
      ).join('\n');
    }

    return lines.join('\n');
  }

  private formatChunkHeader(chunk: DiffChunk): string {
    const header = `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`;
    const centeredHeader = this.centerText(header, this.columnWidth * 2 + this.separator.length);
    
    if (this.options.colorOutput) {
      return chalk.cyan(centeredHeader);
    }
    
    return centeredHeader;
  }

  private formatSplitChunkChanges(chunk: DiffChunk, maxLineNumber: number): string {
    const lines: string[] = [];
    const changes = this.organizeSplitChanges(chunk.changes);

    for (const changePair of changes) {
      const line = this.formatSplitChangePair(changePair, maxLineNumber);
      lines.push(line);

      // Add CSS property details if available
      if (this.options.showSemanticAnalysis) {
        const propertyDetails = this.formatSplitCssProperties(changePair);
        if (propertyDetails) {
          lines.push(propertyDetails);
        }
      }
    }

    return lines.join('\n');
  }

  private organizeSplitChanges(changes: DiffChange[]): Array<{
    left?: DiffChange;
    right?: DiffChange;
  }> {
    const organized: Array<{ left?: DiffChange; right?: DiffChange }> = [];
    const removedChanges: DiffChange[] = [];
    const addedChanges: DiffChange[] = [];
    const contextChanges: DiffChange[] = [];

    // Separate changes by type
    for (const change of changes) {
      switch (change.type) {
        case 'removed':
          removedChanges.push(change);
          break;
        case 'added':
          addedChanges.push(change);
          break;
        case 'context':
          contextChanges.push(change);
          break;
      }
    }

    // Handle context changes (appear on both sides)
    for (const contextChange of contextChanges) {
      organized.push({
        left: contextChange,
        right: contextChange
      });
    }

    // Pair removed and added changes
    const maxPairs = Math.max(removedChanges.length, addedChanges.length);
    for (let i = 0; i < maxPairs; i++) {
      organized.push({
        left: removedChanges[i],
        right: addedChanges[i]
      });
    }

    return organized;
  }

  private formatSplitChangePair(
    changePair: { left?: DiffChange; right?: DiffChange },
    maxLineNumber: number
  ): string {
    const leftSide = this.formatSplitChange(changePair.left, maxLineNumber, 'left');
    const rightSide = this.formatSplitChange(changePair.right, maxLineNumber, 'right');

    return leftSide + this.separator + rightSide;
  }

  private formatSplitChange(
    change: DiffChange | undefined,
    maxLineNumber: number,
    side: 'left' | 'right'
  ): string {
    if (!change) {
      return this.padToWidth('', this.columnWidth);
    }

    const lineNum = this.formatLineNumber(change.lineNumber, maxLineNumber);
    const content = this.applySyntaxHighlighting(this.escapeContent(change.content));
    const prefix = this.getSplitChangePrefix(change.type, side);
    
    let formatted = `${lineNum}${prefix}${content}`;

    // Truncate if too long
    const maxContentWidth = this.columnWidth - lineNum.length - prefix.length;
    if (formatted.length > this.columnWidth) {
      const truncatedContent = content.substring(0, maxContentWidth - 3) + '...';
      formatted = `${lineNum}${prefix}${truncatedContent}`;
    }

    formatted = this.padToWidth(formatted, this.columnWidth);

    if (this.options.colorOutput) {
      formatted = this.applySplitColorToChange(formatted, change.type, side);
    }

    return formatted;
  }

  private getSplitChangePrefix(changeType: string, side: 'left' | 'right'): string {
    switch (changeType) {
      case 'added':
        return side === 'right' ? '+' : ' ';
      case 'removed':
        return side === 'left' ? '-' : ' ';
      case 'context':
        return ' ';
      default:
        return ' ';
    }
  }

  private applySplitColorToChange(content: string, changeType: string, side: 'left' | 'right'): string {
    switch (changeType) {
      case 'added':
        return side === 'right' ? chalk.green(content) : chalk.dim(content);
      case 'removed':
        return side === 'left' ? chalk.red(content) : chalk.dim(content);
      case 'context':
        return chalk.dim(content);
      default:
        return content;
    }
  }

  private formatSplitCssProperties(changePair: { left?: DiffChange; right?: DiffChange }): string {
    const leftProps = changePair.left?.cssProperties || [];
    const rightProps = changePair.right?.cssProperties || [];
    
    if (leftProps.length === 0 && rightProps.length === 0) {
      return '';
    }

    const leftDetails = this.formatCssPropertiesForSide(leftProps, 'left');
    const rightDetails = this.formatCssPropertiesForSide(rightProps, 'right');

    return leftDetails + this.separator + rightDetails;
  }

  private formatCssPropertiesForSide(cssProperties: any[], side: 'left' | 'right'): string {
    if (cssProperties.length === 0) {
      return this.padToWidth('', this.columnWidth);
    }

    const details: string[] = [];
    
    for (const property of cssProperties) {
      const value = side === 'left' ? property.oldValue : property.newValue;
      if (value) {
        const propertyInfo = `  ${property.property}: ${value}`;
        details.push(propertyInfo);
      }
    }

    const formatted = details.join(', ');
    const truncated = formatted.length > this.columnWidth - 4 ? 
                     formatted.substring(0, this.columnWidth - 7) + '...' : 
                     formatted;

    const result = this.padToWidth(truncated, this.columnWidth);
    
    if (this.options.colorOutput) {
      return chalk.dim(result);
    }
    
    return result;
  }

  private formatSemanticSummary(summary: string): string {
    const centeredSummary = this.centerText(`Summary: ${summary}`, this.columnWidth * 2 + this.separator.length);
    
    if (this.options.colorOutput) {
      return chalk.italic.dim(centeredSummary);
    }
    
    return centeredSummary;
  }

  private padToWidth(text: string, width: number): string {
    if (text.length >= width) {
      return text.substring(0, width);
    }
    return text + ' '.repeat(width - text.length);
  }

  private centerText(text: string, width: number): string {
    if (text.length >= width) {
      return text.substring(0, width);
    }
    
    const padding = width - text.length;
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  protected applySyntaxHighlighting(content: string): string {
    if (!this.options.highlightSyntax || !this.options.colorOutput) {
      return content;
    }

    // Use same highlighting as unified formatter but with truncation awareness
    return super.applySyntaxHighlighting(content)
      .replace(/\{\{variable\}\}([^{]+)\{\{\/variable\}\}/g, chalk.blue('$1'))
      .replace(/\{\{directive\}\}([^{]+)\{\{\/directive\}\}/g, chalk.magenta('$1'))
      .replace(/\{\{comment\}\}([^{]+)\{\{\/comment\}\}/g, chalk.gray('$1'))
      .replace(/\{\{selector\}\}([^{]+)\{\{\/selector\}\}/g, chalk.yellow('$1'))
      .replace(/\{\{property\}\}([^{]+)\{\{\/property\}\}/g, chalk.cyan('$1'));
  }
}
```

### 5.4 Summary Diff Formatter (`src/diff/summary-diff-formatter.ts`)

Create a summary formatter that provides high-level overview:

```typescript
import { BaseDiffFormatter } from './base-diff-formatter';
import { 
  ContextualDiffResult, 
  FormattedDiffResult,
  DiffChunk 
} from './types';
import chalk from 'chalk';

export class SummaryDiffFormatter extends BaseDiffFormatter {
  
  public async format(diffResult: ContextualDiffResult): Promise<FormattedDiffResult> {
    const sections: string[] = [];

    // File summary
    sections.push(this.formatFileSummary(diffResult));

    // Statistics
    sections.push(this.formatStatistics(diffResult));

    // High-impact changes
    sections.push(this.formatHighImpactChanges(diffResult));

    // Variable impact summary
    sections.push(this.formatVariableImpactSummary(diffResult));

    // Selector changes summary
    sections.push(this.formatSelectorChangesSummary(diffResult));

    // Import changes summary
    sections.push(this.formatImportChangesSummary(diffResult));

    // Recommendations
    sections.push(this.formatRecommendations(diffResult));

    const formattedContent = sections.filter(s => s.trim()).join('');

    return {
      format: 'summary',
      content: formattedContent,
      metadata: {
        totalChunks: diffResult.chunks.length,
        totalChanges: diffResult.chunks.reduce((sum, chunk) => sum + chunk.changes.length, 0),
        variableChanges: diffResult.variableImpact.modifiedVariables.length,
        selectorChanges: diffResult.selectorChanges.length,
        importChanges: diffResult.importChanges.length,
        highImpactChanges: this.countHighImpactChanges(diffResult)
      }
    };
  }

  protected formatChunks(chunks: DiffChunk[]): string {
    // Summary formatter doesn't need detailed chunk formatting
    return '';
  }

  private formatFileSummary(diffResult: ContextualDiffResult): string {
    const fileName = diffResult.filePath.split('/').pop() || diffResult.filePath;
    const title = `📄 ${fileName}`;
    
    const summary = diffResult.summary || 'No summary available';
    
    const lines = [
      title,
      '─'.repeat(Math.max(title.length, 40)),
      summary,
      ''
    ];

    if (this.options.colorOutput) {
      return chalk.bold.blue(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines[2] + '\n' + 
             lines[3];
    }

    return lines.join('\n');
  }

  private formatStatistics(diffResult: ContextualDiffResult): string {
    const stats = this.calculateStatistics(diffResult);
    
    const lines = [
      '📊 Statistics',
      '─'.repeat(15),
      `Total Changes: ${stats.totalChanges}`,
      `Lines Added: ${stats.linesAdded}`,
      `Lines Removed: ${stats.linesRemoved}`,
      `CSS Properties Changed: ${stats.cssPropertiesChanged}`,
      `Variables Modified: ${stats.variablesModified}`,
      `Selectors Changed: ${stats.selectorsChanged}`,
      `Imports Changed: ${stats.importsChanged}`,
      ''
    ];

    if (this.options.colorOutput) {
      return chalk.bold.green(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines.slice(2, -1).map(line => {
               const [label, value] = line.split(': ');
               return `${label}: ${chalk.yellow(value)}`;
             }).join('\n') + '\n' + 
             lines[lines.length - 1];
    }

    return lines.join('\n');
  }

  private formatHighImpactChanges(diffResult: ContextualDiffResult): string {
    const highImpactItems = this.getHighImpactItems(diffResult);
    
    if (highImpactItems.length === 0) {
      return '';
    }

    const lines = [
      '⚠️  High Impact Changes',
      '─'.repeat(22)
    ];

    highImpactItems.forEach(item => {
      lines.push(`• ${item.description} (${item.type})`);
      if (item.reason) {
        lines.push(`  ${item.reason}`);
      }
    });

    lines.push('');

    if (this.options.colorOutput) {
      return chalk.bold.red(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines.slice(2, -1).map(line => 
               line.startsWith('•') ? chalk.red(line) : chalk.dim(line)
             ).join('\n') + '\n' + 
             lines[lines.length - 1];
    }

    return lines.join('\n');
  }

  private formatVariableImpactSummary(diffResult: ContextualDiffResult): string {
    const variableImpact = diffResult.variableImpact;
    
    if (variableImpact.modifiedVariables.length === 0 && 
        variableImpact.addedVariables.length === 0 && 
        variableImpact.removedVariables.length === 0) {
      return '';
    }

    const lines = [
      '🔄 Variable Changes',
      '─'.repeat(18)
    ];

    if (variableImpact.addedVariables.length > 0) {
      lines.push(`Added: ${variableImpact.addedVariables.length} variables`);
      variableImpact.addedVariables.slice(0, 3).forEach(variable => {
        lines.push(`  + $${variable.name}`);
      });
      if (variableImpact.addedVariables.length > 3) {
        lines.push(`  ... and ${variableImpact.addedVariables.length - 3} more`);
      }
    }

    if (variableImpact.removedVariables.length > 0) {
      lines.push(`Removed: ${variableImpact.removedVariables.length} variables`);
      variableImpact.removedVariables.slice(0, 3).forEach(variable => {
        lines.push(`  - $${variable.name}`);
      });
      if (variableImpact.removedVariables.length > 3) {
        lines.push(`  ... and ${variableImpact.removedVariables.length - 3} more`);
      }
    }

    if (variableImpact.modifiedVariables.length > 0) {
      lines.push(`Modified: ${variableImpact.modifiedVariables.length} variables`);
      variableImpact.modifiedVariables.slice(0, 3).forEach(variable => {
        const impact = variable.impact === 'high' ? '⚠️' : variable.impact === 'medium' ? '⚡' : '🔹';
        lines.push(`  ${impact} $${variable.variable.name}: ${variable.oldValue} → ${variable.newValue}`);
      });
      if (variableImpact.modifiedVariables.length > 3) {
        lines.push(`  ... and ${variableImpact.modifiedVariables.length - 3} more`);
      }
    }

    // Cascade effects summary
    if (variableImpact.cascadeEffects.length > 0) {
      const totalAffected = variableImpact.cascadeEffects.reduce(
        (sum, effect) => sum + effect.affectedVariables.length, 0
      );
      lines.push(`Cascade Effects: ${totalAffected} dependent variables affected`);
    }

    lines.push('');

    if (this.options.colorOutput) {
      return chalk.bold.magenta(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines.slice(2, -1).map(line => {
               if (line.startsWith('  +')) return chalk.green(line);
               if (line.startsWith('  -')) return chalk.red(line);
               if (line.includes('⚠️')) return chalk.red(line);
               if (line.includes('⚡')) return chalk.yellow(line);
               if (line.includes('🔹')) return chalk.blue(line);
               return line;
             }).join('\n') + '\n' + 
             lines[lines.length - 1];
    }

    return lines.join('\n');
  }

  private formatSelectorChangesSummary(diffResult: ContextualDiffResult): string {
    if (diffResult.selectorChanges.length === 0) return '';

    const lines = [
      '🎯 Selector Changes',
      '─'.repeat(18)
    ];

    const byType = {
      added: diffResult.selectorChanges.filter(c => c.type === 'added'),
      removed: diffResult.selectorChanges.filter(c => c.type === 'removed'),
      modified: diffResult.selectorChanges.filter(c => c.type === 'modified')
    };

    if (byType.added.length > 0) {
      lines.push(`Added: ${byType.added.length} selectors`);
    }

    if (byType.removed.length > 0) {
      lines.push(`Removed: ${byType.removed.length} selectors`);
    }

    if (byType.modified.length > 0) {
      lines.push(`Modified: ${byType.modified.length} selectors`);
      const highImpact = byType.modified.filter(c => c.impact === 'high');
      if (highImpact.length > 0) {
        lines.push(`  ⚠️ ${highImpact.length} high-impact modifications`);
      }
    }

    lines.push('');

    if (this.options.colorOutput) {
      return chalk.bold.yellow(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines.slice(2, -1).map(line => 
               line.includes('⚠️') ? chalk.red(line) : line
             ).join('\n') + '\n' + 
             lines[lines.length - 1];
    }

    return lines.join('\n');
  }

  private formatImportChangesSummary(diffResult: ContextualDiffResult): string {
    if (diffResult.importChanges.length === 0) return '';

    const lines = [
      '📦 Import Changes',
      '─'.repeat(16)
    ];

    const added = diffResult.importChanges.filter(c => c.type === 'added');
    const removed = diffResult.importChanges.filter(c => c.type === 'removed');

    if (added.length > 0) {
      lines.push(`Added: ${added.length} imports`);
      added.slice(0, 2).forEach(change => {
        lines.push(`  + ${change.importPath}`);
      });
      if (added.length > 2) {
        lines.push(`  ... and ${added.length - 2} more`);
      }
    }

    if (removed.length > 0) {
      lines.push(`Removed: ${removed.length} imports`);
      removed.slice(0, 2).forEach(change => {
        lines.push(`  - ${change.importPath}`);
      });
      if (removed.length > 2) {
        lines.push(`  ... and ${removed.length - 2} more`);
      }
    }

    lines.push('');

    if (this.options.colorOutput) {
      return chalk.bold.cyan(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines.slice(2, -1).map(line => {
               if (line.startsWith('  +')) return chalk.green(line);
               if (line.startsWith('  -')) return chalk.red(line);
               return line;
             }).join('\n') + '\n' + 
             lines[lines.length - 1];
    }

    return lines.join('\n');
  }

  private formatRecommendations(diffResult: ContextualDiffResult): string {
    const recommendations = this.gatherRecommendations(diffResult);
    
    if (recommendations.length === 0) return '';

    const lines = [
      '💡 Recommendations',
      '─'.repeat(17)
    ];

    recommendations.slice(0, 5).forEach(rec => {
      lines.push(`• ${rec}`);
    });

    if (recommendations.length > 5) {
      lines.push(`... and ${recommendations.length - 5} more recommendations`);
    }

    lines.push('');

    if (this.options.colorOutput) {
      return chalk.bold.green(lines[0]) + '\n' + 
             chalk.dim(lines[1]) + '\n' + 
             lines.slice(2, -1).map(line => 
               line.startsWith('•') ? chalk.green(line) : chalk.dim(line)
             ).join('\n') + '\n' + 
             lines[lines.length - 1];
    }

    return lines.join('\n');
  }

  private calculateStatistics(diffResult: ContextualDiffResult): {
    totalChanges: number;
    linesAdded: number;
    linesRemoved: number;
    cssPropertiesChanged: number;
    variablesModified: number;
    selectorsChanged: number;
    importsChanged: number;
  } {
    let totalChanges = 0;
    let linesAdded = 0;
    let linesRemoved = 0;
    let cssPropertiesChanged = 0;

    for (const chunk of diffResult.chunks) {
      for (const change of chunk.changes) {
        totalChanges++;
        
        if (change.type === 'added') {
          linesAdded++;
        } else if (change.type === 'removed') {
          linesRemoved++;
        }

        if (change.cssProperties) {
          cssPropertiesChanged += change.cssProperties.length;
        }
      }
    }

    return {
      totalChanges,
      linesAdded,
      linesRemoved,
      cssPropertiesChanged,
      variablesModified: diffResult.variableImpact.modifiedVariables.length,
      selectorsChanged: diffResult.selectorChanges.length,
      importsChanged: diffResult.importChanges.length
    };
  }

  private getHighImpactItems(diffResult: ContextualDiffResult): Array<{
    type: string;
    description: string;
    reason?: string;
  }> {
    const highImpactItems: Array<{
      type: string;
      description: string;
      reason?: string;
    }> = [];

    // High-impact variable changes
    diffResult.variableImpact.modifiedVariables
      .filter(v => v.impact === 'high')
      .forEach(variable => {
        highImpactItems.push({
          type: 'Variable',
          description: `$${variable.variable.name} changed`,
          reason: `${variable.oldValue} → ${variable.newValue}`
        });
      });

    // High-impact selector changes
    diffResult.selectorChanges
      .filter(s => s.impact === 'high')
      .forEach(selector => {
        highImpactItems.push({
          type: 'Selector',
          description: selector.type === 'modified' ? 
            `${selector.oldSelector} → ${selector.newSelector}` :
            `${selector.type === 'added' ? 'Added' : 'Removed'} ${selector.oldSelector || selector.newSelector}`,
          reason: selector.reasoning
        });
      });

    // High-impact import changes
    diffResult.importChanges
      .filter(i => i.impact === 'high')
      .forEach(importChange => {
        highImpactItems.push({
          type: 'Import',
          description: `${importChange.type === 'added' ? 'Added' : 'Removed'} ${importChange.importPath}`,
          reason: importChange.reasoning
        });
      });

    return highImpactItems;
  }

  private gatherRecommendations(diffResult: ContextualDiffResult): string[] {
    const recommendations: string[] = [];

    // Variable recommendations
    recommendations.push(...diffResult.variableImpact.recommendations);

    // General recommendations based on changes
    const highImpactCount = this.countHighImpactChanges(diffResult);
    if (highImpactCount > 0) {
      recommendations.push('Consider thorough testing due to high-impact changes');
    }

    if (diffResult.variableImpact.cascadeEffects.length > 0) {
      recommendations.push('Review dependent components for cascade effects');
    }

    if (diffResult.selectorChanges.some(s => s.impact === 'high')) {
      recommendations.push('Verify CSS specificity changes don\'t break existing styles');
    }

    if (diffResult.importChanges.some(i => i.type === 'removed')) {
      recommendations.push('Ensure removed imports don\'t cause missing dependencies');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private countHighImpactChanges(diffResult: ContextualDiffResult): number {
    return diffResult.variableImpact.modifiedVariables.filter(v => v.impact === 'high').length +
           diffResult.selectorChanges.filter(s => s.impact === 'high').length +
           diffResult.importChanges.filter(i => i.impact === 'high').length;
  }
}
```

### 5.5 Enhanced Type Definitions (`src/diff/types.ts` - additions)

Add the following types to support diff formatting:

```typescript
// Add to existing types.ts file

export interface DiffFormatOptions {
  showLineNumbers?: boolean;
  showContext?: boolean;
  contextLines?: number;
  highlightSyntax?: boolean;
  showVariableResolution?: boolean;
  showSemanticAnalysis?: boolean;
  colorOutput?: boolean;
  showMetadata?: boolean;
  columnWidth?: number; // For split view
  separator?: string; // For split view
}

export interface FormattedDiffResult {
  format: 'unified' | 'split' | 'summary';
  content: string;
  metadata: {
    totalChunks: number;
    totalChanges: number;
    variableChanges: number;
    selectorChanges: number;
    importChanges: number;
    [key: string]: any; // Additional format-specific metadata
  };
}

export type DiffFormatterType = 'unified' | 'split' | 'summary';
```

## Testing Requirements

### 5.6 Test File: `src/diff/__tests__/diff-formatters.test.ts`

```typescript
import { UnifiedDiffFormatter } from '../unified-diff-formatter';
import { SplitDiffFormatter } from '../split-diff-formatter';
import { SummaryDiffFormatter } from '../summary-diff-formatter';
import { ContextualDiffResult } from '../types';

describe('Diff Formatters', () => {
  let mockDiffResult: ContextualDiffResult;

  beforeEach(() => {
    mockDiffResult = {
      filePath: 'test.component.scss',
      chunks: [
        {
          oldStart: 1,
          newStart: 1,
          oldLines: 3,
          newLines: 3,
          changes: [
            {
              type: 'context',
              content: '.button {',
              lineNumber: 1
            },
            {
              type: 'removed',
              content: '  color: red;',
              lineNumber: 2,
              cssProperties: [{
                property: 'color',
                oldValue: 'red',
                category: 'color',
                impact: 'medium'
              }]
            },
            {
              type: 'added',
              content: '  color: blue;',
              lineNumber: 2,
              cssProperties: [{
                property: 'color',
                newValue: 'blue',
                category: 'color',
                impact: 'medium'
              }]
            },
            {
              type: 'context',
              content: '}',
              lineNumber: 3
            }
          ],
          context: {
            semanticSummary: 'Color property changed'
          }
        }
      ],
      variableImpact: {
        addedVariables: [],
        removedVariables: [],
        modifiedVariables: [],
        affectedComponents: [],
        cascadeEffects: [],
        recommendations: []
      },
      selectorChanges: [],
      importChanges: [],
      summary: 'Color change detected'
    };
  });

  describe('UnifiedDiffFormatter', () => {
    let formatter: UnifiedDiffFormatter;

    beforeEach(() => {
      formatter = new UnifiedDiffFormatter({
        colorOutput: false,
        showLineNumbers: true
      });
    });

    it('should format diff in unified format', async () => {
      const result = await formatter.format(mockDiffResult);
      
      expect(result.format).toBe('unified');
      expect(result.content).toContain('@@ -1,3 +1,3 @@');
      expect(result.content).toContain('1 .button {');
      expect(result.content).toContain('2-  color: red;');
      expect(result.content).toContain('2+  color: blue;');
      expect(result.content).toContain('3 }');
    });

    it('should include CSS property details when enabled', async () => {
      formatter = new UnifiedDiffFormatter({
        colorOutput: false,
        showSemanticAnalysis: true
      });

      const result = await formatter.format(mockDiffResult);
      
      expect(result.content).toContain('CSS: color');
      expect(result.content).toContain('red → blue');
    });

    it('should include semantic summary when available', async () => {
      const result = await formatter.format(mockDiffResult);
      
      expect(result.content).toContain('Summary: Color property changed');
    });
  });

  describe('SplitDiffFormatter', () => {
    let formatter: SplitDiffFormatter;

    beforeEach(() => {
      formatter = new SplitDiffFormatter({
        colorOutput: false,
        columnWidth: 30
      });
    });

    it('should format diff in split view format', async () => {
      const result = await formatter.format(mockDiffResult);
      
      expect(result.format).toBe('split');
      expect(result.content).toContain('Before');
      expect(result.content).toContain('After');
      expect(result.content).toContain('│');
    });

    it('should align content in columns', async () => {
      const result = await formatter.format(mockDiffResult);
      
      const lines = result.content.split('\n');
      const contentLines = lines.filter(line => line.includes('│'));
      
      contentLines.forEach(line => {
        const parts = line.split('│');
        expect(parts).toHaveLength(2);
      });
    });
  });

  describe('SummaryDiffFormatter', () => {
    let formatter: SummaryDiffFormatter;

    beforeEach(() => {
      formatter = new SummaryDiffFormatter({
        colorOutput: false
      });
    });

    it('should format diff as summary', async () => {
      const result = await formatter.format(mockDiffResult);
      
      expect(result.format).toBe('summary');
      expect(result.content).toContain('📄 test.component.scss');
      expect(result.content).toContain('📊 Statistics');
      expect(result.content).toContain('Total Changes:');
    });

    it('should show high-impact changes section when present', async () => {
      mockDiffResult.variableImpact.modifiedVariables = [{
        variable: {
          name: 'primary-color',
          value: '#007bff',
          filePath: 'test.scss',
          lineNumber: 1,
          scope: 'global',
          isDefault: false,
          isGlobal: true,
          dependencies: []
        },
        oldValue: '#007bff',
        newValue: '#dc3545',
        impact: 'high'
      }];

      const result = await formatter.format(mockDiffResult);
      
      expect(result.content).toContain('⚠️  High Impact Changes');
    });

    it('should include recommendations when available', async () => {
      mockDiffResult.variableImpact.recommendations = [
        'Consider testing component behavior',
        'Review accessibility implications'
      ];

      const result = await formatter.format(mockDiffResult);
      
      expect(result.content).toContain('💡 Recommendations');
      expect(result.content).toContain('Consider testing component behavior');
    });
  });
});
```

## Integration Points

1. **Typography System Integration**: Use existing syntax highlighting patterns
2. **CLI Integration**: Will be integrated into CLI commands for different output formats
3. **Error Handling**: Use existing error handling patterns from `src/errors.ts`

## Success Criteria

- [ ] Unified diff format provides detailed line-by-line comparison
- [ ] Split view format displays side-by-side comparison with proper alignment
- [ ] Summary format provides high-level overview with statistics and recommendations
- [ ] All formatters support CSS property details and variable resolution
- [ ] Color output works correctly in terminal environments
- [ ] Syntax highlighting enhances readability
- [ ] Metadata includes comprehensive statistics
- [ ] All tests pass with >90% coverage
- [ ] Performance remains acceptable for large diffs

## Next Steps

After completing this task:
- **Task 6**: Diff Rendering (Terminal, JSON, HTML)
- **Task 7**: Style Diff Engine Orchestrator
- **Task 8**: CLI Integration and Command Interface

This task provides comprehensive diff formatting capabilities that transform analyzed diff data into human-readable formats, supporting multiple viewing preferences and output requirements.
