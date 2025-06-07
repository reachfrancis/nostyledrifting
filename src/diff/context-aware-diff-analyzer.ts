/**
 * Context-Aware Diff Analyzer for SCSS Variable Resolution and Context Analysis
 * Provides intelligent diff analysis that understands SCSS context, variables, and dependencies
 */

import { VariableResolver } from '../typography/variable-resolver';
import { EnhancedVariableResolver } from './enhanced-variable-resolver';
import { DiffError, DiffAnalysisError, CircularDependencyError } from './errors';
import {
  VariableDefinition,
  VariableScope,
  VariableResolutionContext,
  VariableDependencyGraph,
  VariableImpactAnalysis,
  SelectorContextChange,
  ImportDependencyChange,
  ContextualDiffResult,
  EnhancedDiffChunk,
  DiffChunk,
  StyleDifference
} from './types';

/**
 * Configuration options for context-aware diff analysis
 */
export interface ContextualDiffOptions {
  /** Whether to analyze variable dependencies */
  analyzeVariables: boolean;
  /** Whether to track import changes */
  trackImports: boolean;
  /** Whether to analyze selector context changes */
  analyzeSelectorContext: boolean;
  /** Maximum depth for dependency analysis */
  maxDependencyDepth: number;
  /** Whether to include impact analysis */
  includeImpactAnalysis: boolean;
  /** Timeout for analysis operations (ms) */
  analysisTimeout: number;
  /** Whether to cache analysis results */
  enableCaching: boolean;
}

/**
 * Default configuration for contextual diff analysis
 */
export const DEFAULT_CONTEXTUAL_DIFF_OPTIONS: ContextualDiffOptions = {
  analyzeVariables: true,
  trackImports: true,
  analyzeSelectorContext: true,
  maxDependencyDepth: 10,
  includeImpactAnalysis: true,
  analysisTimeout: 30000, // 30 seconds
  enableCaching: true
};

/**
 * Context-aware diff analyzer that understands SCSS-specific features
 */
export class ContextAwareDiffAnalyzer {
  private enhancedVariableResolver: EnhancedVariableResolver;
  private analysisCache = new Map<string, ContextualDiffResult>();
  private options: ContextualDiffOptions;
  constructor(
    baseVariableResolver?: VariableResolver,
    options: Partial<ContextualDiffOptions> = {}
  ) {
    this.enhancedVariableResolver = new EnhancedVariableResolver();
    this.options = { ...DEFAULT_CONTEXTUAL_DIFF_OPTIONS, ...options };
  }

