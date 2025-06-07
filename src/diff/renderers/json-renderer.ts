/**
 * JSON renderer for structured diff output
 * Provides machine-readable format for API consumption
 */

import { StyleDiffResult, DiffRenderOptions, RenderedDiff } from '../types';
import { BaseDiffRenderer } from './base-renderer';

export interface JsonRenderOptions extends DiffRenderOptions {
  pretty?: boolean;
  includeContent?: boolean;
  includeContext?: boolean;
  schemaVersion?: string;
  compression?: 'none' | 'minimal' | 'aggressive';
}

export interface JsonDiffSchema {
  schemaVersion: string;
  timestamp: string;
  comparison: {
    branch1: string;
    branch2: string;
  };
  summary: {
    filesChanged: number;
    totalChanges: number;
    addedLines: number;
    removedLines: number;
    modifiedLines: number;
  };
  statistics: Record<string, any>;
  fileDiffs: any[];
  metadata: Record<string, any>;
}

export class JsonRenderer extends BaseDiffRenderer {
  protected options: JsonRenderOptions;

  constructor(options: JsonRenderOptions = {}) {
    super(options);
    this.options = {
      pretty: true,
      includeContent: true,
      includeContext: true,
      schemaVersion: '1.0.0',
      compression: 'none',
      ...options
    };
  }

  async render(diffResult: StyleDiffResult): Promise<RenderedDiff> {
    this.validateOptions();

    const jsonSchema = this.buildJsonSchema(diffResult);
    const compressedSchema = this.applyCompression(jsonSchema);
    
    const content = this.options.pretty
      ? JSON.stringify(compressedSchema, null, 2)
      : JSON.stringify(compressedSchema);

    return {
      format: 'json',
      content,
      metadata: {
        schemaVersion: this.options.schemaVersion,
        compression: this.options.compression,
        size: content.length
      }
    };
  }

  protected combineRenderedResults(parts: RenderedDiff[]): RenderedDiff {
    const combinedData = {
      schemaVersion: this.options.schemaVersion,
      timestamp: new Date().toISOString(),
      results: parts.map(part => JSON.parse(part.content))
    };

    const content = this.options.pretty
      ? JSON.stringify(combinedData, null, 2)
      : JSON.stringify(combinedData);

    return {
      format: 'json',
      content,
      metadata: {
        resultCount: parts.length,
        totalSize: content.length
      }
    };
  }

  private buildJsonSchema(diffResult: StyleDiffResult): JsonDiffSchema {
    return {
      schemaVersion: this.options.schemaVersion!,
      timestamp: new Date().toISOString(),
      comparison: {
        branch1: diffResult.branch1,
        branch2: diffResult.branch2
      },
      summary: {
        filesChanged: diffResult.summary.filesChanged,
        totalChanges: diffResult.summary.totalChanges,
        addedLines: diffResult.summary.addedLines,
        removedLines: diffResult.summary.removedLines,
        modifiedLines: diffResult.summary.modifiedLines
      },
      statistics: this.generateStatistics(diffResult),
      fileDiffs: this.processFileDiffs(diffResult.fileDiffs),
      metadata: this.generateMetadata(diffResult)
    };
  }

  private processFileDiffs(fileDiffs: any[]): any[] {
    return fileDiffs.map(fileDiff => {
      const processedDiff: any = {
        filePath: this.formatFilePath(fileDiff.filePath),
        fileType: fileDiff.fileType,
        hasChanges: fileDiff.chunks && fileDiff.chunks.length > 0,
        chunkCount: fileDiff.chunks ? fileDiff.chunks.length : 0
      };

      // Add metadata if available
      if (fileDiff.metadata && this.options.includeMetadata) {
        processedDiff.metadata = this.processFileMetadata(fileDiff.metadata);
      }

      // Add chunks if content is requested
      if (this.options.includeContent && fileDiff.chunks) {
        processedDiff.chunks = this.processChunks(fileDiff.chunks);
      }

      return processedDiff;
    });
  }

  private processFileMetadata(metadata: any): any {
    const processedMetadata: any = {};

    // Variable changes
    if (metadata.variableChanges) {
      processedMetadata.variableChanges = metadata.variableChanges.map((change: any) => ({
        variable: change.variable,
        oldValue: change.oldValue,
        newValue: change.newValue,
        impact: change.impact || 'unknown',
        dependencies: change.dependencies || []
      }));
    }

    // Import changes
    if (metadata.importChanges) {
      processedMetadata.importChanges = metadata.importChanges.map((change: any) => ({
        type: change.type,
        path: change.path,
        modules: change.modules || []
      }));
    }

    // Selector changes
    if (metadata.selectorChanges) {
      processedMetadata.selectorChanges = metadata.selectorChanges.map((change: any) => ({
        selector: change.selector,
        specificity: change.specificity,
        context: change.context || {}
      }));
    }

    return processedMetadata;
  }

