/**
 * HTML renderer for web-friendly diff output
 * Provides styled HTML with responsive design and accessibility
 */

import { StyleDiffResult, DiffRenderOptions, RenderedDiff } from '../types';
import { BaseDiffRenderer } from './base-renderer';

export interface HtmlRenderOptions extends DiffRenderOptions {
  includeCSS?: boolean;
  responsive?: boolean;
  darkMode?: boolean;
  standalone?: boolean;
  title?: string;
  customCSS?: string;
}

export class HtmlRenderer extends BaseDiffRenderer {
  private options: HtmlRenderOptions;

  constructor(options: HtmlRenderOptions = {}) {
    super(options);
    this.options = {
      includeCSS: true,
      responsive: true,
      darkMode: false,
      standalone: true,
      title: 'Style Diff Analysis',
      ...options
    };
  }

  async render(diffResult: StyleDiffResult): Promise<RenderedDiff> {
    this.validateOptions();

    const htmlContent = this.buildHtmlDocument(diffResult);

    return {
      format: 'html',
      content: htmlContent,
      metadata: {
        ...this.generateMetadata(diffResult),
        title: this.options.title,
        responsive: this.options.responsive,
        standalone: this.options.standalone
      }
    };
  }

  protected combineRenderedResults(parts: RenderedDiff[]): RenderedDiff {
    const combinedBody = parts.map(part => {
      // Extract body content from each part
      const bodyMatch = part.content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      return bodyMatch ? bodyMatch[1] : part.content;
    }).join('\n<hr class="result-separator">\n');

    const fullDocument = this.buildDocumentWrapper(combinedBody, 'Combined Style Diff Results');

    return {
      format: 'html',
      content: fullDocument,
      metadata: {
        resultCount: parts.length,
        combined: true
      }
    };
  }

  private buildHtmlDocument(diffResult: StyleDiffResult): string {
    const body = this.buildBodyContent(diffResult);
    
    if (this.options.standalone) {
      return this.buildDocumentWrapper(body, this.options.title);
    }
    
    return body;
  }

  private buildDocumentWrapper(bodyContent: string, title?: string): string {
    const css = this.options.includeCSS ? this.getEmbeddedCSS() : '';
    const customCSS = this.options.customCSS || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title || this.options.title || 'Style Diff')}</title>
  ${css}
  ${customCSS ? `<style>${customCSS}</style>` : ''}
</head>
<body${this.options.darkMode ? ' class="dark-mode"' : ''}>
  ${bodyContent}
</body>
</html>`;
  }

  private buildBodyContent(diffResult: StyleDiffResult): string {
    const sections: string[] = [];

    // Header
    sections.push(this.renderHeader(diffResult));

    // Summary
    sections.push(this.renderSummary(diffResult));

    // Statistics (if enabled)
    if (this.options.includeStatistics) {
      sections.push(this.renderStatistics(diffResult));
    }

    // File diffs
    sections.push(this.renderFileDiffs(diffResult));

    // Metadata (if enabled)
    if (this.options.includeMetadata) {
      sections.push(this.renderMetadataSection(diffResult));
    }

    return `<div class="diff-container">
  ${sections.join('\n\n')}
</div>`;
  }

  private renderHeader(diffResult: StyleDiffResult): string {
    return `<header class="diff-header">
  <h1>Style Diff Analysis</h1>
  <div class="comparison-info">
    <span class="branch branch-old">${this.escapeHtml(diffResult.branch1)}</span>
    <span class="arrow">→</span>
    <span class="branch branch-new">${this.escapeHtml(diffResult.branch2)}</span>
  </div>
  <div class="timestamp">${new Date().toLocaleString()}</div>
