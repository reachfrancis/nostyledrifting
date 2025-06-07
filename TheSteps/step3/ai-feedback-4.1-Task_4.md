# Task 4: SCSS Variable Resolution and Context Analysis

## Overview
This task enhances the SCSS variable resolution system and context analysis capabilities, building upon 
the semantic analysis foundation from Task 3. It focuses on comprehensive variable tracking, dependency resolution, 
and context-aware diff analysis that understands SCSS-specific features like imports, inheritance, and scoping.

## Prerequisites
- Task 1: Core Diff Infrastructure and Type Definitions (completed)
- Task 2: Text-Level Diff Analyzer (completed)
- Task 3: Semantic CSS Analysis and Property Categorization (completed)

## Dependencies
- Existing typography variable resolver (`src/typography/variable-resolver.ts`)
- SCSS discovery engine (`src/scss-discovery.ts`)
- File system operations via `fs-extra`

## Task Breakdown

### 4.1 Enhanced Variable Resolution System (`src/diff/enhanced-variable-resolver.ts`)

Create an advanced variable resolution system that extends the existing typography resolver:

```typescript
import { VariableResolver as BaseVariableResolver } from '../typography/variable-resolver';
import { 
  VariableDefinition, 
  VariableScope, 
  VariableResolutionContext,
  VariableDependencyGraph,
  CircularDependencyError
} from './types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class EnhancedVariableResolver extends BaseVariableResolver {
  private readonly globalVariables: Map<string, VariableDefinition>;
  private readonly fileVariables: Map<string, Map<string, VariableDefinition>>;
  private readonly importGraph: Map<string, string[]>;
  private readonly dependencyGraph: VariableDependencyGraph;
  private readonly resolutionCache: Map<string, any>;

  constructor() {
    super();
    this.globalVariables = new Map();
    this.fileVariables = new Map();
    this.importGraph = new Map();
    this.dependencyGraph = new Map();
    this.resolutionCache = new Map();
  }

  /**
   * Initialize variable resolver with all SCSS files from a directory
   */
  public async initializeFromDirectory(
    directoryPath: string,
    scssFiles: string[]
  ): Promise<void> {
    // Clear existing state
    this.clearCache();

    // Process all SCSS files to build variable maps
    const processingPromises = scssFiles.map(filePath => 
      this.processScssFile(filePath)
    );

    await Promise.all(processingPromises);

    // Build import dependency graph
    await this.buildImportGraph(scssFiles);

    // Resolve variable dependencies
    this.buildVariableDependencyGraph();
  }

  /**
   * Resolve a variable in a specific context with full dependency tracking
   */
  public async resolveVariableInContext(
    variableName: string,
    context: VariableResolutionContext
  ): Promise<{
    value: any;
    source: string;
    dependencies: string[];
    scope: VariableScope;
    resolutionPath: string[];
  }> {
    const cacheKey = this.generateCacheKey(variableName, context);
    
    if (this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey);
    }

    const resolution = await this.performVariableResolution(variableName, context);
    this.resolutionCache.set(cacheKey, resolution);
    
    return resolution;
  }

  /**
   * Find all variables that depend on a given variable
   */
  public findDependentVariables(variableName: string): string[] {
    const dependents: string[] = [];
    
    for (const [variable, dependencies] of this.dependencyGraph) {
      if (dependencies.includes(variableName)) {
        dependents.push(variable);
      }
    }

    return dependents;
  }

  /**
   * Analyze variable changes and their impact
   */
  public analyzeVariableChange(
    variableName: string,
    oldValue: any,
    newValue: any,
    context: VariableResolutionContext
  ): {
    affectedVariables: string[];
    impactLevel: 'low' | 'medium' | 'high';
    cascadeDepth: number;
    recommendations: string[];
  } {
    const dependents = this.findDependentVariables(variableName);
    const cascadeDepth = this.calculateCascadeDepth(variableName);
    
    const impactLevel = this.assessVariableChangeImpact(
      variableName,
      oldValue,
      newValue,
      dependents.length,
      cascadeDepth
    );

    const recommendations = this.generateVariableChangeRecommendations(
      variableName,
      oldValue,
      newValue,
      dependents,
      impactLevel
    );

    return {
      affectedVariables: dependents,
      impactLevel,
      cascadeDepth,
      recommendations
    };
  }

  /**
   * Compare variable maps between two versions
   */
  public compareVariableMaps(
    oldVariables: Map<string, VariableDefinition>,
    newVariables: Map<string, VariableDefinition>
  ): {
    added: VariableDefinition[];
    removed: VariableDefinition[];
    modified: Array<{
      variable: VariableDefinition;
      oldValue: any;
      newValue: any;
      impact: 'low' | 'medium' | 'high';
    }>;
    unchanged: VariableDefinition[];
  } {
    const added: VariableDefinition[] = [];
    const removed: VariableDefinition[] = [];
    const modified: Array<{
      variable: VariableDefinition;
      oldValue: any;
      newValue: any;
      impact: 'low' | 'medium' | 'high';
    }> = [];
    const unchanged: VariableDefinition[] = [];

    // Find added variables
    for (const [name, definition] of newVariables) {
      if (!oldVariables.has(name)) {
        added.push(definition);
      }
    }

    // Find removed and modified variables
    for (const [name, oldDefinition] of oldVariables) {
      const newDefinition = newVariables.get(name);
      
      if (!newDefinition) {
        removed.push(oldDefinition);
      } else if (oldDefinition.value !== newDefinition.value) {
        const impact = this.assessVariableChangeImpact(
          name,
          oldDefinition.value,
          newDefinition.value,
          this.findDependentVariables(name).length,
          this.calculateCascadeDepth(name)
        );

        modified.push({
          variable: newDefinition,
          oldValue: oldDefinition.value,
          newValue: newDefinition.value,
          impact
        });
      } else {
        unchanged.push(newDefinition);
      }
    }

    return { added, removed, modified, unchanged };
  }

  private async processScssFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const variables = this.extractVariablesFromContent(content, filePath);
      const imports = this.extractImportsFromContent(content, filePath);

      // Store file-level variables
      this.fileVariables.set(filePath, new Map(
        variables.map(v => [v.name, v])
      ));

      // Store global variables (from files that look like variable definitions)
      if (this.isGlobalVariableFile(filePath)) {
        variables.forEach(variable => {
          this.globalVariables.set(variable.name, variable);
        });
      }

      // Store import relationships
      this.importGraph.set(filePath, imports);

    } catch (error) {
      console.warn(`Failed to process SCSS file ${filePath}:`, error);
    }
  }

  private extractVariablesFromContent(content: string, filePath: string): VariableDefinition[] {
    const variables: VariableDefinition[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const variableMatch = line.match(/\$([a-zA-Z0-9_-]+)\s*:\s*([^;!]+)(?:\s*!([^;]+))?;/);
      
      if (variableMatch) {
        const [, name, value, flags] = variableMatch;
        const isDefault = flags && flags.includes('default');
        const isGlobal = flags && flags.includes('global');

        variables.push({
          name,
          value: value.trim(),
          filePath,
          lineNumber: index + 1,
          scope: this.determineVariableScope(filePath, isGlobal),
          isDefault,
          isGlobal,
          dependencies: this.extractVariableDependencies(value.trim())
        });
      }
    });

    return variables;
  }

  private extractImportsFromContent(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const importRegex = /@import\s+['"]([^'"]+)['"];?/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolvedPath = this.resolveImportPath(importPath, filePath);
      imports.push(resolvedPath);
    }

    return imports;
  }

  private extractVariableDependencies(value: string): string[] {
    const dependencies: string[] = [];
    const variableRegex = /\$([a-zA-Z0-9_-]+)/g;
    let match;

    while ((match = variableRegex.exec(value)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  private async buildImportGraph(scssFiles: string[]): Promise<void> {
    // The import graph is already built in processScssFile
    // This method can be used for validation or additional processing
    
    // Validate import paths exist
    for (const [filePath, imports] of this.importGraph) {
      for (const importPath of imports) {
        if (!scssFiles.includes(importPath) && !await fs.pathExists(importPath)) {
          console.warn(`Import not found: ${importPath} in ${filePath}`);
        }
      }
    }
  }

  private buildVariableDependencyGraph(): void {
    this.dependencyGraph.clear();

    // Build dependencies from all variables
    for (const variableMap of this.fileVariables.values()) {
      for (const [name, definition] of variableMap) {
        this.dependencyGraph.set(name, definition.dependencies);
      }
    }

    // Add global variable dependencies
    for (const [name, definition] of this.globalVariables) {
      this.dependencyGraph.set(name, definition.dependencies);
    }

    // Detect circular dependencies
    this.detectCircularDependencies();
  }

  private async performVariableResolution(
    variableName: string,
    context: VariableResolutionContext
  ): Promise<{
    value: any;
    source: string;
    dependencies: string[];
    scope: VariableScope;
    resolutionPath: string[];
  }> {
    const resolutionPath: string[] = [variableName];
    
    // Check for circular dependencies
    if (resolutionPath.includes(variableName, 1)) {
      throw new CircularDependencyError(
        `Circular dependency detected in variable resolution: ${resolutionPath.join(' -> ')}`
      );
    }

    // Try to resolve from file context first
    let variable = this.findVariableInFile(variableName, context.filePath);
    
    // Try imported files
    if (!variable) {
      variable = await this.findVariableInImports(variableName, context.filePath);
    }

    // Try global variables
    if (!variable) {
      variable = this.globalVariables.get(variableName);
    }

    if (!variable) {
      throw new Error(`Variable $${variableName} not found in context`);
    }

    // Resolve dependencies recursively
    const resolvedValue = await this.resolveVariableValue(
      variable.value,
      { ...context, filePath: variable.filePath },
      resolutionPath
    );

    return {
      value: resolvedValue,
      source: variable.filePath,
      dependencies: variable.dependencies,
      scope: variable.scope,
      resolutionPath
    };
  }

  private async resolveVariableValue(
    value: string,
    context: VariableResolutionContext,
    resolutionPath: string[]
  ): Promise<any> {
    // Check if value contains variables
    const variableRegex = /\$([a-zA-Z0-9_-]+)/g;
    let resolvedValue = value;
    let match;

    while ((match = variableRegex.exec(value)) !== null) {
      const depVariableName = match[1];
      
      if (resolutionPath.includes(depVariableName)) {
        throw new CircularDependencyError(
          `Circular dependency: ${resolutionPath.join(' -> ')} -> ${depVariableName}`
        );
      }

      const depResolution = await this.performVariableResolution(
        depVariableName,
        context
      );

      resolvedValue = resolvedValue.replace(match[0], depResolution.value);
    }

    // Evaluate SCSS functions if present
    resolvedValue = this.evaluateScssExpression(resolvedValue);

    return resolvedValue;
  }

  private findVariableInFile(variableName: string, filePath: string): VariableDefinition | undefined {
    const fileVariables = this.fileVariables.get(filePath);
    return fileVariables?.get(variableName);
  }

  private async findVariableInImports(
    variableName: string,
    filePath: string
  ): Promise<VariableDefinition | undefined> {
    const imports = this.importGraph.get(filePath) || [];
    
    for (const importPath of imports) {
      const variable = this.findVariableInFile(variableName, importPath);
      if (variable) {
        return variable;
      }
    }

    return undefined;
  }

  private determineVariableScope(filePath: string, isGlobal: boolean): VariableScope {
    if (isGlobal) return 'global';
    if (this.isGlobalVariableFile(filePath)) return 'global';
    if (this.isComponentFile(filePath)) return 'component';
    return 'file';
  }

  private isGlobalVariableFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return fileName.includes('variable') || 
           fileName.includes('global') || 
           fileName.startsWith('_') && (fileName.includes('var') || fileName.includes('config'));
  }

  private isComponentFile(filePath: string): boolean {
    return filePath.includes('.component.scss');
  }

  private resolveImportPath(importPath: string, currentFilePath: string): string {
    const currentDir = path.dirname(currentFilePath);
    
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return path.resolve(currentDir, importPath);
    }

    // Handle absolute imports from src
    if (importPath.startsWith('~')) {
      return path.resolve(process.cwd(), 'src', importPath.substring(1));
    }

    // Handle node_modules imports
    if (!importPath.startsWith('.')) {
      return importPath; // Keep as-is for node_modules resolution
    }

    return path.resolve(currentDir, importPath);
  }

  private calculateCascadeDepth(variableName: string): number {
    const visited = new Set<string>();
    
    const calculateDepth = (varName: string): number => {
      if (visited.has(varName)) return 0;
      visited.add(varName);
      
      const dependents = this.findDependentVariables(varName);
      if (dependents.length === 0) return 1;
      
      return 1 + Math.max(...dependents.map(dep => calculateDepth(dep)));
    };

    return calculateDepth(variableName);
  }

  private assessVariableChangeImpact(
    variableName: string,
    oldValue: any,
    newValue: any,
    dependentCount: number,
    cascadeDepth: number
  ): 'low' | 'medium' | 'high' {
    // High impact if many dependents or deep cascade
    if (dependentCount > 10 || cascadeDepth > 3) {
      return 'high';
    }

    // Check semantic change significance
    if (this.isSignificantValueChange(variableName, oldValue, newValue)) {
      return dependentCount > 5 ? 'high' : 'medium';
    }

    // Medium impact for moderate usage
    if (dependentCount > 3 || cascadeDepth > 1) {
      return 'medium';
    }

    return 'low';
  }

  private isSignificantValueChange(variableName: string, oldValue: any, newValue: any): boolean {
    // Color changes are usually significant
    if (this.isColorVariable(variableName)) {
      return oldValue !== newValue;
    }

    // Size changes above threshold
    if (this.isSizeVariable(variableName)) {
      return this.isSizeChangeSignificant(oldValue, newValue);
    }

    // Typography changes
    if (this.isTypographyVariable(variableName)) {
      return oldValue !== newValue;
    }

    return false;
  }

  private isColorVariable(variableName: string): boolean {
    return variableName.toLowerCase().includes('color') ||
           variableName.toLowerCase().includes('bg') ||
           variableName.toLowerCase().includes('background');
  }

  private isSizeVariable(variableName: string): boolean {
    return variableName.toLowerCase().includes('size') ||
           variableName.toLowerCase().includes('width') ||
           variableName.toLowerCase().includes('height') ||
           variableName.toLowerCase().includes('margin') ||
           variableName.toLowerCase().includes('padding');
  }

  private isTypographyVariable(variableName: string): boolean {
    return variableName.toLowerCase().includes('font') ||
           variableName.toLowerCase().includes('text') ||
           variableName.toLowerCase().includes('line');
  }

  private isSizeChangeSignificant(oldValue: string, newValue: string): boolean {
    const oldSize = this.extractNumericValue(oldValue);
    const newSize = this.extractNumericValue(newValue);

    if (oldSize && newSize) {
      const changePercentage = Math.abs((newSize - oldSize) / oldSize) * 100;
      return changePercentage > 15; // More than 15% change
    }

    return true;
  }

  private extractNumericValue(value: string): number | null {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  private generateVariableChangeRecommendations(
    variableName: string,
    oldValue: any,
    newValue: any,
    dependents: string[],
    impact: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations: string[] = [];

    if (impact === 'high') {
      recommendations.push('High-impact change: Consider regression testing affected components');
      
      if (dependents.length > 0) {
        recommendations.push(`Review ${dependents.length} dependent variables: ${dependents.slice(0, 3).join(', ')}${dependents.length > 3 ? '...' : ''}`);
      }
    }

    if (this.isColorVariable(variableName)) {
      recommendations.push('Color change: Verify accessibility and contrast ratios');
    }

    if (this.isTypographyVariable(variableName)) {
      recommendations.push('Typography change: Check readability and responsive behavior');
    }

    if (this.isSizeVariable(variableName)) {
      recommendations.push('Size change: Verify layout consistency across breakpoints');
    }

    return recommendations;
  }

  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (variable: string, path: string[]): void => {
      if (recursionStack.has(variable)) {
        throw new CircularDependencyError(
          `Circular dependency detected: ${path.join(' -> ')} -> ${variable}`
        );
      }

      if (visited.has(variable)) return;

      visited.add(variable);
      recursionStack.add(variable);

      const dependencies = this.dependencyGraph.get(variable) || [];
      for (const dependency of dependencies) {
        detectCycle(dependency, [...path, variable]);
      }

      recursionStack.delete(variable);
    };

    for (const variable of this.dependencyGraph.keys()) {
      if (!visited.has(variable)) {
        detectCycle(variable, []);
      }
    }
  }

  private evaluateScssExpression(expression: string): string {
    // Simple SCSS function evaluation
    // This is a simplified version - real implementation would need a full SCSS evaluator
    
    // Handle color functions
    expression = expression.replace(/darken\(([^,]+),\s*(\d+%?)\)/g, (match, color, amount) => {
      // Simplified darken function
      return `darken(${color}, ${amount})`;
    });

    expression = expression.replace(/lighten\(([^,]+),\s*(\d+%?)\)/g, (match, color, amount) => {
      // Simplified lighten function
      return `lighten(${color}, ${amount})`;
    });

    // Handle math expressions
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/g, (match, a, b) => {
      return (parseFloat(a) + parseFloat(b)).toString();
    });

    expression = expression.replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g, (match, a, b) => {
      return (parseFloat(a) - parseFloat(b)).toString();
    });

    return expression;
  }

  private generateCacheKey(variableName: string, context: VariableResolutionContext): string {
    return `${variableName}:${context.filePath}:${context.selector || ''}:${context.mediaQuery || ''}`;
  }

  private clearCache(): void {
    this.globalVariables.clear();
    this.fileVariables.clear();
    this.importGraph.clear();
    this.dependencyGraph.clear();
    this.resolutionCache.clear();
  }
}
```