  private processChunks(chunks: any[]): any[] {
    return chunks.map(chunk => {
      const processedChunk: any = {
        oldStart: chunk.oldStart,
        oldLines: chunk.oldLines,
        newStart: chunk.newStart,
        newLines: chunk.newLines,
        context: chunk.context || {}
      };

      // Add changes if content is requested
      if (this.options.includeContent && chunk.changes) {
        processedChunk.changes = this.processChanges(chunk.changes);
      } else {
        processedChunk.changeCount = chunk.changes ? chunk.changes.length : 0;
      }

      return processedChunk;
    });
  }

  private processChanges(changes: any[]): any[] {
    return changes.map(change => {
      const processedChange: any = {
        type: change.type,
        lineNumber: change.lineNumber
      };

      // Add content based on options
      if (this.options.includeContent) {
        processedChange.content = change.content;
      }

      // Add context if requested
      if (this.options.includeContext && change.context) {
        processedChange.context = {
          before: change.context.before || [],
          after: change.context.after || []
        };
      }

      // Add CSS property changes
      if (change.cssPropertyChanges) {
        processedChange.cssPropertyChanges = change.cssPropertyChanges.map((propChange: any) => ({
          property: propChange.property,
          oldValue: propChange.oldValue,
          newValue: propChange.newValue,
          category: propChange.category,
          impact: propChange.impact,
          relationships: propChange.relationships || []
        }));
      }

      return processedChange;
    });
  }

  private applyCompression(schema: JsonDiffSchema): any {
    switch (this.options.compression) {
      case 'minimal':
        return this.applyMinimalCompression(schema);
      case 'aggressive':
        return this.applyAggressiveCompression(schema);
      default:
        return schema;
    }
  }

  private applyMinimalCompression(schema: JsonDiffSchema): any {
    // Remove empty arrays and null values
    return this.removeEmptyValues(schema);
  }

  private applyAggressiveCompression(schema: JsonDiffSchema): any {
    const compressed = this.removeEmptyValues(schema);
    
    // Use shorter property names
    return {
      v: compressed.schemaVersion,
      ts: compressed.timestamp,
      cmp: compressed.comparison,
      sum: compressed.summary,
      stats: compressed.statistics,
      files: compressed.fileDiffs.map((file: any) => ({
        p: file.filePath,
        t: file.fileType,
        c: file.chunkCount,
        ch: file.chunks ? file.chunks.map((chunk: any) => ({
          os: chunk.oldStart,
          ol: chunk.oldLines,
          ns: chunk.newStart,
          nl: chunk.newLines,
          ch: chunk.changes ? chunk.changes.map((change: any) => ({
            t: change.type,
            l: change.lineNumber,
            c: change.content,
            p: change.cssPropertyChanges
          })) : undefined
        })) : undefined
      })),
      meta: compressed.metadata
    };
  }

  private removeEmptyValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.filter(item => item != null && item !== '').map(item => this.removeEmptyValues(item));
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
          cleaned[key] = this.removeEmptyValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Validate JSON schema against expected structure
   */
  validateSchema(schema: JsonDiffSchema): boolean {
    try {
      // Basic structure validation
      if (!schema.schemaVersion || !schema.timestamp || !schema.comparison) {
        return false;
      }

      if (!schema.summary || !schema.fileDiffs || !Array.isArray(schema.fileDiffs)) {
        return false;
      }

      // Validate comparison structure
      if (!schema.comparison.branch1 || !schema.comparison.branch2) {
        return false;
      }

      // Validate summary structure
      const requiredSummaryFields = ['filesChanged', 'totalChanges', 'addedLines', 'removedLines', 'modifiedLines'];
      for (const field of requiredSummaryFields) {
        if (typeof schema.summary[field as keyof typeof schema.summary] !== 'number') {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get JSON schema definition for the output format
   */
  getSchemaDefinition(): Record<string, any> {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['schemaVersion', 'timestamp', 'comparison', 'summary', 'fileDiffs'],
      properties: {
        schemaVersion: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        comparison: {
          type: 'object',
          required: ['branch1', 'branch2'],
          properties: {
            branch1: { type: 'string' },
            branch2: { type: 'string' }
          }
        },
        summary: {
          type: 'object',
          required: ['filesChanged', 'totalChanges', 'addedLines', 'removedLines', 'modifiedLines'],
          properties: {
            filesChanged: { type: 'number' },
            totalChanges: { type: 'number' },
            addedLines: { type: 'number' },
            removedLines: { type: 'number' },
            modifiedLines: { type: 'number' }
          }
        },
        statistics: { type: 'object' },
        fileDiffs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['filePath', 'fileType'],
            properties: {
              filePath: { type: 'string' },
              fileType: { type: 'string' },
              hasChanges: { type: 'boolean' },
              chunkCount: { type: 'number' },
              chunks: { type: 'array' },
              metadata: { type: 'object' }
            }
          }
        },
        metadata: { type: 'object' }
      }
    };
  }
}