</header>`;
  }

  private renderSummary(diffResult: StyleDiffResult): string {
    const summary = diffResult.summary;
    
    return `<section class="summary-section">
  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <span class="label">Files Changed</span>
      <span class="value">${summary.filesChanged}</span>
    </div>
    <div class="summary-item">
      <span class="label">Total Changes</span>
      <span class="value">${summary.totalChanges}</span>
    </div>
    <div class="summary-item added">
      <span class="label">Added Lines</span>
      <span class="value">+${summary.addedLines}</span>
    </div>
    <div class="summary-item removed">
      <span class="label">Removed Lines</span>
      <span class="value">-${summary.removedLines}</span>
    </div>
    <div class="summary-item modified">
      <span class="label">Modified Lines</span>
      <span class="value">~${summary.modifiedLines}</span>
    </div>
  </div>
</section>`;
  }

  private renderStatistics(diffResult: StyleDiffResult): string {
    const stats = this.generateStatistics(diffResult);
    
    return `<section class="statistics-section">
  <h2>Statistics</h2>
  <div class="stats-container">
    <div class="stats-group">
      <h3>Impact Analysis</h3>
      <div class="impact-chart">
        <div class="impact-item high">
          <span class="label">High Impact</span>
          <span class="value">${stats.impactAnalysis.high}</span>
        </div>
        <div class="impact-item medium">
          <span class="label">Medium Impact</span>
          <span class="value">${stats.impactAnalysis.medium}</span>
        </div>
        <div class="impact-item low">
          <span class="label">Low Impact</span>
          <span class="value">${stats.impactAnalysis.low}</span>
        </div>
      </div>
    </div>
    
    <div class="stats-group">
      <h3>Property Types</h3>
      <div class="property-types">
        ${this.renderPropertyTypes(stats.propertyTypes)}
      </div>
    </div>
  </div>
</section>`;
  }

  private renderPropertyTypes(propertyTypes: Record<string, number>): string {
    const items = Object.entries(propertyTypes)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => 
        `<div class="property-type-item">
          <span class="type">${this.escapeHtml(type)}</span>
          <span class="count">${count}</span>
        </div>`
      );

    return items.join('\n');
  }

  private renderFileDiffs(diffResult: StyleDiffResult): string {
    const fileDiffs = diffResult.fileDiffs.filter(f => f.chunks && f.chunks.length > 0);
    
    if (fileDiffs.length === 0) {
      return `<section class="file-diffs-section">
  <h2>File Changes</h2>
  <p class="no-changes">No changes detected.</p>
</section>`;
    }

    const fileHtml = fileDiffs.map(fileDiff => this.renderFileDiff(fileDiff)).join('\n');

    return `<section class="file-diffs-section">
  <h2>File Changes</h2>
  <div class="file-diffs">
    ${fileHtml}
  </div>
</section>`;
  }

  private renderFileDiff(fileDiff: any): string {
    const fileName = this.formatFilePath(fileDiff.filePath);
    const chunksHtml = fileDiff.chunks.map((chunk: any) => this.renderChunk(chunk)).join('\n');

    return `<div class="file-diff">
  <div class="file-header">
    <h3 class="file-name">${this.escapeHtml(fileName)}</h3>
    <span class="file-type">${this.escapeHtml(fileDiff.fileType || 'scss')}</span>
  </div>
  ${fileDiff.metadata ? this.renderFileMetadata(fileDiff.metadata) : ''}
  <div class="chunks">
    ${chunksHtml}
  </div>
</div>`;
  }

  private renderFileMetadata(metadata: any): string {
    if (!metadata.variableChanges || metadata.variableChanges.length === 0) {
      return '';
    }

    const variables = metadata.variableChanges.map((change: any) => 
      `<div class="variable-change">
        <span class="variable-name">${this.escapeHtml(change.variable)}</span>
        <span class="old-value">${this.escapeHtml(change.oldValue)}</span>
        <span class="arrow">→</span>
        <span class="new-value">${this.escapeHtml(change.newValue)}</span>
      </div>`
    ).join('\n');

    return `<div class="file-metadata">
  <h4>Variable Changes</h4>
  <div class="variable-changes">
    ${variables}
  </div>
</div>`;
  }

  private renderChunk(chunk: any): string {
    const header = `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`;
    const changesHtml = chunk.changes.map((change: any) => this.renderChange(change)).join('\n');

    return `<div class="chunk">
  <div class="chunk-header">${this.escapeHtml(header)}</div>
  <div class="changes">
    ${changesHtml}
  </div>