### 4.2 Context-Aware Diff Analyzer (`src/diff/context-aware-diff-analyzer.ts`)

Create a diff analyzer that understands SCSS context and variable relationships:

```typescript
import { DiffAnalyzer } from './diff-analyzer';
import { EnhancedVariableResolver } from './enhanced-variable-resolver';
import { 
  ContextualDiffResult,
  VariableImpactAnalysis,
  SelectorContextChange,
  ImportDependencyChange
} from './types';

export class ContextAwareDiffAnalyzer extends DiffAnalyzer {
  private variableResolver: EnhancedVariableResolver;
  private oldVariableMap: Map<string, any>;
  private newVariableMap: Map<string, any>;

  constructor() {
    super();
    this.variableResolver = new EnhancedVariableResolver();
    this.oldVariableMap = new Map();
    this.newVariableMap = new Map();
  }

  /**
   * Perform context-aware diff analysis with variable resolution
   */
  public async analyzeWithContext(
    oldContent: string,
    newContent: string,
    filePath: string,
    oldScssFiles: string[],
    newScssFiles: string[]
  ): Promise<ContextualDiffResult> {
    // Initialize variable resolution for both versions
    await this.initializeVariableResolution(oldScssFiles, newScssFiles);

    // Perform basic diff analysis
    const basicDiff = await this.analyzeContent(oldContent, newContent, filePath);

    // Add contextual analysis
    const variableImpact = await this.analyzeVariableImpact(oldContent, newContent, filePath);
    const selectorChanges = this.analyzeSelectorChanges(oldContent, newContent);
    const importChanges = this.analyzeImportChanges(oldContent, newContent);

    // Enhance diff chunks with variable context
    const enhancedChunks = await this.enhanceChunksWithVariableContext(
      basicDiff,
      oldContent,
      newContent,
      filePath
    );

    return {
      filePath,
      chunks: enhancedChunks,
      variableImpact,
      selectorChanges,
      importChanges,
      summary: this.generateContextualSummary(enhancedChunks, variableImpact, selectorChanges, importChanges)
    };
  }

  /**
   * Analyze the impact of variable changes
   */
  private async analyzeVariableImpact(
    oldContent: string,
    newContent: string,
    filePath: string
  ): Promise<VariableImpactAnalysis> {
    const oldVariables = this.extractVariables(oldContent, filePath);
    const newVariables = this.extractVariables(newContent, filePath);

    const comparison = this.variableResolver.compareVariableMaps(
      new Map(oldVariables.map(v => [v.name, v])),
      new Map(newVariables.map(v => [v.name, v]))
    );

    const impactAnalysis: VariableImpactAnalysis = {
      addedVariables: comparison.added,
      removedVariables: comparison.removed,
      modifiedVariables: comparison.modified,
      affectedComponents: [],
      cascadeEffects: [],
      recommendations: []
    };

    // Analyze cascade effects for modified variables
    for (const modified of comparison.modified) {
      const cascadeAnalysis = this.variableResolver.analyzeVariableChange(
        modified.variable.name,
        modified.oldValue,
        modified.newValue,
        { filePath, selector: null, mediaQuery: null }
      );

      impactAnalysis.cascadeEffects.push({
        variableName: modified.variable.name,
        affectedVariables: cascadeAnalysis.affectedVariables,
        cascadeDepth: cascadeAnalysis.cascadeDepth,
        impactLevel: cascadeAnalysis.impactLevel
      });

      impactAnalysis.recommendations.push(...cascadeAnalysis.recommendations);
    }

    // Find affected components
    impactAnalysis.affectedComponents = await this.findAffectedComponents(
      [...comparison.modified.map(m => m.variable.name), ...comparison.removed.map(r => r.name)],
      filePath
    );

    return impactAnalysis;
  }

  /**
   * Analyze selector context changes
   */
  private analyzeSelectorChanges(oldContent: string, newContent: string): SelectorContextChange[] {
    const oldSelectors = this.extractSelectors(oldContent);
    const newSelectors = this.extractSelectors(newContent);

    const changes: SelectorContextChange[] = [];

    // Find modified selectors
    const selectorMap = new Map<string, { old?: string; new?: string; line: number }>();

    oldSelectors.forEach(selector => {
      selectorMap.set(selector.normalized, { old: selector.original, line: selector.line });
    });

    newSelectors.forEach(selector => {
      const existing = selectorMap.get(selector.normalized);
      if (existing) {
        existing.new = selector.original;
      } else {
        selectorMap.set(selector.normalized, { new: selector.original, line: selector.line });
      }
    });

    for (const [normalized, { old, new: newSelector, line }] of selectorMap) {
      if (old && newSelector && old !== newSelector) {
        changes.push({
          type: 'modified',
          oldSelector: old,
          newSelector,
          line,
          impact: this.assessSelectorChangeImpact(old, newSelector),
          reasoning: this.generateSelectorChangeReasoning(old, newSelector)
        });
      } else if (old && !newSelector) {
        changes.push({
          type: 'removed',
          oldSelector: old,
          line,
          impact: 'medium',
          reasoning: 'Selector removed - may affect styling'
        });
      } else if (!old && newSelector) {
        changes.push({
          type: 'added',
          newSelector,
          line,
          impact: 'low',
          reasoning: 'New selector added'
        });
      }
    }

    return changes;
  }

  /**
   * Analyze import dependency changes
   */
  private analyzeImportChanges(oldContent: string, newContent: string): ImportDependencyChange[] {
    const oldImports = this.extractImports(oldContent);
    const newImports = this.extractImports(newContent);

    const changes: ImportDependencyChange[] = [];

    // Find added imports
    for (const newImport of newImports) {
      if (!oldImports.some(imp => imp.path === newImport.path)) {
        changes.push({
          type: 'added',
          importPath: newImport.path,
          line: newImport.line,
          impact: 'medium',
          reasoning: 'New dependency added - may introduce new variables or styles'
        });
      }
    }

    // Find removed imports
    for (const oldImport of oldImports) {
      if (!newImports.some(imp => imp.path === oldImport.path)) {
        changes.push({
          type: 'removed',
          importPath: oldImport.path,
          line: oldImport.line,
          impact: 'high',
          reasoning: 'Dependency removed - may cause missing variables or styles'
        });
      }
    }

    return changes;
  }

  private async initializeVariableResolution(
    oldScssFiles: string[],
    newScssFiles: string[]
  ): Promise<void> {
    // This would typically involve initializing two separate resolver instances
    // For simplicity, we'll initialize with the new files
    await this.variableResolver.initializeFromDirectory(
      process.cwd(),
      newScssFiles
    );
  }

  private extractVariables(content: string, filePath: string): Array<{
    name: string;
    value: string;
    line: number;
    scope: string;
  }> {
    const variables: Array<{
      name: string;
      value: string;
      line: number;
      scope: string;
    }> = [];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const variableMatch = line.match(/\$([a-zA-Z0-9_-]+)\s*:\s*([^;!]+)(?:\s*!([^;]+))?;/);
      
      if (variableMatch) {
        const [, name, value, flags] = variableMatch;
        variables.push({
          name,
          value: value.trim(),
          line: index + 1,
          scope: flags && flags.includes('global') ? 'global' : 'local'
        });
      }
    });

    return variables;
  }

  private extractSelectors(content: string): Array<{
    original: string;
    normalized: string;
    line: number;
  }> {
    const selectors: Array<{
      original: string;
      normalized: string;
      line: number;
    }> = [];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const selectorMatch = line.match(/([^{]+)\s*\{/);
      
      if (selectorMatch) {
        const original = selectorMatch[1].trim();
        const normalized = this.normalizeSelector(original);
        
        selectors.push({
          original,
          normalized,
          line: index + 1
        });
      }
    });

    return selectors;
  }

  private extractImports(content: string): Array<{
    path: string;
    line: number;
  }> {
    const imports: Array<{
      path: string;
      line: number;
    }> = [];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const importMatch = line.match(/@import\s+['"]([^'"]+)['"];?/);
      
      if (importMatch) {
        imports.push({
          path: importMatch[1],
          line: index + 1
        });
      }
    });

    return imports;
  }

  private normalizeSelector(selector: string): string {
    // Remove extra whitespace and normalize selector format
    return selector
      .replace(/\s+/g, ' ')
      .replace(/\s*([>+~])\s*/g, '$1')
      .trim()
      .toLowerCase();
  }

  private assessSelectorChangeImpact(oldSelector: string, newSelector: string): 'low' | 'medium' | 'high' {
    // Assess the impact of selector changes
    
    // Class to ID changes are high impact
    if (oldSelector.startsWith('.') && newSelector.startsWith('#')) {
      return 'high';
    }

    // Element to class changes are medium impact
    if (!/[.#]/.test(oldSelector) && newSelector.startsWith('.')) {
      return 'medium';
    }

    // Pseudo-selector changes are usually low impact
    if (oldSelector.includes(':') || newSelector.includes(':')) {
      return 'low';
    }

    return 'medium';
  }

  private generateSelectorChangeReasoning(oldSelector: string, newSelector: string): string {
    const reasons: string[] = [];

    if (oldSelector.startsWith('.') && newSelector.startsWith('#')) {
      reasons.push('Changed from class to ID selector - increases specificity');
    } else if (oldSelector.startsWith('#') && newSelector.startsWith('.')) {
      reasons.push('Changed from ID to class selector - decreases specificity');
    }

    if (oldSelector.includes(' ') !== newSelector.includes(' ')) {
      reasons.push('Changed descendant selector structure');
    }

    if (oldSelector.includes(':') !== newSelector.includes(':')) {
      reasons.push('Changed pseudo-selector usage');
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Selector structure modified';
  }

  private async enhanceChunksWithVariableContext(
    chunks: any[],
    oldContent: string,
    newContent: string,
    filePath: string
  ): Promise<any[]> {
    // Enhance each chunk with variable resolution context
    const enhancedChunks = [...chunks];

    for (const chunk of enhancedChunks) {
      for (const change of chunk.changes) {
        if (change.cssProperties) {
          // Resolve variables in CSS property values
          for (const property of change.cssProperties) {
            if (property.oldValue && property.oldValue.includes('$')) {
              property.resolvedOldValue = await this.resolveVariableInValue(
                property.oldValue,
                filePath
              );
            }
            
            if (property.newValue && property.newValue.includes('$')) {
              property.resolvedNewValue = await this.resolveVariableInValue(
                property.newValue,
                filePath
              );
            }
          }
        }
      }
    }

    return enhancedChunks;
  }

  private async resolveVariableInValue(value: string, filePath: string): Promise<string> {
    try {
      const context = { filePath, selector: null, mediaQuery: null };
      const variableRegex = /\$([a-zA-Z0-9_-]+)/g;
      let resolvedValue = value;
      let match;

      while ((match = variableRegex.exec(value)) !== null) {
        const variableName = match[1];
        
        try {
          const resolution = await this.variableResolver.resolveVariableInContext(
            variableName,
            context
          );
          resolvedValue = resolvedValue.replace(match[0], resolution.value);
        } catch (error) {
          // Keep original variable if resolution fails
        }
      }

      return resolvedValue;
    } catch (error) {
      return value; // Return original value if resolution fails
    }
  }

  private async findAffectedComponents(
    variableNames: string[],
    filePath: string
  ): Promise<string[]> {
    // Find components that use the changed variables
    const affectedComponents: string[] = [];

    for (const variableName of variableNames) {
      const dependents = this.variableResolver.findDependentVariables(variableName);
      
      // This would need integration with the SCSS discovery system
      // to find actual component files that use these variables
      affectedComponents.push(...dependents);
    }

    return [...new Set(affectedComponents)]; // Remove duplicates
  }

  private generateContextualSummary(
    chunks: any[],
    variableImpact: VariableImpactAnalysis,
    selectorChanges: SelectorContextChange[],
    importChanges: ImportDependencyChange[]
  ): string {
    const summaryParts: string[] = [];

    // Basic change summary
    const totalChanges = chunks.reduce((sum, chunk) => sum + chunk.changes.length, 0);
    summaryParts.push(`${totalChanges} total changes`);

    // Variable impact summary
    if (variableImpact.modifiedVariables.length > 0) {
      const highImpactVars = variableImpact.modifiedVariables.filter(v => v.impact === 'high').length;
      summaryParts.push(`${variableImpact.modifiedVariables.length} variable changes (${highImpactVars} high-impact)`);
    }

    // Selector changes summary
    if (selectorChanges.length > 0) {
      summaryParts.push(`${selectorChanges.length} selector changes`);
    }

    // Import changes summary
    if (importChanges.length > 0) {
      const added = importChanges.filter(c => c.type === 'added').length;
      const removed = importChanges.filter(c => c.type === 'removed').length;
      summaryParts.push(`${importChanges.length} import changes (+${added}, -${removed})`);
    }

    return summaryParts.join(', ');
  }
}
```

