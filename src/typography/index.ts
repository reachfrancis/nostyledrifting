
import { TypographyExtractor } from './typography-extractor-fixed';
import { TypographyAnalyzer } from './typography-analyzer';
import { StreamingTypographyExtractor } from './streaming-extractor';
import { PerformanceOptimizer, PerformanceReport } from './performance-optimizer';
import { TypographyErrorHandler, ValidationResult, ErrorStatistics } from './error-handler';
import { 
  TypographyAnalysisResult, 
  ExtractionOptions, 
  ExtractorConfiguration,
  TypographyEntry,
  FontFaceDeclaration,
  CustomPropertyDefinition,
  ExtractionError,
  TypographyCache
} from './types';
import { ASTNode } from '../parser/ast-nodes';

/**
 * Main Typography Extraction API
 * Provides a unified interface for extracting and analyzing typography from SCSS files
 */
export class TypographyAPI {
  private extractor: TypographyExtractor;
  private analyzer: TypographyAnalyzer;
  private cache: TypographyCache;

  constructor(config?: Partial<ExtractorConfiguration>) {
    const defaultConfig: ExtractorConfiguration = {
      maxCacheSize: 1000,
      timeoutMs: 30000,
      enableStreaming: true,
      chunkSize: 100,
      ...config
    };

    this.extractor = new TypographyExtractor(defaultConfig);
    this.analyzer = new TypographyAnalyzer();
    this.cache = this.createCache(defaultConfig.maxCacheSize);
  }

  /**
   * Extract typography from a single SCSS AST
   */
  async extractFromAST(
    ast: ASTNode,
    filePath: string,
    options?: Partial<ExtractionOptions>
  ): Promise<TypographyAnalysisResult> {
    const cacheKey = this.generateCacheKey(ast, filePath, options);
    
    if (this.cache.selectorCache.has(cacheKey)) {
      return this.buildResultFromCache(cacheKey);
    }    const extractionResult = await this.extractor.extractTypography(ast, filePath, options);

    // Cache the results
    this.cacheResults(cacheKey, extractionResult);

    return extractionResult;
  }

  /**
   * Extract typography from multiple SCSS ASTs (batch processing)
   */
  async extractFromMultipleASTs(
    asts: Array<{ ast: ASTNode; filePath: string }>,
    options?: Partial<ExtractionOptions>
  ): Promise<TypographyAnalysisResult> {
    const results = await Promise.all(
      asts.map(({ ast, filePath }) => 
        this.extractFromAST(ast, filePath, options)
      )
    );

    return this.mergeResults(results);
  }
  /**
   * Stream typography extraction for large files
   */  async *streamExtractFromAST(
    ast: ASTNode,
    filePath: string,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<TypographyEntry, void, unknown> {
    // Provide default values for required options
    const fullOptions: ExtractionOptions = {
      resolveVariables: true,
      evaluateFunctions: true,
      computeValues: true,
      parallel: true,
      cacheResults: true,
      includeContext: true,
      includeMetadata: true,
      ...options
    };
    
    // Use streaming extractor for memory-efficient processing
    const streamingExtractor = new StreamingTypographyExtractor({
      maxCacheSize: 1000,
      timeoutMs: 30000,
      enableStreaming: true,
      chunkSize: 100
    });
    
    yield* streamingExtractor.streamExtraction(ast, filePath, fullOptions);
  }

  /**
   * Extract only specific typography properties
   */
  async extractProperties(
    ast: ASTNode,
    filePath: string,
    properties: string[],
    options?: Partial<ExtractionOptions>
  ): Promise<TypographyEntry[]> {
    const filterOptions = {
      ...options,
      propertyFilter: properties
    };

    const result = await this.extractFromAST(ast, filePath, filterOptions);
    return result.typography.entries;
  }

  /**
   * Get font face declarations only
   */
  async extractFontFaces(
    ast: ASTNode,
    filePath: string
  ): Promise<FontFaceDeclaration[]> {
    const result = await this.extractFromAST(ast, filePath, {
      resolveVariables: true,
      evaluateFunctions: false,
      computeValues: false,
      includeContext: false,
      includeMetadata: false
    });

    return result.typography.fontFaces;
  }

  /**
   * Get custom properties only
   */
  async extractCustomProperties(
    ast: ASTNode,
    filePath: string
  ): Promise<CustomPropertyDefinition[]> {
    const result = await this.extractFromAST(ast, filePath, {
      resolveVariables: true,
      evaluateFunctions: false,
      computeValues: false,
      includeContext: false,
      includeMetadata: false
    });

    return result.typography.customProperties;
  }
  /**
   * Analyze typography consistency across multiple files
   */
  async analyzeConsistency(
    results: TypographyAnalysisResult[]
  ): Promise<TypographyAnalysisResult> {
    const merged = this.mergeResults(results);
    return this.analyzer.analyzeTypography(merged.typography.entries);
  }
  /**
   * Get typography recommendations
   */
  async getRecommendations(
    result: TypographyAnalysisResult
  ): Promise<string[]> {
    // For now, return basic recommendations based on the analysis
    const recommendations: string[] = [];
    
    if (result.accessibility.recommendations) {
      recommendations.push(...result.accessibility.recommendations.map(r => r.message));
    }
    
    if (result.consistency.issues) {
      recommendations.push(...result.consistency.issues.map(i => i.message));
    }
    
    return recommendations;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.invalidate('manual');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.selectorCache.size,
      hitRate: 0.85 // Placeholder - implement actual hit rate tracking
    };
  }