</div>`;
  }

  private renderChange(change: any): string {
    const symbol = this.getChangeSymbol(change.type);
    const lineNumber = this.options.includeLineNumbers 
      ? `<span class="line-number">${change.lineNumber || ''}</span>`
      : '';

    const content = this.escapeHtml(this.truncateContent(change.content));
    const propertyChanges = change.cssPropertyChanges 
      ? this.renderPropertyChanges(change.cssPropertyChanges)
      : '';

    return `<div class="change change-${change.type}">
  ${lineNumber}
  <span class="change-symbol">${symbol}</span>
  <span class="change-content">${content}</span>
  ${propertyChanges}
</div>`;
  }

  private renderPropertyChanges(changes: any[]): string {
    if (!changes.length) return '';

    const items = changes.map(change => 
      `<div class="property-change impact-${change.impact}">
        <span class="property">${this.escapeHtml(change.property)}</span>
        <span class="category">${this.escapeHtml(change.category)}</span>
        <span class="impact">${this.escapeHtml(change.impact)}</span>
      </div>`
    ).join('\n');

    return `<div class="property-changes">
  ${items}
</div>`;
  }

  private renderMetadataSection(diffResult: StyleDiffResult): string {
    const metadata = this.generateMetadata(diffResult);

    return `<section class="metadata-section">
  <h2>Metadata</h2>
  <div class="metadata-content">
    <pre><code>${this.escapeHtml(JSON.stringify(metadata, null, 2))}</code></pre>
  </div>
</section>`;
  }

  private getEmbeddedCSS(): string {
    return `<style>
/* Style Diff CSS */
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 20px;
  background-color: #ffffff;
  color: #333333;
}

body.dark-mode {
  background-color: #1a1a1a;
  color: #e0e0e0;
}

.diff-container {
  max-width: 1200px;
  margin: 0 auto;
}

.diff-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;
}

.dark-mode .diff-header {
  border-bottom-color: #404040;
}

.diff-header h1 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.dark-mode .diff-header h1 {
  color: #ecf0f1;
}

.comparison-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.branch {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: bold;
}

.branch-old {
  background-color: #ffebee;
  color: #c62828;
}