### 4.3 Enhanced Type Definitions (`src/diff/types.ts` - additions)

Add the following types to support variable resolution and context analysis:

```typescript
// Add to existing types.ts file

export interface VariableDefinition {
  name: string;
  value: string;
  filePath: string;
  lineNumber: number;
  scope: VariableScope;
  isDefault: boolean;
  isGlobal: boolean;
  dependencies: string[];
}

export type VariableScope = 'global' | 'file' | 'component' | 'local';

export interface VariableResolutionContext {
  filePath: string;
  selector: string | null;
  mediaQuery: string | null;
}

export type VariableDependencyGraph = Map<string, string[]>;

export interface ContextualDiffResult {
  filePath: string;
  chunks: DiffChunk[];
  variableImpact: VariableImpactAnalysis;
  selectorChanges: SelectorContextChange[];
  importChanges: ImportDependencyChange[];
  summary: string;
}

export interface VariableImpactAnalysis {
  addedVariables: VariableDefinition[];
  removedVariables: VariableDefinition[];
  modifiedVariables: Array<{
    variable: VariableDefinition;
    oldValue: any;
    newValue: any;
    impact: 'low' | 'medium' | 'high';
  }>;
  affectedComponents: string[];
  cascadeEffects: Array<{
    variableName: string;
    affectedVariables: string[];
    cascadeDepth: number;
    impactLevel: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
}

export interface SelectorContextChange {
  type: 'added' | 'removed' | 'modified';
  oldSelector?: string;
  newSelector?: string;
  line: number;
  impact: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface ImportDependencyChange {
  type: 'added' | 'removed';
  importPath: string;
  line: number;
  impact: 'low' | 'medium' | 'high';
  reasoning: string;
}

export class CircularDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularDependencyError';
  }
}

// Extend existing interfaces
export interface DiffChange {
  // ...existing properties...
  resolvedOldValue?: string; // New field for resolved variable values
  resolvedNewValue?: string; // New field for resolved variable values
  variableResolutions?: Array<{
    variableName: string;
    originalValue: string;
    resolvedValue: string;
  }>; // New field
}
```

