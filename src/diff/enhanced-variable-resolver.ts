/**
 * Enhanced Variable Resolution System for SCSS
 * Provides comprehensive variable tracking, dependency analysis, and context-aware resolution
 */

import { VariableResolver } from '../typography/variable-resolver';
import {
  VariableDefinition,
  VariableScope,
  VariableResolutionContext,
  VariableDependencyGraph,
  VariableImpactAnalysis,
  ScssImportInfo,
  PropertyContext
} from './types';
import { CircularDependencyError, DiffError, DiffErrorType } from './errors';

/**
 * Enhanced variable resolver with comprehensive SCSS variable analysis
 */
export class EnhancedVariableResolver extends VariableResolver {
  private variableDefinitions = new Map<string, VariableDefinition>();
  private dependencyGraph: VariableDependencyGraph = new Map();
  private resolutionCache = new Map<string, string>();
  private scopeStack: VariableScope[] = [];
  private currentContext?: VariableResolutionContext;

  /**
   * Analyzes SCSS content and builds comprehensive variable mappings
   */
  public async analyzeContent(
    content: string,
    filePath: string,
    imports: ScssImportInfo[] = []
  ): Promise<VariableResolutionContext> {
    this.currentContext = {
      filePath,
      imports,
      variables: new Map(),
      scopes: [],
      dependencies: new Map()
    };

    try {
      // Parse variable definitions
      await this.extractVariableDefinitions(content, filePath);
      
      // Build dependency graph
      await this.buildDependencyGraph();
      
      // Resolve imports and their variables
      await this.resolveImportedVariables(imports);
      
      // Detect circular dependencies
      this.detectCircularDependencies();
      
      return this.currentContext;
    } catch (error) {
      throw new DiffError(
        DiffErrorType.VARIABLE_RESOLUTION_FAILED,
        `Failed to analyze SCSS content: ${error.message}`,
        filePath,
        { originalError: error }
      );
    }
  }

  /**
   * Resolves a variable to its final value with full context tracking
   */
  public async resolveVariableWithContext(
    variableName: string,
    context: PropertyContext
  ): Promise<{
    value: string;
    definition: VariableDefinition;
    dependencyChain: string[];
  }> {
    const cacheKey = `${variableName}:${context.selector}:${context.property}`;
    
    if (this.resolutionCache.has(cacheKey)) {
      const cachedValue = this.resolutionCache.get(cacheKey)!;
      const definition = this.variableDefinitions.get(variableName);
      
      if (definition) {
        return {
          value: cachedValue,
          definition,
          dependencyChain: this.getDependencyChain(variableName)
        };
      }
    }

    const dependencyChain: string[] = [];
    const resolvedValue = await this.resolveVariableRecursive(
      variableName,
      context,
      dependencyChain
    );

    const definition = this.variableDefinitions.get(variableName);
    if (!definition) {
      throw new DiffError(
        DiffErrorType.VARIABLE_RESOLUTION_FAILED,
        `Variable definition not found: ${variableName}`,
        this.currentContext?.filePath
      );
    }

    this.resolutionCache.set(cacheKey, resolvedValue);

    return {
      value: resolvedValue,
      definition,
      dependencyChain
    };
  }

  /**
   * Analyzes the impact of variable changes on dependent properties
   */
  public analyzeVariableImpact(
    variableName: string,
    newValue: string
  ): VariableImpactAnalysis {
    const dependencies = this.dependencyGraph.get(variableName) || [];
    const affectedProperties: PropertyContext[] = [];
    const cascadingVariables: string[] = [];

    // Find all properties that use this variable
    for (const [defName, definition] of this.variableDefinitions) {
      if (definition.dependencies.includes(variableName)) {
        cascadingVariables.push(defName);
        
        // Find properties that use the dependent variable
        affectedProperties.push(...this.findPropertiesUsingVariable(defName));
      }
    }

    // Direct property usage
    affectedProperties.push(...this.findPropertiesUsingVariable(variableName));

    return {
      variableName,
      directDependents: dependencies,
      cascadingVariables,
      affectedProperties: this.deduplicatePropertyContexts(affectedProperties),
      impactScope: this.calculateImpactScope(affectedProperties),
      riskLevel: this.assessRiskLevel(affectedProperties, cascadingVariables)
    };
  }

