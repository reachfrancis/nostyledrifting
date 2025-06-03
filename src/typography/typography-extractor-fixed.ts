import { SCSSNode, RuleNode, DeclarationNode, AtRuleNode } from '../parser/ast-nodes';
import {
  TypographyProperty,
  TypographyEntry,
  TypographyAnalysisResult,
  ExtractionOptions,
  ExtractorConfiguration,
  TypographyCache,
  ExtractionError,
  ExtractionErrorType,
  InvalidationReason,
  ResolvedValue,
  ComputedValue,
  MediaQueryContext,
  ScopeContext,
  VariableResolutionContext,
  FontFaceDeclaration,
  CustomPropertyDefinition
} from './types';
import { VariableResolver } from './variable-resolver';
import { MediaQueryAnalyzer } from './media-query-analyzer';
import { FontFaceProcessor } from './font-face-processor';
import { PropertyExtractorFactory } from './property-extractors';
import { TypographyAnalyzer } from './typography-analyzer';
import * as crypto from 'crypto';

/**
 * Typography property map for identifying typography-related properties
 */
const TYPOGRAPHY_PROPERTIES: Set<string> = new Set([
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'font-stretch', 'font', 'line-height', 'letter-spacing', 'word-spacing',
  'text-transform', 'text-decoration', 'text-align', 'text-indent',
  'font-feature-settings', 'font-variant-numeric', 'font-variant-ligatures',
  'font-kerning'
]);

/**
 * Main typography extractor engine
 */
export class TypographyExtractor {
  private cache: TypographyCache;
  private variableResolver: VariableResolver;
  private mediaQueryAnalyzer: MediaQueryAnalyzer;
  private fontFaceProcessor: FontFaceProcessor;
  private propertyExtractorFactory: PropertyExtractorFactory;
  private analyzer: TypographyAnalyzer;
  private config: ExtractorConfiguration;
  private errors: ExtractionError[] = [];

  constructor(config?: Partial<ExtractorConfiguration>) {
    this.config = {
      maxCacheSize: 1000,
      timeoutMs: 30000,
      enableStreaming: true,
      chunkSize: 100,
      ...config
    };

    this.cache = this.createCache();
    this.variableResolver = new VariableResolver();
    this.mediaQueryAnalyzer = new MediaQueryAnalyzer();
    this.fontFaceProcessor = new FontFaceProcessor();
    this.propertyExtractorFactory = new PropertyExtractorFactory();
    this.analyzer = new TypographyAnalyzer();
  }

  /**
   * Main extraction method
   */
  public async extract(
    ast: SCSSNode,
    options: Partial<ExtractionOptions> = {}
  ): Promise<TypographyAnalysisResult> {
    return this.extractTypography(ast, '', options);
  }

  /**
   * Extract typography from AST with file path context
   */
  public async extractTypography(
    ast: SCSSNode,
    filePath: string,
    options: Partial<ExtractionOptions> = {}
  ): Promise<TypographyAnalysisResult> {
    const extractionOptions: ExtractionOptions = {
      resolveVariables: true,
      evaluateFunctions: true,
      computeValues: true,
      parallel: true,
      cacheResults: true,
      includeContext: true,
      includeMetadata: true,
      ...options
    };

    this.errors = [];
    const startTime = Date.now();

    try {
      // Build variable resolution context
      const variableContext = this.buildVariableContext(ast);

      // Extract typography entries
      const entries = await this.extractTypographyEntries(ast, variableContext, extractionOptions);

      // Extract font faces
      const fontFaces = this.fontFaceProcessor.extractFontFaces(ast);

      // Extract custom properties
      const customProperties = this.extractCustomProperties(ast);

      // Organize extracted data
      const organized = this.organizeExtractedData(entries);

      // Perform analysis
      const analysis = await this.analyzer.analyzeTypography(entries);

      const result: TypographyAnalysisResult = {
        summary: {
          totalProperties: entries.length,
          uniqueFonts: this.countUniqueFonts(entries),
          responsiveProperties: entries.filter((e: TypographyEntry) => e.metadata.isResponsive).length,
          customProperties: customProperties.length,
          fontFaceDeclarations: fontFaces.length
        },
        typography: {
          entries,
          fontFaces,
          customProperties
        },
        byProperty: organized.byProperty,
        bySelector: organized.bySelector,
        byBreakpoint: organized.byBreakpoint,
        fontStacks: analysis.fontStacks,
        consistency: analysis.consistency,
        accessibility: analysis.accessibility
      };

      const duration = Date.now() - startTime;
      console.log(`Typography extraction completed in ${duration}ms`);
      return result;
    } catch (error: unknown) {
      const extractionError: ExtractionError = {
        type: ExtractionErrorType.UNSUPPORTED_SYNTAX,
        message: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.location,
        recovery: {
          recover: () => ({
            canRecover: false,
            recoveredValue: null,
            strategy: 'skip' as const,
            warnings: [`Skipped extraction due to error: ${error instanceof Error ? error.message : String(error)}`]
          })
        }
      };
      this.errors.push(extractionError);
      throw error;
    }
  }