## Testing Requirements

### 4.4 Test File: `src/diff/__tests__/enhanced-variable-resolver.test.ts`

```typescript
import { EnhancedVariableResolver } from '../enhanced-variable-resolver';
import { VariableDefinition, CircularDependencyError } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('fs-extra');

describe('EnhancedVariableResolver', () => {
  let resolver: EnhancedVariableResolver;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    resolver = new EnhancedVariableResolver();
    jest.clearAllMocks();
  });

  describe('initializeFromDirectory', () => {
    it('should process SCSS files and build variable maps', async () => {
      const scssContent = `
        $primary-color: #007bff;
        $secondary-color: darken($primary-color, 10%);
        
        @import './variables';
        
        .button {
          color: $primary-color;
        }
      `;

      mockFs.readFile.mockResolvedValue(scssContent);
      mockFs.pathExists.mockResolvedValue(true);

      await resolver.initializeFromDirectory('/test', ['test.scss']);

      expect(mockFs.readFile).toHaveBeenCalledWith('test.scss', 'utf-8');
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        resolver.initializeFromDirectory('/test', ['missing.scss'])
      ).resolves.not.toThrow();
    });
  });

  describe('resolveVariableInContext', () => {
    beforeEach(async () => {
      const variablesContent = `
        $base-color: #000;
        $primary-color: $base-color;
      `;

      mockFs.readFile.mockResolvedValue(variablesContent);
      mockFs.pathExists.mockResolvedValue(true);

      await resolver.initializeFromDirectory('/test', ['variables.scss']);
    });

    it('should resolve variable dependencies', async () => {
      const context = { filePath: 'variables.scss', selector: null, mediaQuery: null };
      
      const resolution = await resolver.resolveVariableInContext('primary-color', context);
      
      expect(resolution.value).toBe('#000');
      expect(resolution.dependencies).toContain('base-color');
    });

    it('should detect circular dependencies', async () => {
      const circularContent = `
        $var-a: $var-b;
        $var-b: $var-a;
      `;

      mockFs.readFile.mockResolvedValue(circularContent);
      
      await resolver.initializeFromDirectory('/test', ['circular.scss']);
      
      const context = { filePath: 'circular.scss', selector: null, mediaQuery: null };
      
      await expect(
        resolver.resolveVariableInContext('var-a', context)
      ).rejects.toThrow(CircularDependencyError);
    });
  });

  describe('analyzeVariableChange', () => {
    it('should assess impact based on dependents and cascade depth', () => {
      // This test would require mocking the dependency graph
      const analysis = resolver.analyzeVariableChange(
        'primary-color',
        '#007bff',
        '#dc3545',
        { filePath: 'test.scss', selector: null, mediaQuery: null }
      );

      expect(analysis.impactLevel).toBeOneOf(['low', 'medium', 'high']);
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it('should provide color-specific recommendations for color variables', () => {
      const analysis = resolver.analyzeVariableChange(
        'background-color',
        '#ffffff',
        '#000000',
        { filePath: 'test.scss', selector: null, mediaQuery: null }
      );

      expect(analysis.recommendations.some(r => 
        r.includes('accessibility') || r.includes('contrast')
      )).toBe(true);
    });
  });

  describe('compareVariableMaps', () => {
    it('should identify added, removed, and modified variables', () => {
      const oldVariables = new Map<string, VariableDefinition>([
        ['color1', { name: 'color1', value: 'red', filePath: 'test.scss', lineNumber: 1, scope: 'file', isDefault: false, isGlobal: false, dependencies: [] }],
        ['color2', { name: 'color2', value: 'blue', filePath: 'test.scss', lineNumber: 2, scope: 'file', isDefault: false, isGlobal: false, dependencies: [] }]
      ]);

      const newVariables = new Map<string, VariableDefinition>([
        ['color1', { name: 'color1', value: 'green', filePath: 'test.scss', lineNumber: 1, scope: 'file', isDefault: false, isGlobal: false, dependencies: [] }],
        ['color3', { name: 'color3', value: 'yellow', filePath: 'test.scss', lineNumber: 3, scope: 'file', isDefault: false, isGlobal: false, dependencies: [] }]
      ]);

      const comparison = resolver.compareVariableMaps(oldVariables, newVariables);

      expect(comparison.added).toHaveLength(1);
      expect(comparison.removed).toHaveLength(1);
      expect(comparison.modified).toHaveLength(1);
      expect(comparison.modified[0].variable.name).toBe('color1');
    });
  });
});
```