  /**
   * Compares variable contexts between two SCSS analyses
   */
  public compareVariableContexts(
    context1: VariableResolutionContext,
    context2: VariableResolutionContext
  ): {
    added: VariableDefinition[];
    removed: VariableDefinition[];
    modified: Array<{
      variable: string;
      before: VariableDefinition;
      after: VariableDefinition;
    }>;
    scopeChanges: Array<{
      variable: string;
      beforeScope: VariableScope;
      afterScope: VariableScope;
    }>;
  } {
    const added: VariableDefinition[] = [];
    const removed: VariableDefinition[] = [];
    const modified: Array<{
      variable: string;
      before: VariableDefinition;
      after: VariableDefinition;
    }> = [];
    const scopeChanges: Array<{
      variable: string;
      beforeScope: VariableScope;
      afterScope: VariableScope;
    }> = [];

    // Find added variables
    for (const [name, definition] of context2.variables) {
      if (!context1.variables.has(name)) {
        added.push(definition);
      }
    }

    // Find removed and modified variables
    for (const [name, definition1] of context1.variables) {
      const definition2 = context2.variables.get(name);
      
      if (!definition2) {
        removed.push(definition1);
      } else if (!this.areVariableDefinitionsEqual(definition1, definition2)) {
        modified.push({
          variable: name,
          before: definition1,
          after: definition2
        });

        // Check for scope changes
        if (definition1.scope !== definition2.scope) {
          scopeChanges.push({
            variable: name,
            beforeScope: definition1.scope,
            afterScope: definition2.scope
          });
        }
      }
    }

    return { added, removed, modified, scopeChanges };
  }

