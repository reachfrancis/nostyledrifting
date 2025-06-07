/**
 * Main diff renderer that orchestrates format-specific renderers
 * Provides a unified interface for rendering diffs in multiple formats
 */

import { StyleDiffResult, DiffRenderOptions, RenderedDiff } from './types';
import { TerminalRenderer, TerminalRenderOptions } from './renderers/terminal-renderer';
import { JsonRenderer, JsonRenderOptions } from './renderers/json-renderer';
import { HtmlRenderer, HtmlRenderOptions } from './renderers/html-renderer';
import { BaseDiffRenderer } from './renderers/base-renderer';

export type RenderFormat = 'terminal' | 'json' | 'html';

export interface DiffRendererOptions extends DiffRenderOptions {
  format?: RenderFormat;
  terminalOptions?: TerminalRenderOptions;
  jsonOptions?: JsonRenderOptions;
  htmlOptions?: HtmlRenderOptions;
}

export class DiffRenderer {
  private renderers: Map<RenderFormat, BaseDiffRenderer>;
  private defaultFormat: RenderFormat;

  constructor(options: DiffRendererOptions = {}) {
    this.defaultFormat = options.format || 'terminal';
    this.renderers = new Map();

    // Initialize renderers
    this.initializeRenderers(options);
  }

  /**
   * Render a single diff result in the specified format
   */
  async render(
    diffResult: StyleDiffResult, 
    format?: RenderFormat
  ): Promise<RenderedDiff> {
    const targetFormat = format || this.defaultFormat;
    const renderer = this.getRenderer(targetFormat);
    
    return renderer.render(diffResult);
  }

  /**
   * Render multiple diff results in the specified format
   */
  async renderMultiple(
    diffResults: StyleDiffResult[], 
    format?: RenderFormat
  ): Promise<RenderedDiff> {
    const targetFormat = format || this.defaultFormat;
    const renderer = this.getRenderer(targetFormat);
    
    return renderer.renderMultiple(diffResults);
  }

  /**
   * Render the same diff result in multiple formats
   */
  async renderAllFormats(diffResult: StyleDiffResult): Promise<Map<RenderFormat, RenderedDiff>> {
    const results = new Map<RenderFormat, RenderedDiff>();
    
    for (const [format, renderer] of this.renderers) {
      try {
        const result = await renderer.render(diffResult);
        results.set(format, result);
      } catch (error) {
        // Continue with other formats if one fails
        console.warn(`Failed to render in ${format} format:`, error);
      }
    }
    
    return results;
  }

  /**
   * Stream render for large diff results (terminal format only)
   */
  async *streamRender(
    diffResults: StyleDiffResult[], 
    format?: RenderFormat
  ): AsyncGenerator<RenderedDiff> {
    const targetFormat = format || this.defaultFormat;
    
    if (targetFormat !== 'terminal') {
      // For non-terminal formats, just yield the complete result
      yield await this.renderMultiple(diffResults, targetFormat);
      return;
    }

    const renderer = this.getRenderer(targetFormat);
    
    // Render each result individually for streaming
    for (const diffResult of diffResults) {
      yield await renderer.render(diffResult);
    }
  }

  /**
   * Get available render formats
   */
  getAvailableFormats(): RenderFormat[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Check if a format is supported
   */
  isFormatSupported(format: RenderFormat): boolean {
    return this.renderers.has(format);
  }

  /**
   * Get renderer for a specific format
   */
  getRenderer(format: RenderFormat): BaseDiffRenderer {
    const renderer = this.renderers.get(format);
    if (!renderer) {
      throw new Error(`Unsupported render format: ${format}`);
    }
    return renderer;
  }

  /**
   * Add or replace a renderer for a specific format
   */
  setRenderer(format: RenderFormat, renderer: BaseDiffRenderer): void {
    this.renderers.set(format, renderer);
  }

  /**
   * Remove a renderer for a specific format
   */
  removeRenderer(format: RenderFormat): boolean {
    return this.renderers.delete(format);
  }

  /**
   * Set the default render format
   */
  setDefaultFormat(format: RenderFormat): void {
    if (!this.isFormatSupported(format)) {
      throw new Error(`Cannot set unsupported format as default: ${format}`);
    }
    this.defaultFormat = format;
  }

  /**
   * Get the current default format
   */
  getDefaultFormat(): RenderFormat {
    return this.defaultFormat;
  }

  /**
   * Render and save to file (for JSON and HTML formats)
   */
  async renderToFile(
    diffResult: StyleDiffResult,
    filePath: string,
    format?: RenderFormat
  ): Promise<void> {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const targetFormat = format || this.inferFormatFromPath(filePath);
    const rendered = await this.render(diffResult, targetFormat);
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(filePath));
    
    // Write the file
    await fs.writeFile(filePath, rendered.content, 'utf8');
  }