### 4.5 Test File: `src/diff/__tests__/context-aware-diff-analyzer.test.ts`

```typescript
import { ContextAwareDiffAnalyzer } from '../context-aware-diff-analyzer';

describe('ContextAwareDiffAnalyzer', () => {
  let analyzer: ContextAwareDiffAnalyzer;

  beforeEach(() => {
    analyzer = new ContextAwareDiffAnalyzer();
  });

  describe('analyzeWithContext', () => {
    it('should provide contextual diff analysis', async () => {
      const oldContent = `
        $primary-color: #007bff;
        .button {
          color: $primary-color;
          font-size: 14px;
        }
      `;

      const newContent = `
        $primary-color: #dc3545;
        .button {
          color: $primary-color;
          font-size: 16px;
        }
      `;

      const result = await analyzer.analyzeWithContext(
        oldContent,
        newContent,
        'button.component.scss',
        ['old/variables.scss', 'old/button.component.scss'],
        ['new/variables.scss', 'new/button.component.scss']
      );

      expect(result.filePath).toBe('button.component.scss');
      expect(result.variableImpact.modifiedVariables).toHaveLength(1);
      expect(result.chunks).toBeInstanceOf(Array);
      expect(result.summary).toContain('variable changes');
    });

    it('should detect selector changes', async () => {
      const oldContent = `
        .button {
          padding: 10px;
        }
      `;

      const newContent = `
        #button {
          padding: 10px;
        }
      `;

      const result = await analyzer.analyzeWithContext(
        oldContent,
        newContent,
        'test.scss',
        ['test.scss'],
        ['test.scss']
      );

      expect(result.selectorChanges).toHaveLength(1);
      expect(result.selectorChanges[0].type).toBe('modified');
      expect(result.selectorChanges[0].impact).toBe('high');
    });

    it('should detect import changes', async () => {
      const oldContent = `
        @import './variables';
        @import './mixins';
      `;

      const newContent = `
        @import './variables';
        @import './utilities';
      `;

      const result = await analyzer.analyzeWithContext(
        oldContent,
        newContent,
        'main.scss',
        ['main.scss'],
        ['main.scss']
      );

      expect(result.importChanges).toHaveLength(2); // One removed, one added
      expect(result.importChanges.some(c => c.type === 'added')).toBe(true);
      expect(result.importChanges.some(c => c.type === 'removed')).toBe(true);
    });
  });
});
```

## Integration Points

1. **Typography System Integration**: Extends existing `VariableResolver` from `src/typography/variable-resolver.ts`
2. **SCSS Discovery Integration**: Uses file lists from `src/scss-discovery.ts`
3. **Git Integration**: Works with temporary directories from `src/git-branch-comparer.ts`

## Success Criteria

- [ ] Variable resolution works across file imports and dependencies
- [ ] Circular dependency detection prevents infinite loops
- [ ] Variable change impact analysis provides accurate assessments
- [ ] Context-aware diff analysis includes SCSS-specific insights
- [ ] Selector and import changes are properly tracked
- [ ] Integration with existing typography system is seamless
- [ ] All tests pass with >90% coverage
- [ ] Performance remains acceptable for large codebases

## Next Steps

After completing this task:
- **Task 5**: Diff Formatting (Unified, Split, Summary)
- **Task 6**: Diff Rendering (Terminal, JSON, HTML)
- **Task 7**: Style Diff Engine Orchestrator

This task provides comprehensive SCSS variable resolution and context analysis, enabling the diff engine to understand the semantic relationships between variables and their impact across the codebase.
