
import { TypographyEntry, ExtractionOptions, ExtractorConfiguration } from './types';
import { ASTNode, RootNode } from '../parser/ast-nodes';
import { TypographyExtractor } from './typography-extractor-fixed';

/**
 * Streaming Typography Extractor
 * Handles large files and provides memory-efficient extraction
 */
export class StreamingTypographyExtractor {
  private extractor: TypographyExtractor;
  private config: ExtractorConfiguration;

  constructor(config: ExtractorConfiguration) {
    this.config = config;
    this.extractor = new TypographyExtractor(config);
  }

  /**
   * Stream typography extraction from AST
   */  async *streamExtraction(
    ast: ASTNode,
    filePath: string,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<TypographyEntry, void, unknown> {
    const chunks = this.createASTChunks(ast, this.config.chunkSize);
    
    for (const chunk of chunks) {
      const chunkResult = await this.extractor.extractTypography(
        chunk,
        filePath,
        options
      );

      for (const entry of chunkResult.typography.entries) {
        yield entry;
      }

      // Allow other operations to run
      await this.yieldControl();
    }
  }

  /**
   * Stream extraction with progress reporting
   */
  async *streamWithProgress(
    ast: ASTNode,
    filePath: string,
    onProgress: (progress: number) => void,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<TypographyEntry, void, unknown> {
    const chunks = this.createASTChunks(ast, this.config.chunkSize);
    let processedChunks = 0;    for (const chunk of chunks) {
      const chunkResult = await this.extractor.extractTypography(
        chunk,
        filePath,
        options
      );

      for (const entry of chunkResult.typography.entries) {
        yield entry;
      }

      processedChunks++;
      onProgress(processedChunks / chunks.length);

      await this.yieldControl();
    }
  }

  /**
   * Stream extraction with memory monitoring
   */
  async *streamWithMemoryManagement(
    ast: ASTNode,
    filePath: string,
    maxMemoryMB: number = 100,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<TypographyEntry, void, unknown> {
    const chunks = this.createASTChunks(ast, this.config.chunkSize);
    
    for (const chunk of chunks) {
      // Check memory usage before processing
      if (this.getMemoryUsageMB() > maxMemoryMB) {      // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const chunkResult = await this.extractor.extractTypography(
        chunk,
        filePath,
        options
      );

      for (const entry of chunkResult.typography.entries) {
        yield entry;
      }

      await this.yieldControl();
    }
  }

  /**
   * Batch stream extraction for multiple files
   */
  async *streamBatchExtraction(
    files: Array<{ ast: ASTNode; filePath: string }>,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<{ filePath: string; entry: TypographyEntry }, void, unknown> {
    for (const { ast, filePath } of files) {
      for await (const entry of this.streamExtraction(ast, filePath, options)) {
        yield { filePath, entry };
      }
    }
  }

  /**
   * Stream extraction with timeout handling
   */
  async *streamWithTimeout(
    ast: ASTNode,
    filePath: string,
    timeoutMs: number,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<TypographyEntry, void, unknown> {
    const startTime = Date.now();
    const chunks = this.createASTChunks(ast, this.config.chunkSize);

    for (const chunk of chunks) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Typography extraction timeout after ${timeoutMs}ms`);
      }      const chunkResult = await this.extractor.extractTypography(
        chunk,
        filePath,
        options
      );

      for (const entry of chunkResult.typography.entries) {
        yield entry;
      }

      await this.yieldControl();
    }
  }

  /**
   * Collect all entries from stream
   */
  async collectFromStream(
    ast: ASTNode,
    filePath: string,
    options?: Partial<ExtractionOptions>
  ): Promise<TypographyEntry[]> {
    const entries: TypographyEntry[] = [];
    
    for await (const entry of this.streamExtraction(ast, filePath, options)) {
      entries.push(entry);
    }

    return entries;
  }

  /**
   * Stream extraction with filtering
   */
  async *streamWithFilter(
    ast: ASTNode,
    filePath: string,
    filter: (entry: TypographyEntry) => boolean,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<TypographyEntry, void, unknown> {
    for await (const entry of this.streamExtraction(ast, filePath, options)) {
      if (filter(entry)) {
        yield entry;
      }
    }
  }

  /**
   * Stream extraction with transformation
   */
  async *streamWithTransform<T>(
    ast: ASTNode,
    filePath: string,
    transform: (entry: TypographyEntry) => T,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<T, void, unknown> {
    for await (const entry of this.streamExtraction(ast, filePath, options)) {
      yield transform(entry);
    }
  }
  /**
   * Create chunks from AST for streaming processing
   */
  private createASTChunks(ast: ASTNode, chunkSize: number): ASTNode[] {
    if (!ast.children || ast.children.length <= chunkSize) {
      return [ast];
    }

    const chunks: ASTNode[] = [];
    for (let i = 0; i < ast.children.length; i += chunkSize) {
      const chunkChildren = ast.children.slice(i, i + chunkSize);
      
      // Create a new RootNode for the chunk
      const chunkRoot = new RootNode(ast.location);
      chunkRoot.parent = ast.parent;
      
      // Add the chunk children to the new root
      for (const child of chunkChildren) {
        chunkRoot.addChild(child);
      }
      
      chunks.push(chunkRoot);
    }

    return chunks;
  }

  /**
   * Yield control to event loop
   */
  private async yieldControl(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsageMB(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed / (1024 * 1024);
    }
    return 0;
  }
}

/**
 * Streaming utilities for typography extraction
 */
export class StreamingUtils {
  /**
   * Create a readable stream from typography entries
   */
  static createTypographyStream(
    entries: TypographyEntry[]
  ): ReadableStream<TypographyEntry> {
    let index = 0;

    return new ReadableStream({
      pull(controller) {
        if (index >= entries.length) {
          controller.close();
          return;
        }

        controller.enqueue(entries[index++]);
      }
    });
  }

  /**
   * Create a writable stream for collecting typography entries
   */
  static createCollectorStream(): WritableStream<TypographyEntry> {
    const entries: TypographyEntry[] = [];

    return new WritableStream({
      write(entry) {
        entries.push(entry);
      },
      close() {
        // Stream closed
      },
      abort(reason) {
        console.error('Typography stream aborted:', reason);
      }
    });
  }

  /**
   * Transform stream for typography entries
   */
  static createTransformStream<T>(
    transformer: (entry: TypographyEntry) => T
  ): TransformStream<TypographyEntry, T> {
    return new TransformStream({
      transform(entry, controller) {
        try {
          const transformed = transformer(entry);
          controller.enqueue(transformed);
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Filter stream for typography entries
   */
  static createFilterStream(
    predicate: (entry: TypographyEntry) => boolean
  ): TransformStream<TypographyEntry, TypographyEntry> {
    return new TransformStream({
      transform(entry, controller) {
        if (predicate(entry)) {
          controller.enqueue(entry);
        }
      }
    });
  }

  /**
   * Batch entries into groups
   */
  static createBatchStream(
    batchSize: number
  ): TransformStream<TypographyEntry, TypographyEntry[]> {
    let batch: TypographyEntry[] = [];

    return new TransformStream({
      transform(entry, controller) {
        batch.push(entry);
        
        if (batch.length >= batchSize) {
          controller.enqueue([...batch]);
          batch = [];
        }
      },
      flush(controller) {
        if (batch.length > 0) {
          controller.enqueue(batch);
        }
      }
    });
  }

  /**
   * Async iterator from ReadableStream
   */
  static async *fromStream<T>(
    stream: ReadableStream<T>
  ): AsyncGenerator<T, void, unknown> {
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Collect all values from async iterator
   */
  static async collectAll<T>(
    iterator: AsyncGenerator<T, void, unknown>
  ): Promise<T[]> {
    const results: T[] = [];
    
    for await (const item of iterator) {
      results.push(item);
    }

    return results;
  }
}