  /**
   * Build variable resolution context from AST
   */
  private buildVariableContext(ast: SCSSNode): VariableResolutionContext {
    const scssVariables = new Map();
    const customProperties = new Map();
    const importedVariables = new Map();

    // Walk AST to collect variables
    ast.walkChildren((node) => {
      if (node.type === 'declaration') {
        const declNode = node as DeclarationNode;
        
        // SCSS Variables
        if (declNode.property.startsWith('$')) {
          scssVariables.set(declNode.property, {
            name: declNode.property,
            value: declNode.value,
            scope: 'global',
            isDefault: false,
            location: declNode.location
          });
        }
        
        // CSS Custom Properties
        if (declNode.property.startsWith('--')) {
          customProperties.set(declNode.property, {
            name: declNode.property,
            value: declNode.value,
            location: declNode.location
          });
        }
      }
    });

    return {
      scssVariables,
      customProperties,
      currentScope: this.createGlobalScope(),
      globalScope: this.createGlobalScope(),
      importedVariables,
      options: {
        resolveToComputed: true,
        preserveOriginal: true,
        trackDependencies: true
      }
    };
  }

  /**
   * Extract typography entries from AST
   */
  private async extractTypographyEntries(
    ast: SCSSNode,
    variableContext: VariableResolutionContext,
    options: ExtractionOptions
  ): Promise<TypographyEntry[]> {
    const entries: TypographyEntry[] = [];
    const currentScope = this.createGlobalScope();
    const mediaQueryStack: MediaQueryContext[] = [];

    const extractFromNode = async (node: SCSSNode, parentSelectors: string[] = []): Promise<void> => {
      try {
        switch (node.type) {
          case 'rule':
            const ruleNode = node as RuleNode;
            const newParentSelectors = [...parentSelectors, ruleNode.selector];
            
            // Process declarations in this rule
            for (const child of node.children) {
              if (child.type === 'declaration') {
                const declNode = child as DeclarationNode;
                if (this.isTypographyProperty(declNode.property)) {
                  const entry = await this.createTypographyEntry(
                    declNode,
                    ruleNode.selector,
                    newParentSelectors,
                    variableContext,
                    mediaQueryStack,
                    options
                  );
                  if (entry) {
                    entries.push(entry);
                  }
                }
              }
            }

            // Process nested rules
            for (const child of node.children) {
              if (child.type === 'rule') {
                await extractFromNode(child, newParentSelectors);
              }
            }
            break;

          case 'atrule':
            const atRuleNode = node as AtRuleNode;
            if (atRuleNode.name === 'media') {
              // Parse media query and add to stack
              const mediaQuery = this.mediaQueryAnalyzer.parseMediaQuery(atRuleNode.params || '');
              if (mediaQuery) {
                mediaQueryStack.push(mediaQuery);
                
                // Process children with media query context
                for (const child of node.children) {
                  await extractFromNode(child, parentSelectors);
                }
                
                mediaQueryStack.pop();
              }
            } else {
              // Process other at-rules normally
              for (const child of node.children) {
                await extractFromNode(child, parentSelectors);
              }
            }
            break;

          default:
            // Process children of other node types
            for (const child of node.children) {
              await extractFromNode(child, parentSelectors);
            }
            break;
        }
      } catch (error) {
        this.handleExtractionError(error, node);
      }
    };

    await extractFromNode(ast);
    return entries;
  }

  /**
   * Create typography entry from declaration node
   */
  private async createTypographyEntry(
    declNode: DeclarationNode,
    selector: string,
    parentSelectors: string[],
    variableContext: VariableResolutionContext,
    mediaQueryStack: MediaQueryContext[],
    options: ExtractionOptions
  ): Promise<TypographyEntry | null> {
    try {
      const property = declNode.property as TypographyProperty;
      const originalValue = declNode.value;

      // Resolve value if needed
      let resolvedValue = originalValue;
      const dependencies: string[] = [];

      if (options.resolveVariables && this.containsVariables(originalValue)) {
        const resolved = await this.variableResolver.resolve(originalValue, variableContext);
        resolvedValue = resolved.resolved;
        dependencies.push(...resolved.dependencies);
      }

      // Compute value if it contains functions
      let computedValue: ComputedValue | undefined;
      if (options.computeValues && this.containsFunctions(resolvedValue)) {
        computedValue = await this.variableResolver.evaluateExpression(resolvedValue, variableContext);
      }

      // Generate unique ID
      const id = this.generateEntryId(selector, property, originalValue);

      // Create entry
      const entry: TypographyEntry = {
        id,
        selector,
        property,
        value: {
          original: originalValue,
          resolved: resolvedValue,
          computed: computedValue
        },
        context: {
          file: declNode.location.file,
          location: declNode.location,
          scope: {
            currentScope: variableContext.currentScope,
            inheritedScopes: []
          },
          specificity: this.calculateSpecificity(selector),
          mediaQuery: mediaQueryStack.length > 0 ? mediaQueryStack[mediaQueryStack.length - 1] : undefined,
          parentSelectors
        },
        dependencies: {
          variables: dependencies.filter(d => d.startsWith('$')),
          mixins: [],
          imports: [],
          customProperties: dependencies.filter(d => d.startsWith('--'))
        },
        metadata: {
          isResponsive: mediaQueryStack.length > 0,
          hasVariables: this.containsVariables(originalValue),
          hasFunctions: this.containsFunctions(originalValue),
          isInherited: false,
          overrides: []
        }
      };

      return entry;

    } catch (error) {
      this.handleExtractionError(error, declNode);
      return null;
    }
  }