  /**
   * Validate typography entries
   */
  validateEntries(entries: TypographyEntry[]): ExtractionError[] {
    const errors: ExtractionError[] = [];

    for (const entry of entries) {
      try {
        this.validateTypographyEntry(entry);
      } catch (error) {
        if (error instanceof Error) {
          errors.push({
            type: 'INVALID_PROPERTY_VALUE' as any,
            message: error.message,
            location: entry.context.location,
            property: entry.property,
            value: entry.value.original
          });
        }
      }
    }

    return errors;
  }  private createCache(maxSize: number): TypographyCache {
    const variableCache = new Map();
    const functionCache = new Map();
    const selectorCache = new Map<string, TypographyAnalysisResult>();
    
    return {
      variableCache,
      functionCache,
      selectorCache,
      invalidate: (reason) => {
        variableCache.clear();
        functionCache.clear();
        selectorCache.clear();
      }
    };
  }

  private generateCacheKey(
    ast: ASTNode,
    filePath: string,
    options?: Partial<ExtractionOptions>
  ): string {
    const optionsHash = JSON.stringify(options || {});
    const astHash = this.hashAST(ast);
    return `${filePath}:${astHash}:${optionsHash}`;
  }
  private hashAST(ast: ASTNode): string {
    // Create a hash without circular references
    const visited = new WeakSet();
    
    function serializeForHash(obj: any): any {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (visited.has(obj)) {
        return '[Circular]';
      }
      
      visited.add(obj);
      
      if (Array.isArray(obj)) {
        return obj.map(serializeForHash);
      }
      
      const result: any = {};
      for (const key in obj) {
        if (key === 'parent') continue; // Skip parent references to avoid circularity
        if (obj.hasOwnProperty(key)) {
          result[key] = serializeForHash(obj[key]);
        }
      }
      
      visited.delete(obj);
      return result;
    }
    
    const serializable = serializeForHash(ast);
    return JSON.stringify(serializable).substring(0, 50);
  }
  private buildResultFromCache(cacheKey: string): TypographyAnalysisResult {
    const cachedResult = this.cache.selectorCache.get(cacheKey);
    if (!cachedResult) {
      throw new Error('Cache key not found');
    }
    return cachedResult;
  }
  private cacheResults(cacheKey: string, result: TypographyAnalysisResult): void {
    this.cache.selectorCache.set(cacheKey, result);
  }

  private mergeResults(results: TypographyAnalysisResult[]): TypographyAnalysisResult {
    const merged: TypographyAnalysisResult = {
      summary: {
        totalProperties: 0,
        uniqueFonts: 0,
        responsiveProperties: 0,
        customProperties: 0,
        fontFaceDeclarations: 0
      },
      typography: {
        entries: [],
        fontFaces: [],
        customProperties: []
      },
      byProperty: new Map(),
      bySelector: new Map(),
      byBreakpoint: new Map(),
      fontStacks: [],
      consistency: {
        fontFamilyConsistency: 1,
        fontSizeScale: 1,
        lineHeightConsistency: 1,
        issues: []
      },
      accessibility: {
        readability: {
          minimumFontSize: '16px',
          lineHeightRatio: 1.5,
          contrastRequirements: []
        },
        fontAccessibility: {
          systemFontUsage: true,
          webFontFallbacks: true,
          dyslexiaFriendlyFonts: []
        },
        responsiveAccessibility: {
          scalableUnits: true,
          fluidTypography: true,
          zoomSupport: true
        },
        recommendations: []
      }
    };

    // Merge all results
    for (const result of results) {
      merged.typography.entries.push(...result.typography.entries);
      merged.typography.fontFaces.push(...result.typography.fontFaces);
      merged.typography.customProperties.push(...result.typography.customProperties);
      merged.fontStacks.push(...result.fontStacks);

      // Merge summary
      merged.summary.totalProperties += result.summary.totalProperties;
      merged.summary.uniqueFonts += result.summary.uniqueFonts;
      merged.summary.responsiveProperties += result.summary.responsiveProperties;
      merged.summary.customProperties += result.summary.customProperties;
      merged.summary.fontFaceDeclarations += result.summary.fontFaceDeclarations;
    }

    // Rebuild maps
    this.rebuildMaps(merged);

    return merged;
  }

  private rebuildMaps(result: TypographyAnalysisResult): void {
    result.byProperty.clear();
    result.bySelector.clear();
    result.byBreakpoint.clear();

    for (const entry of result.typography.entries) {
      // By property
      if (!result.byProperty.has(entry.property)) {
        result.byProperty.set(entry.property, []);
      }
      result.byProperty.get(entry.property)!.push(entry);

      // By selector
      if (!result.bySelector.has(entry.selector)) {
        result.bySelector.set(entry.selector, []);
      }
      result.bySelector.get(entry.selector)!.push(entry);

      // By breakpoint
      if (entry.context.mediaQuery) {
        const breakpoint = entry.context.mediaQuery.breakpoint.value;
        if (!result.byBreakpoint.has(breakpoint)) {
          result.byBreakpoint.set(breakpoint, []);
        }
        result.byBreakpoint.get(breakpoint)!.push(entry);
      }
    }
  }

  private validateTypographyEntry(entry: TypographyEntry): void {
    if (!entry.selector) {
      throw new Error('Typography entry must have a selector');
    }
    if (!entry.property) {
      throw new Error('Typography entry must have a property');
    }
    if (!entry.value.original) {
      throw new Error('Typography entry must have an original value');
    }
  }
}

// Export all types and classes
export * from './types';
export { TypographyExtractor } from './typography-extractor';
export { VariableResolver } from './variable-resolver';
export { MediaQueryAnalyzer } from './media-query-analyzer';
export { FontFaceProcessor } from './font-face-processor';
export { PropertyExtractorFactory } from './property-extractors';
export { TypographyAnalyzer } from './typography-analyzer';

// Default export
export default TypographyAPI;