  /**
   * Batch render multiple diff results to separate files
   */
  async renderBatchToFiles(
    diffResults: StyleDiffResult[],
    outputDir: string,
    format?: RenderFormat,
    fileNameTemplate?: string
  ): Promise<string[]> {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const targetFormat = format || this.defaultFormat;
    const template = fileNameTemplate || 'diff-{index}';
    const extension = this.getFileExtension(targetFormat);
    
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    const filePaths: string[] = [];
    
    for (let i = 0; i < diffResults.length; i++) {
      const fileName = template.replace('{index}', (i + 1).toString());
      const filePath = path.join(outputDir, `${fileName}.${extension}`);
      
      await this.renderToFile(diffResults[i], filePath, targetFormat);
      filePaths.push(filePath);
    }
    
    return filePaths;
  }

  /**
   * Create a performance report for rendering operations
   */
  async createPerformanceReport(
    diffResult: StyleDiffResult
  ): Promise<Record<RenderFormat, any>> {
    const report: Record<string, any> = {};
    
    for (const [format, renderer] of this.renderers) {
      const startTime = process.hrtime.bigint();
      
      try {
        const result = await renderer.render(diffResult);
        const endTime = process.hrtime.bigint();
        
        const durationMs = Number(endTime - startTime) / 1000000;
        
        report[format] = {
          success: true,
          duration: durationMs,
          outputSize: result.content.length,
          performance: this.categorizePerformance(durationMs, result.content.length)
        };
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1000000;
        
        report[format] = {
          success: false,
          duration: durationMs,
          error: error instanceof Error ? error.message : 'Unknown error',
          performance: 'failed'
        };
      }
    }
    
    return report;
  }

  private initializeRenderers(options: DiffRendererOptions): void {
    // Terminal renderer
    this.renderers.set('terminal', new TerminalRenderer(options.terminalOptions));
    
    // JSON renderer
    this.renderers.set('json', new JsonRenderer(options.jsonOptions));
    
    // HTML renderer
    this.renderers.set('html', new HtmlRenderer(options.htmlOptions));
  }

  private inferFormatFromPath(filePath: string): RenderFormat {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'json':
        return 'json';
      case 'html':
      case 'htm':
        return 'html';
      case 'txt':
      case 'diff':
      default:
        return 'terminal';
    }
  }

  private getFileExtension(format: RenderFormat): string {
    switch (format) {
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'terminal':
      default:
        return 'txt';
    }
  }

  private categorizePerformance(durationMs: number, outputSize: number): string {
    // Simple performance categorization
    const sizeKB = outputSize / 1024;
    
    if (durationMs < 100 && sizeKB < 100) return 'excellent';
    if (durationMs < 500 && sizeKB < 500) return 'good';
    if (durationMs < 1000 && sizeKB < 1000) return 'acceptable';
    return 'poor';
  }
}

/**
 * Factory function to create a renderer with common presets
 */
export function createDiffRenderer(preset?: 'terminal' | 'json' | 'html' | 'all'): DiffRenderer {
  switch (preset) {
    case 'terminal':
      return new DiffRenderer({
        format: 'terminal',
        terminalOptions: {
          useColors: true,
          highlightSyntax: true,
          includeLineNumbers: true
        }
      });
      
    case 'json':
      return new DiffRenderer({
        format: 'json',
        jsonOptions: {
          pretty: true,
          includeContent: true,
          includeContext: true
        }
      });
      
    case 'html':
      return new DiffRenderer({
        format: 'html',
        htmlOptions: {
          includeCSS: true,
          responsive: true,
          standalone: true
        }
      });
      
    case 'all':
    default:
      return new DiffRenderer({
        format: 'terminal',
        terminalOptions: { useColors: true, highlightSyntax: true },
        jsonOptions: { pretty: true, includeContent: true },
        htmlOptions: { includeCSS: true, responsive: true, standalone: true }
      });
  }
}

/**
 * Quick render function for simple use cases
 */
export async function quickRender(
  diffResult: StyleDiffResult,
  format: RenderFormat = 'terminal'
): Promise<string> {
  const renderer = createDiffRenderer(format);
  const result = await renderer.render(diffResult, format);
  return result.content;
}