  /**
   * Performs context-aware diff analysis between two SCSS file states
   */
  async analyzeContextualDiff(
    beforeContent: string,
    afterContent: string,
    filePath: string,
    baseDiffChunks: DiffChunk[] = []
  ): Promise<ContextualDiffResult> {
    const cacheKey = this.generateCacheKey(beforeContent, afterContent, filePath);
    
    if (this.options.enableCaching && this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    try {
      const result = await this.performContextualAnalysis(
        beforeContent,
        afterContent,
        filePath,
        baseDiffChunks
      );

      if (this.options.enableCaching) {
        this.analysisCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      if (error instanceof CircularDependencyError) {
        throw error;
      }
      throw new DiffAnalysisError(
        `Context-aware diff analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        { beforeLength: beforeContent.length, afterLength: afterContent.length }
      );
    }
  }

  /**
   * Performs the core contextual analysis
   */
  private async performContextualAnalysis(
    beforeContent: string,
    afterContent: string,
    filePath: string,
    baseDiffChunks: DiffChunk[]
  ): Promise<ContextualDiffResult> {
    const startTime = Date.now();
    const analysisPromise = this.executeAnalysis(beforeContent, afterContent, filePath, baseDiffChunks);
    
    // Apply timeout if configured
    if (this.options.analysisTimeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new DiffAnalysisError(
            `Context analysis timed out after ${this.options.analysisTimeout}ms`,
            filePath
          ));
        }, this.options.analysisTimeout);
      });

      return await Promise.race([analysisPromise, timeoutPromise]);
    }

    return await analysisPromise;
  }

  /**
   * Executes the main analysis logic
   */
  private async executeAnalysis(
    beforeContent: string,
    afterContent: string,
    filePath: string,
    baseDiffChunks: DiffChunk[]  ): Promise<ContextualDiffResult> {
    // Analyze variables in both states
    const beforeContext = this.options.analyzeVariables 
      ? await this.enhancedVariableResolver.analyzeContent(beforeContent, filePath)
      : null;
    
    const afterContext = this.options.analyzeVariables
      ? await this.enhancedVariableResolver.analyzeContent(afterContent, filePath)
      : null;

    // Extract variables and dependencies from contexts
    const beforeVariables = beforeContext ? Array.from(beforeContext.variables.values()) : [];
    const afterVariables = afterContext ? Array.from(afterContext.variables.values()) : [];
    const beforeDependencies = beforeContext ? beforeContext.dependencies : new Map();
    const afterDependencies = afterContext ? afterContext.dependencies : new Map();

    // Analyze variable changes
    const variableChanges = this.analyzeVariableChanges(beforeVariables, afterVariables);

    // Analyze import changes
    const importChanges = this.options.trackImports
      ? this.analyzeImportChanges(beforeContent, afterContent)
      : [];

    // Analyze selector context changes
    const selectorContextChanges = this.options.analyzeSelectorContext
      ? this.analyzeSelectorContextChanges(beforeContent, afterContent)
      : [];

    // Perform impact analysis
    const impactAnalysis = this.options.includeImpactAnalysis
      ? await this.performImpactAnalysis(variableChanges, beforeDependencies, afterDependencies)
      : undefined;

    // Create enhanced diff chunks
    const enhancedChunks = this.createEnhancedDiffChunks(
      baseDiffChunks,
      variableChanges,
      importChanges,
      selectorContextChanges
    );    return {
      filePath,
      chunks: enhancedChunks,
      variableImpact: impactAnalysis || {
        addedVariables: [],
        removedVariables: [],
        modifiedVariables: [],
        affectedComponents: [],
        affectedVariables: [],
        cascadeEffects: [],
        recommendations: []
      },
      selectorChanges: selectorContextChanges,
      importChanges,      summary: {
        linesAdded: 0,
        linesRemoved: 0,
        linesModified: 0,
        propertiesChanged: 0,
        changeComplexity: 'low',
        variablesChanged: variableChanges.length,
        highImpactVariableChanges: variableChanges.filter(c => c.impact === 'high').length,
        selectorChanges: selectorContextChanges.length,
        importChanges: importChanges.length,
        contextualComplexity: this.calculateImpactScore(variableChanges) > 5 ? 'high' : 'medium'
      }
    };
  }

  /**
   * Analyzes changes in variable definitions between two states
   */
  private analyzeVariableChanges(
    beforeVariables: VariableDefinition[],
    afterVariables: VariableDefinition[]
  ): Array<{
    type: 'added' | 'removed' | 'modified';
    variable: VariableDefinition;
    previousValue?: string;
    impact: 'low' | 'medium' | 'high';
  }> {
    const changes: Array<{
      type: 'added' | 'removed' | 'modified';
      variable: VariableDefinition;
      previousValue?: string;
      impact: 'low' | 'medium' | 'high';
    }> = [];

    const beforeMap = new Map(beforeVariables.map(v => [v.name, v]));
    const afterMap = new Map(afterVariables.map(v => [v.name, v]));

    // Find added variables
    for (const [name, variable] of afterMap) {
      if (!beforeMap.has(name)) {
        changes.push({
          type: 'added',
          variable,
          impact: this.assessVariableImpact(variable)
        });
      }
    }

    // Find removed variables
    for (const [name, variable] of beforeMap) {
      if (!afterMap.has(name)) {
        changes.push({
          type: 'removed',
          variable,
          impact: this.assessVariableImpact(variable)
        });
      }
    }

    // Find modified variables
    for (const [name, afterVariable] of afterMap) {
      const beforeVariable = beforeMap.get(name);
      if (beforeVariable && beforeVariable.value !== afterVariable.value) {
        changes.push({
          type: 'modified',
          variable: afterVariable,
          previousValue: beforeVariable.value,
          impact: this.assessVariableImpact(afterVariable)
        });
      }
    }

    return changes;
  }

  /**
   * Analyzes import dependency changes between two states
   */
  private analyzeImportChanges(
    beforeContent: string,
    afterContent: string
  ): ImportDependencyChange[] {
    const beforeImports = this.extractImports(beforeContent);
    const afterImports = this.extractImports(afterContent);

    const changes: ImportDependencyChange[] = [];
    const beforeSet = new Set(beforeImports);
    const afterSet = new Set(afterImports);    // Find added imports
    for (const importPath of afterImports) {
      if (!beforeSet.has(importPath)) {
        changes.push({
          type: 'added',
          importPath,
          impact: 'medium',
          line: this.findImportLine(afterContent, importPath),
          reasoning: 'New import dependency added'
        });
      }
    }

    // Find removed imports
    for (const importPath of beforeImports) {
      if (!afterSet.has(importPath)) {
        changes.push({
          type: 'removed',
          importPath,
          impact: 'medium',
          line: this.findImportLine(beforeContent, importPath),
          reasoning: 'Import dependency removed'
        });
      }
    }

    return changes;
  }

  /**
   * Analyzes selector context changes between two states
   */
  private analyzeSelectorContextChanges(
    beforeContent: string,
    afterContent: string
  ): SelectorContextChange[] {
    const beforeSelectors = this.extractSelectors(beforeContent);
    const afterSelectors = this.extractSelectors(afterContent);

    const changes: SelectorContextChange[] = [];
    const beforeSet = new Set(beforeSelectors);
    const afterSet = new Set(afterSelectors);    // Find added selectors
    for (const selector of afterSelectors) {
      if (!beforeSet.has(selector)) {
        changes.push({
          type: 'added',
          selector,
          impact: 'low',
          line: this.findSelectorLine(afterContent, selector),
          reasoning: 'New selector added'
        });
      }
    }

    // Find removed selectors
    for (const selector of beforeSelectors) {
      if (!afterSet.has(selector)) {
        changes.push({
          type: 'removed',
          selector,
          impact: 'low',
          line: this.findSelectorLine(beforeContent, selector),
          reasoning: 'Selector removed'
        });
      }
    }

    return changes;
  }

  /**
   * Performs impact analysis for variable changes
   */
  private async performImpactAnalysis(
    variableChanges: Array<{
      type: 'added' | 'removed' | 'modified';
      variable: VariableDefinition;
      previousValue?: string;
      impact: 'low' | 'medium' | 'high';
    }>,
    beforeDependencies: VariableDependencyGraph,
    afterDependencies: VariableDependencyGraph  ): Promise<VariableImpactAnalysis> {
    const affectedVariableNames = new Set<string>();
    const cascadingChanges: string[] = [];

    for (const change of variableChanges) {
      const variableName = change.variable.name;
      
      // Find variables that depend on this changed variable
      const dependents = afterDependencies.get(variableName) || [];
      dependents.forEach(dep => affectedVariableNames.add(dep));

      // Check for cascading changes
      if (change.impact === 'high') {
        cascadingChanges.push(variableName);
      }
    }    // Convert affected variable names to VariableDefinition objects
    const affectedVariables: VariableDefinition[] = Array.from(affectedVariableNames).map(name => ({
      name,
      value: '', // Placeholder value
      filePath: '',
      lineNumber: 0,
      scope: 'local' as VariableScope,
      isDefault: false,
      isGlobal: false,
      dependencies: [],
      usage: [],
      reasoning: 'Affected by variable changes'
    }));    return {
      addedVariables: variableChanges.filter(c => c.type === 'added').map(c => c.variable),
      removedVariables: variableChanges.filter(c => c.type === 'removed').map(c => c.variable),
      modifiedVariables: variableChanges.filter(c => c.type === 'modified').map(c => ({
        variable: c.variable,
        oldValue: c.previousValue || '',
        newValue: c.variable.value,
        impact: c.impact
      })),
      affectedComponents: [], // TODO: Implement component analysis
      affectedVariables,
      cascadeEffects: [{
        variableName: 'unknown',
        affectedVariables: cascadingChanges,
        cascadeDepth: cascadingChanges.length,
        impactLevel: cascadingChanges.length > 5 ? 'high' : 'medium'
      }],
      recommendations: this.generateRecommendations(variableChanges, affectedVariableNames)
    };
  }

  /**
   * Creates enhanced diff chunks with context information
   */  private createEnhancedDiffChunks(
    baseDiffChunks: DiffChunk[],
    variableChanges: any[],
    importChanges: ImportDependencyChange[],
    selectorContextChanges: SelectorContextChange[]
  ): EnhancedDiffChunk[] {
    return baseDiffChunks.map(chunk => ({
      ...chunk,
      affectedVariables: this.findAffectedVariables(chunk, variableChanges),
      resolvedVariables: new Map<string, any>(),
      importContext: [],
      mixinUsage: []
    }));
  }

  /**
   * Utility methods
   */

  private generateCacheKey(beforeContent: string, afterContent: string, filePath: string): string {
    const contentHash = this.simpleHash(beforeContent + afterContent + filePath);
    return `contextual-diff-${contentHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private assessVariableImpact(variable: VariableDefinition): 'low' | 'medium' | 'high' {
    // Color variables typically have higher impact
    if (variable.name.includes('color') || variable.name.includes('bg')) {
      return 'high';
    }
    
    // Typography variables have medium impact
    if (variable.name.includes('font') || variable.name.includes('text')) {
      return 'medium';
    }
    
    // Global scope variables have higher impact
    if (variable.scope === 'global') {
      return 'high';
    }
    
    return 'low';
  }
  private extractImports(content: string): string[] {
    const importRegex = /@import\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
  private findImportLine(content: string, importPath: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(importPath)) {
        return i + 1; // 1-based line numbers
      }
    }
    return 0; // Not found
  }

  private findSelectorLine(content: string, selector: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(selector)) {
        return i + 1; // 1-based line numbers
      }
    }
    return 0; // Not found
  }

  private extractSelectors(content: string): string[] {
    // Simplified selector extraction - could be enhanced with proper SCSS parsing
    const selectorRegex = /([.#]?[\w-]+(?:\s*[>+~]\s*[\w-]+)*)\s*{/g;
    const selectors: string[] = [];
    let match;
    
    while ((match = selectorRegex.exec(content)) !== null) {
      selectors.push(match[1].trim());
    }
    
    return selectors;
  }

  private calculateImpactScore(changes: any[]): number {
    let score = 0;
    for (const change of changes) {
      switch (change.impact) {
        case 'high': score += 3; break;
        case 'medium': score += 2; break;
        case 'low': score += 1; break;
      }
    }
    return Math.min(score / changes.length * 10, 10); // Normalize to 0-10 scale
  }

  private generateRecommendations(changes: any[], affectedVariables: Set<string>): string[] {
    const recommendations: string[] = [];
    
    if (changes.some(c => c.impact === 'high')) {
      recommendations.push('Review high-impact variable changes for visual consistency');
    }
    
    if (affectedVariables.size > 5) {
      recommendations.push('Consider testing components that use the affected variables');
    }
    
    if (changes.some(c => c.type === 'removed')) {
      recommendations.push('Verify that removed variables are not used elsewhere');
    }
    
    return recommendations;
  }
  private determineContextType(chunk: DiffChunk): string {
    const chunkContent = chunk.changes.map(change => change.content).join('\n');
    if (chunkContent.includes('@import')) return 'import';
    if (chunkContent.includes('$')) return 'variable';
    if (chunkContent.includes('@mixin')) return 'mixin';
    if (chunkContent.includes('{')) return 'rule';
    return 'unknown';
  }
  private findAffectedVariables(chunk: DiffChunk, variableChanges: any[]): VariableDefinition[] {
    const variables: VariableDefinition[] = [];
    const variableRegex = /\$[\w-]+/g;
    const chunkContent = chunk.changes.map(change => change.content).join('\n');
    let match;
    
    while ((match = variableRegex.exec(chunkContent)) !== null) {
      const variableName = match[0];      // Convert string variable name to VariableDefinition
      const variableDefinition: VariableDefinition = {
        name: variableName,
        value: '', // Placeholder value
        filePath: '',
        lineNumber: 0,
        scope: 'local' as VariableScope,
        isDefault: false,
        isGlobal: false,
        dependencies: [],
        usage: []
      };
      variables.push(variableDefinition);
    }
    
    return variables;
  }  private findSelectorChanges(chunk: DiffChunk, selectorChanges: SelectorContextChange[]): SelectorContextChange[] {
    const chunkContent = chunk.changes.map(change => change.content).join('\n');
    return selectorChanges.filter(change => 
      change.selector && chunkContent.includes(change.selector)
    );
  }
  private findImportChanges(chunk: DiffChunk, importChanges: ImportDependencyChange[]): ImportDependencyChange[] {
    const chunkContent = chunk.changes.map(change => change.content).join('\n');
    return importChanges.filter(change => 
      chunkContent.includes(change.importPath)
    );
  }
  private assessSemanticImpact(chunk: DiffChunk, variableChanges: any[]): 'low' | 'medium' | 'high' {
    const chunkContent = chunk.changes.map(change => change.content).join('\n');
    const hasHighImpactVariables = variableChanges.some(change => 
      change.impact === 'high' && chunkContent.includes(change.variable.name)
    );
    
    if (hasHighImpactVariables) return 'high';
    if (chunkContent.includes('@import')) return 'medium';
    if (chunkContent.includes('$')) return 'medium';
    
    return 'low';
  }

  /**
   * Clears the analysis cache
   */
  public clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.analysisCache.size,
      maxSize: 100 // Default max cache size
    };
  }
}