  /**
   * Extracts variable definitions from SCSS content
   */
  private async extractVariableDefinitions(
    content: string,
    filePath: string
  ): Promise<void> {
    const variableRegex = /\$([a-zA-Z-_][a-zA-Z0-9-_]*)\s*:\s*([^;]+);/g;
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const [fullMatch, name, value] = match;
      const lineNumber = this.getLineNumber(content, match.index);
      
      const dependencies = this.extractVariableDependencies(value);
      const scope = this.determineVariableScope(content, match.index);

      const definition: VariableDefinition = {
        name,
        value: value.trim(),
        filePath,
        lineNumber,
        scope,
        dependencies,
        isDefault: value.includes('!default'),
        usage: []
      };

      this.variableDefinitions.set(name, definition);
      
      if (this.currentContext) {
        this.currentContext.variables.set(name, definition);
      }
    }
  }

  /**
   * Builds dependency graph for variables
   */
  private async buildDependencyGraph(): Promise<void> {
    for (const [name, definition] of this.variableDefinitions) {
      const dependencies: string[] = [];
      
      for (const dep of definition.dependencies) {
        if (this.variableDefinitions.has(dep)) {
          dependencies.push(dep);
        }
      }
      
      this.dependencyGraph.set(name, dependencies);
      
      if (this.currentContext) {
        this.currentContext.dependencies.set(name, dependencies);
      }
    }
  }

  /**
   * Resolves variables from imported files
   */
  private async resolveImportedVariables(
    imports: ScssImportInfo[]
  ): Promise<void> {
    for (const importInfo of imports) {
      try {
        // In a real implementation, you would parse the imported file
        // For now, we'll simulate this with placeholder logic
        const importedVariables = await this.parseImportedFile(importInfo.path);
        
        for (const [name, definition] of importedVariables) {
          if (!this.variableDefinitions.has(name)) {
            this.variableDefinitions.set(name, {
              ...definition,
              scope: 'imported' as VariableScope
            });
          }
        }
      } catch (error) {
        // Log import resolution failure but continue
        console.warn(`Failed to resolve import: ${importInfo.path}`, error);
      }
    }
  }

  /**
   * Detects circular dependencies in variable definitions
   */
  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const variableName of this.dependencyGraph.keys()) {
      if (!visited.has(variableName)) {
        this.detectCircularDependenciesRecursive(
          variableName,
          visited,
          recursionStack,
          []
        );
      }
    }
  }

  /**
   * Recursive helper for circular dependency detection
   */
  private detectCircularDependenciesRecursive(
    variableName: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): void {
    visited.add(variableName);
    recursionStack.add(variableName);
    path.push(variableName);

    const dependencies = this.dependencyGraph.get(variableName) || [];
    
    for (const dependency of dependencies) {
      if (!visited.has(dependency)) {
        this.detectCircularDependenciesRecursive(
          dependency,
          visited,
          recursionStack,
          [...path]
        );
      } else if (recursionStack.has(dependency)) {
        const circularPath = [...path, dependency];
        throw new CircularDependencyError(
          `Circular dependency detected: ${circularPath.join(' -> ')}`,
          circularPath
        );
      }
    }

    recursionStack.delete(variableName);
  }

  /**
   * Resolves a variable recursively with dependency tracking
   */
  private async resolveVariableRecursive(
    variableName: string,
    context: PropertyContext,
    dependencyChain: string[]
  ): Promise<string> {
    if (dependencyChain.includes(variableName)) {
      throw new CircularDependencyError(
        `Circular dependency in variable resolution: ${dependencyChain.join(' -> ')} -> ${variableName}`,
        [...dependencyChain, variableName]
      );
    }

    const definition = this.variableDefinitions.get(variableName);
    if (!definition) {
      throw new DiffError(
        DiffErrorType.VARIABLE_RESOLUTION_FAILED,
        `Variable not found: ${variableName}`,
        context.filePath
      );
    }

    dependencyChain.push(variableName);
    let resolvedValue = definition.value;

    // Resolve any variables within this variable's value
    const variableMatches = resolvedValue.match(/\$([a-zA-Z-_][a-zA-Z0-9-_]*)/g);
    if (variableMatches) {
      for (const match of variableMatches) {
        const depVariableName = match.substring(1); // Remove $
        const depValue = await this.resolveVariableRecursive(
          depVariableName,
          context,
          [...dependencyChain]
        );
        resolvedValue = resolvedValue.replace(match, depValue);
      }
    }

    return resolvedValue;
  }

  /**
   * Gets the dependency chain for a variable
   */
  private getDependencyChain(variableName: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    
    this.buildDependencyChainRecursive(variableName, chain, visited);
    return chain;
  }

  /**
   * Builds dependency chain recursively
   */
  private buildDependencyChainRecursive(
    variableName: string,
    chain: string[],
    visited: Set<string>
  ): void {
    if (visited.has(variableName)) return;
    
    visited.add(variableName);
    chain.push(variableName);
    
    const dependencies = this.dependencyGraph.get(variableName) || [];
    for (const dep of dependencies) {
      this.buildDependencyChainRecursive(dep, chain, visited);
    }
  }

  /**
   * Finds properties that use a specific variable
   */
  private findPropertiesUsingVariable(variableName: string): PropertyContext[] {
    const definition = this.variableDefinitions.get(variableName);
    return definition?.usage || [];
  }

  /**
   * Deduplicates property contexts
   */
  private deduplicatePropertyContexts(contexts: PropertyContext[]): PropertyContext[] {
    const seen = new Set<string>();
    return contexts.filter(context => {
      const key = `${context.filePath}:${context.selector}:${context.property}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculates the scope of impact for variable changes
   */
  private calculateImpactScope(affectedProperties: PropertyContext[]): 'local' | 'component' | 'global' {
    const files = new Set(affectedProperties.map(p => p.filePath));
    
    if (files.size === 1) return 'local';
    if (files.size <= 5) return 'component';
    return 'global';
  }

  /**
   * Assesses the risk level of a variable change
   */
  private assessRiskLevel(
    affectedProperties: PropertyContext[],
    cascadingVariables: string[]
  ): 'low' | 'medium' | 'high' {
    const totalImpact = affectedProperties.length + cascadingVariables.length;
    
    if (totalImpact <= 5) return 'low';
    if (totalImpact <= 20) return 'medium';
    return 'high';
  }

  /**
   * Extracts variable dependencies from a value string
   */
  private extractVariableDependencies(value: string): string[] {
    const dependencies: string[] = [];
    const variableMatches = value.match(/\$([a-zA-Z-_][a-zA-Z0-9-_]*)/g);
    
    if (variableMatches) {
      for (const match of variableMatches) {
        dependencies.push(match.substring(1)); // Remove $
      }
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Determines the scope of a variable based on its position in the content
   */
  private determineVariableScope(content: string, position: number): VariableScope {
    const beforePosition = content.substring(0, position);
    
    // Check if inside a selector block
    const openBraces = (beforePosition.match(/{/g) || []).length;
    const closeBraces = (beforePosition.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      return 'local';
    }
    
    // Check if inside a mixin or function
    if (beforePosition.includes('@mixin') || beforePosition.includes('@function')) {
      return 'mixin';
    }
    
    return 'global';
  }

  /**
   * Gets the line number for a position in content
   */
  private getLineNumber(content: string, position: number): number {
    return content.substring(0, position).split('\n').length;
  }

  /**
   * Compares two variable definitions for equality
   */
  private areVariableDefinitionsEqual(
    def1: VariableDefinition,
    def2: VariableDefinition
  ): boolean {
    return (
      def1.value === def2.value &&
      def1.scope === def2.scope &&
      def1.isDefault === def2.isDefault &&
      JSON.stringify(def1.dependencies) === JSON.stringify(def2.dependencies)
    );
  }

  /**
   * Parses an imported SCSS file (placeholder implementation)
   */
  private async parseImportedFile(filePath: string): Promise<Map<string, VariableDefinition>> {
    // In a real implementation, this would parse the imported file
    // For now, return an empty map
    return new Map();
  }
}