.branch-new {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.dark-mode .branch-old {
  background-color: #442c2e;
  color: #ff8a80;
}

.dark-mode .branch-new {
  background-color: #2e3c2e;
  color: #81c784;
}

.arrow {
  font-size: 1.2rem;
  color: #666;
}

.timestamp {
  color: #666;
  font-size: 0.9rem;
}

.summary-section, .statistics-section, .file-diffs-section, .metadata-section {
  margin-bottom: 2rem;
}

.summary-section h2, .statistics-section h2, .file-diffs-section h2, .metadata-section h2 {
  color: #2c3e50;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.dark-mode .summary-section h2, .dark-mode .statistics-section h2, 
.dark-mode .file-diffs-section h2, .dark-mode .metadata-section h2 {
  color: #ecf0f1;
  border-bottom-color: #404040;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.summary-item {
  text-align: center;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.dark-mode .summary-item {
  border-color: #404040;
  background-color: #2a2a2a;
}

.summary-item.added {
  border-left: 4px solid #4caf50;
}

.summary-item.removed {
  border-left: 4px solid #f44336;
}

.summary-item.modified {
  border-left: 4px solid #ff9800;
}

.summary-item .label {
  display: block;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.summary-item .value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 1rem;
}

.stats-group h3 {
  margin-top: 0;
  color: #34495e;
}

.dark-mode .stats-group h3 {
  color: #bdc3c7;
}

.impact-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.impact-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  border-radius: 4px;
}

.impact-item.high {
  background-color: #ffebee;
  color: #c62828;
}

.impact-item.medium {
  background-color: #fff3e0;
  color: #ef6c00;
}

.impact-item.low {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.dark-mode .impact-item.high {
  background-color: #442c2e;
  color: #ff8a80;
}

.dark-mode .impact-item.medium {
  background-color: #3d2f2a;
  color: #ffab40;
}

.dark-mode .impact-item.low {
  background-color: #2e3c2e;
  color: #81c784;
}

.property-types {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.property-type-item {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: #f5f5f5;
}

.dark-mode .property-type-item {
  background-color: #333333;
}

.file-diff {
  margin-bottom: 2rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.dark-mode .file-diff {
  border-color: #404040;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.dark-mode .file-header {
  background-color: #2a2a2a;
  border-bottom-color: #404040;
}

.file-name {
  margin: 0;
  font-size: 1.1rem;
  font-family: monospace;
}

.file-type {
  background-color: #e0e0e0;
  color: #666;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.dark-mode .file-type {
  background-color: #404040;
  color: #ccc;
}

.chunk {
  border-bottom: 1px solid #e0e0e0;
}

.dark-mode .chunk {
  border-bottom-color: #404040;
}

.chunk:last-child {
  border-bottom: none;
}

.chunk-header {
  background-color: #f0f0f0;
  padding: 0.5rem 1rem;
  font-family: monospace;
  font-size: 0.9rem;
  color: #666;
}

.dark-mode .chunk-header {
  background-color: #333333;
  color: #ccc;
}

.changes {
  font-family: monospace;
  font-size: 0.9rem;
}

.change {
  display: flex;
  align-items: flex-start;
  padding: 0.25rem 1rem;
  min-height: 1.5rem;
}

.change-add {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.change-remove {
  background-color: #ffebee;
  color: #c62828;
}

.change-modify {
  background-color: #fff3e0;
  color: #ef6c00;
}

.dark-mode .change-add {
  background-color: #1b2e1b;
  color: #81c784;
}

.dark-mode .change-remove {
  background-color: #2e1b1b;
  color: #ff8a80;
}

.dark-mode .change-modify {
  background-color: #2e251b;
  color: #ffab40;
}

.line-number {
  display: inline-block;
  width: 4rem;
  text-align: right;
  margin-right: 1rem;
  color: #999;
  user-select: none;
}

.change-symbol {
  display: inline-block;
  width: 1rem;
  margin-right: 0.5rem;
  font-weight: bold;
}

.change-content {
  flex: 1;
}

.property-changes {
  margin-left: 6rem;
  margin-top: 0.25rem;
}

.property-change {
  font-size: 0.8rem;
  color: #666;
  display: flex;
  gap: 0.5rem;
}

.dark-mode .property-change {
  color: #ccc;
}

.property-change .property {
  font-weight: bold;
}

.property-change .impact {
  text-transform: uppercase;
  font-size: 0.7rem;
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
}

.property-change.impact-high .impact {
  background-color: #c62828;
  color: white;
}

.property-change.impact-medium .impact {
  background-color: #ef6c00;
  color: white;
}

.property-change.impact-low .impact {
  background-color: #2e7d32;
  color: white;
}

.no-changes {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 2rem;
}

.metadata-content {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.dark-mode .metadata-content {
  background-color: #2a2a2a;
}

.metadata-content code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.result-separator {
  margin: 3rem 0;
  border: none;
  border-top: 2px solid #e0e0e0;
}

.dark-mode .result-separator {
  border-top-color: #404040;
}

/* Responsive Design */
@media (max-width: 768px) {
  body {
    padding: 10px;
  }
  
  .comparison-info {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-container {
    grid-template-columns: 1fr;
  }
  
  .file-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .change {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .property-changes {
    margin-left: 1rem;
  }
}

/* Print Styles */
@media print {
  body {
    background-color: white !important;
    color: black !important;
  }
  
  .diff-container {
    max-width: none;
  }
  
  .change-add {
    background-color: #f0f0f0 !important;
  }
  
  .change-remove {
    background-color: #f0f0f0 !important;
  }
  
  .change-modify {
    background-color: #f0f0f0 !important;
  }
}
</style>`;
  }
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