  /**
   * Extract custom properties from AST
   */
  private extractCustomProperties(ast: SCSSNode): CustomPropertyDefinition[] {
    const customProperties: CustomPropertyDefinition[] = [];

    ast.walkChildren((node) => {
      if (node.type === 'declaration') {
        const declNode = node as DeclarationNode;
        if (declNode.property.startsWith('--')) {
          customProperties.push({
            name: declNode.property,
            value: declNode.value,
            scope: 'global',
            location: declNode.location
          });
        }
      }
    });

    return customProperties;
  }

  /**
   * Organize extracted data by property, selector, and breakpoint
   */
  private organizeExtractedData(entries: TypographyEntry[]) {
    const byProperty = new Map<TypographyProperty, TypographyEntry[]>();
    const bySelector = new Map<string, TypographyEntry[]>();
    const byBreakpoint = new Map<string, TypographyEntry[]>();

    for (const entry of entries) {
      // By property
      if (!byProperty.has(entry.property)) {
        byProperty.set(entry.property, []);
      }
      byProperty.get(entry.property)!.push(entry);

      // By selector
      if (!bySelector.has(entry.selector)) {
        bySelector.set(entry.selector, []);
      }
      bySelector.get(entry.selector)!.push(entry);

      // By breakpoint
      if (entry.context.mediaQuery) {
        const breakpointKey = `${entry.context.mediaQuery.breakpoint.type}:${entry.context.mediaQuery.breakpoint.value}`;
        if (!byBreakpoint.has(breakpointKey)) {
          byBreakpoint.set(breakpointKey, []);
        }
        byBreakpoint.get(breakpointKey)!.push(entry);
      } else {
        if (!byBreakpoint.has('base')) {
          byBreakpoint.set('base', []);
        }
        byBreakpoint.get('base')!.push(entry);
      }
    }

    return { byProperty, bySelector, byBreakpoint };
  }

  /**
   * Helper methods
   */
  private isTypographyProperty(property: string): boolean {
    return TYPOGRAPHY_PROPERTIES.has(property) || property.startsWith('--');
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /calc\(|clamp\(|min\(|max\(/i.test(value);
  }

  private generateEntryId(selector: string, property: string, value: string): string {
    const input = `${selector}:${property}:${value}`;
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
  }

  private calculateSpecificity(selector: string): number {
    // Simplified specificity calculation
    const ids = (selector.match(/#/g) || []).length;
    const classes = (selector.match(/\./g) || []).length;
    const elements = (selector.match(/[a-zA-Z]/g) || []).length;
    
    return ids * 100 + classes * 10 + elements;
  }

  private countUniqueFonts(entries: TypographyEntry[]): number {
    const fonts = new Set();
    entries
      .filter(e => e.property === 'font-family')
      .forEach(e => fonts.add(e.value.resolved));
    return fonts.size;
  }

  private createGlobalScope(): ScopeContext {
    return {
      type: 'global',
      variables: new Map()
    };
  }

  private createCache(): TypographyCache {
    return {
      variableCache: new Map(),
      functionCache: new Map(),
      selectorCache: new Map(),
      invalidate(reason: InvalidationReason): void {
        if (reason === 'file-change' || reason === 'manual') {
          this.variableCache.clear();
          this.functionCache.clear();
          this.selectorCache.clear();
        }
      }
    };
  }

  private handleExtractionError(error: unknown, node: SCSSNode): void {
    const extractionError: ExtractionError = {
      type: ExtractionErrorType.UNSUPPORTED_SYNTAX,
      message: error instanceof Error ? error.message : 'Unknown extraction error',
      location: node.location,
      recovery: {
        recover: () => ({
          canRecover: false,
          recoveredValue: null,
          strategy: 'skip',
          warnings: [`Skipped node due to error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        })
      }
    };
    
    this.errors.push(extractionError);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Extraction error at ${node.location.file}:${node.location.line} - ${errorMessage}`);
  }

  /**
   * Configuration methods
   */
  public configure(config: Partial<ExtractorConfiguration>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get extraction errors
   */
  public getErrors(): ExtractionError[] {
    return [...this.errors];
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.invalidate('manual');
  }
}
