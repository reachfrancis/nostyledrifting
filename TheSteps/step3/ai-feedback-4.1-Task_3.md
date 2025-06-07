# Task 3: Semantic CSS Analysis and Property Categorization

## Overview
This task implements semantic CSS analysis capabilities that categorize CSS properties and assess their impact. 
Building on the text-level diff infrastructure from Task 2, this task adds intelligence to understand the meaning 
and significance of CSS changes rather than just textual differences.

## Prerequisites
- Task 1: Core Diff Infrastructure and Type Definitions (completed)
- Task 2: Text-Level Diff Analyzer (completed)

## Dependencies
- Existing typography system (`src/typography/`)
- CSS property knowledge base
- AST parsing capabilities from `src/parser/`

## Task Breakdown

### 3.1 CSS Property Categorizer (`src/diff/css-property-categorizer.ts`)

Create a service that categorizes CSS properties and assesses their impact:

```typescript
import { CssPropertyChange, PropertyCategory, PropertyImpact } from './types';

export class CssPropertyCategorizer {
  private readonly propertyCategories: Map<string, PropertyCategory>;
  private readonly impactRules: Map<string, PropertyImpact>;

  constructor() {
    this.propertyCategories = this.buildPropertyCategories();
    this.impactRules = this.buildImpactRules();
  }

  /**
   * Categorize a CSS property and assess its impact
   */
  public categorizeProperty(property: string, oldValue?: string, newValue?: string): {
    category: PropertyCategory;
    impact: PropertyImpact;
    reasoning: string;
  } {
    const category = this.getPropertyCategory(property);
    const impact = this.assessPropertyImpact(property, oldValue, newValue, category);
    const reasoning = this.generateReasoning(property, category, impact, oldValue, newValue);

    return { category, impact, reasoning };
  }

  /**
   * Analyze multiple property changes and group related ones
   */
  public analyzePropertyChanges(changes: CssPropertyChange[]): {
    categorized: Map<PropertyCategory, CssPropertyChange[]>;
    related: CssPropertyChange[][];
    highImpact: CssPropertyChange[];
  } {
    const categorized = new Map<PropertyCategory, CssPropertyChange[]>();
    const related: CssPropertyChange[][] = [];
    const highImpact: CssPropertyChange[] = [];

    // Categorize changes
    for (const change of changes) {
      const analysis = this.categorizeProperty(change.property, change.oldValue, change.newValue);
      change.category = analysis.category;
      change.impact = analysis.impact;
      change.reasoning = analysis.reasoning;

      // Group by category
      if (!categorized.has(analysis.category)) {
        categorized.set(analysis.category, []);
      }
      categorized.get(analysis.category)!.push(change);

      // Track high impact changes
      if (analysis.impact === 'high') {
        highImpact.push(change);
      }
    }

    // Find related changes
    const relatedGroups = this.findRelatedChanges(changes);
    related.push(...relatedGroups);

    return { categorized, related, highImpact };
  }

  private buildPropertyCategories(): Map<string, PropertyCategory> {
    const categories = new Map<string, PropertyCategory>();

    // Typography properties
    const typographyProps = [
      'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
      'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
      'text-transform', 'text-indent', 'text-overflow', 'white-space'
    ];
    typographyProps.forEach(prop => categories.set(prop, 'typography'));

    // Layout properties
    const layoutProps = [
      'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
      'float', 'clear', 'overflow', 'overflow-x', 'overflow-y',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
      'box-sizing', 'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink',
      'flex-basis', 'justify-content', 'align-items', 'align-content', 'align-self',
      'grid', 'grid-template', 'grid-template-rows', 'grid-template-columns',
      'grid-gap', 'grid-area', 'grid-column', 'grid-row'
    ];
    layoutProps.forEach(prop => categories.set(prop, 'layout'));

    // Color and visual properties
    const colorProps = [
      'color', 'background', 'background-color', 'background-image', 'background-repeat',
      'background-position', 'background-size', 'background-attachment',
      'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
      'border-color', 'border-style', 'border-width', 'border-radius',
      'box-shadow', 'text-shadow', 'opacity', 'visibility'
    ];
    colorProps.forEach(prop => categories.set(prop, 'color'));

    // Animation properties
    const animationProps = [
      'transition', 'transition-property', 'transition-duration', 'transition-timing-function',
      'transition-delay', 'animation', 'animation-name', 'animation-duration',
      'animation-timing-function', 'animation-delay', 'animation-iteration-count',
      'animation-direction', 'animation-fill-mode', 'animation-play-state',
      'transform', 'transform-origin', 'perspective'
    ];
    animationProps.forEach(prop => categories.set(prop, 'animation'));

    return categories;
  }

  private buildImpactRules(): Map<string, PropertyImpact> {
    const rules = new Map<string, PropertyImpact>();

    // High impact properties (affect layout or accessibility)
    const highImpactProps = [
      'display', 'position', 'width', 'height', 'font-size', 'line-height',
      'margin', 'padding', 'flex-direction', 'grid-template', 'color', 'background-color'
    ];
    highImpactProps.forEach(prop => rules.set(prop, 'high'));

    // Medium impact properties (visual changes)
    const mediumImpactProps = [
      'border', 'border-radius', 'box-shadow', 'text-shadow', 'opacity',
      'font-weight', 'text-decoration', 'background-image'
    ];
    mediumImpactProps.forEach(prop => rules.set(prop, 'medium'));

    // Low impact properties (minor adjustments)
    const lowImpactProps = [
      'letter-spacing', 'word-spacing', 'text-transform', 'cursor',
      'transition', 'animation-duration'
    ];
    lowImpactProps.forEach(prop => rules.set(prop, 'low'));

    return rules;
  }

  private getPropertyCategory(property: string): PropertyCategory {
    // Handle shorthand properties
    const normalizedProperty = this.normalizeProperty(property);
    return this.propertyCategories.get(normalizedProperty) || 'other';
  }

  private assessPropertyImpact(
    property: string,
    oldValue?: string,
    newValue?: string,
    category?: PropertyCategory
  ): PropertyImpact {
    // Start with base impact from rules
    let impact = this.impactRules.get(property) || 'medium';

    // Adjust based on value changes
    if (oldValue && newValue) {
      impact = this.adjustImpactByValueChange(property, oldValue, newValue, impact);
    }

    // Adjust based on category
    if (category) {
      impact = this.adjustImpactByCategory(category, impact);
    }

    return impact;
  }

  private adjustImpactByValueChange(
    property: string,
    oldValue: string,
    newValue: string,
    baseImpact: PropertyImpact
  ): PropertyImpact {
    // Check for significant value changes
    if (this.isSignificantChange(property, oldValue, newValue)) {
      return baseImpact === 'low' ? 'medium' : 'high';
    }

    // Check for subtle changes
    if (this.isSubtleChange(property, oldValue, newValue)) {
      return baseImpact === 'high' ? 'medium' : 'low';
    }

    return baseImpact;
  }

  private adjustImpactByCategory(category: PropertyCategory, impact: PropertyImpact): PropertyImpact {
    // Typography changes in components might have higher impact
    if (category === 'typography' && impact === 'medium') {
      return 'high';
    }

    // Animation changes are usually lower impact
    if (category === 'animation' && impact === 'high') {
      return 'medium';
    }

    return impact;
  }

  private isSignificantChange(property: string, oldValue: string, newValue: string): boolean {
    // Define significant changes based on property type
    if (property.includes('font-size')) {
      return this.isFontSizeSignificantChange(oldValue, newValue);
    }

    if (property.includes('margin') || property.includes('padding')) {
      return this.isSpacingSignificantChange(oldValue, newValue);
    }

    if (property === 'display') {
      return oldValue !== newValue; // Any display change is significant
    }

    return false;
  }

  private isSubtleChange(property: string, oldValue: string, newValue: string): boolean {
    // Define subtle changes (minor adjustments)
    if (property.includes('letter-spacing') || property.includes('word-spacing')) {
      return true; // Usually minor visual adjustments
    }

    if (property.includes('transition-duration')) {
      return this.isAnimationDurationSubtle(oldValue, newValue);
    }

    return false;
  }

  private isFontSizeSignificantChange(oldValue: string, newValue: string): boolean {
    const oldSize = this.extractNumericValue(oldValue);
    const newSize = this.extractNumericValue(newValue);

    if (oldSize && newSize) {
      const changePercentage = Math.abs((newSize - oldSize) / oldSize) * 100;
      return changePercentage > 20; // More than 20% change
    }

    return true; // If we can't parse, assume significant
  }

  private isSpacingSignificantChange(oldValue: string, newValue: string): boolean {
    const oldSpacing = this.extractNumericValue(oldValue);
    const newSpacing = this.extractNumericValue(newValue);

    if (oldSpacing && newSpacing) {
      const difference = Math.abs(newSpacing - oldSpacing);
      return difference > 8; // More than 8px difference
    }

    return true;
  }

  private isAnimationDurationSubtle(oldValue: string, newValue: string): boolean {
    const oldDuration = this.extractNumericValue(oldValue);
    const newDuration = this.extractNumericValue(newValue);

    if (oldDuration && newDuration) {
      const difference = Math.abs(newDuration - oldDuration);
      return difference < 0.2; // Less than 200ms difference
    }

    return false;
  }

  private extractNumericValue(value: string): number | null {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  private normalizeProperty(property: string): string {
    // Handle vendor prefixes
    return property.replace(/^(-webkit-|-moz-|-ms-|-o-)/, '');
  }

  private findRelatedChanges(changes: CssPropertyChange[]): CssPropertyChange[][] {
    const related: CssPropertyChange[][] = [];
    const processed = new Set<CssPropertyChange>();

    for (const change of changes) {
      if (processed.has(change)) continue;

      const relatedGroup = [change];
      processed.add(change);

      // Find related properties
      for (const otherChange of changes) {
        if (processed.has(otherChange)) continue;

        if (this.arePropertiesRelated(change.property, otherChange.property)) {
          relatedGroup.push(otherChange);
          processed.add(otherChange);
        }
      }

      if (relatedGroup.length > 1) {
        related.push(relatedGroup);
      }
    }

    return related;
  }

  private arePropertiesRelated(prop1: string, prop2: string): boolean {
    // Define property relationships
    const relatedGroups = [
      ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
      ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      ['border', 'border-top', 'border-right', 'border-bottom', 'border-left'],
      ['font-family', 'font-size', 'font-weight', 'line-height'],
      ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'],
      ['flex-direction', 'justify-content', 'align-items', 'flex-wrap'],
      ['background-color', 'background-image', 'background-position', 'background-size']
    ];

    return relatedGroups.some(group => 
      group.includes(prop1) && group.includes(prop2)
    );
  }

  private generateReasoning(
    property: string,
    category: PropertyCategory,
    impact: PropertyImpact,
    oldValue?: string,
    newValue?: string
  ): string {
    const reasons: string[] = [];

    // Category-based reasoning
    switch (category) {
      case 'typography':
        reasons.push('Typography change affects text readability');
        break;
      case 'layout':
        reasons.push('Layout change affects element positioning');
        break;
      case 'color':
        reasons.push('Visual change affects appearance');
        break;
      case 'animation':
        reasons.push('Animation change affects user interactions');
        break;
    }

    // Impact-based reasoning
    switch (impact) {
      case 'high':
        reasons.push('High impact on user experience');
        break;
      case 'medium':
        reasons.push('Moderate visual impact');
        break;
      case 'low':
        reasons.push('Minor adjustment');
        break;
    }

    // Value-specific reasoning
    if (oldValue && newValue) {
      if (property === 'display') {
        reasons.push(`Display change from '${oldValue}' to '${newValue}' affects layout structure`);
      } else if (property.includes('font-size')) {
        reasons.push(`Font size change affects text hierarchy`);
      }
    }

    return reasons.join('; ');
  }
}
```

### 3.2 SCSS Context Analyzer (`src/diff/scss-context-analyzer.ts`)

Create a service that analyzes SCSS-specific context like variables, mixins, and nesting:

```typescript
import { ScssContext, VariableResolution, MixinUsage } from './types';
import { VariableResolver } from '../typography/variable-resolver';

export class ScssContextAnalyzer {
  private variableResolver: VariableResolver;
  private readonly mixinPatterns: RegExp[];
  private readonly variablePatterns: RegExp[];

  constructor() {
    this.variableResolver = new VariableResolver();
    this.mixinPatterns = [
      /@include\s+([a-zA-Z0-9_-]+)/g,
      /@mixin\s+([a-zA-Z0-9_-]+)/g
    ];
    this.variablePatterns = [
      /\$([a-zA-Z0-9_-]+)\s*:/g,
      /\$([a-zA-Z0-9_-]+)/g
    ];
  }

  /**
   * Analyze SCSS context for a piece of content
   */
  public analyzeContext(
    content: string,
    filePath: string,
    lineNumber: number
  ): ScssContext {
    const selector = this.extractSelector(content, lineNumber);
    const variables = this.extractVariables(content);
    const mixins = this.extractMixins(content);
    const nesting = this.analyzeNesting(content, lineNumber);
    const mediaQueries = this.extractMediaQueries(content, lineNumber);

    return {
      filePath,
      lineNumber,
      selector,
      variables,
      mixins,
      nestingLevel: nesting.level,
      nestingContext: nesting.context,
      mediaQueries,
      parentSelectors: nesting.parents
    };
  }

  /**
   * Resolve SCSS variables to their values
   */
  public async resolveVariables(
    context: ScssContext,
    variableMap: Map<string, string>
  ): Promise<VariableResolution[]> {
    const resolutions: VariableResolution[] = [];

    for (const variable of context.variables) {
      try {
        const resolvedValue = await this.variableResolver.resolveVariable(
          variable.name,
          variableMap,
          context.filePath
        );

        resolutions.push({
          variableName: variable.name,
          originalValue: variable.value,
          resolvedValue,
          isResolved: true,
          resolutionPath: [variable.name] // Simplified path
        });
      } catch (error) {
        resolutions.push({
          variableName: variable.name,
          originalValue: variable.value,
          resolvedValue: variable.value,
          isResolved: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return resolutions;
  }

  /**
   * Compare SCSS contexts between two versions
   */
  public compareContexts(
    oldContext: ScssContext,
    newContext: ScssContext
  ): {
    selectorChanged: boolean;
    variablesChanged: string[];
    mixinsChanged: string[];
    nestingChanged: boolean;
    mediaQueryChanged: boolean;
  } {
    const selectorChanged = oldContext.selector !== newContext.selector;
    const variablesChanged = this.findChangedVariables(oldContext.variables, newContext.variables);
    const mixinsChanged = this.findChangedMixins(oldContext.mixins, newContext.mixins);
    const nestingChanged = oldContext.nestingLevel !== newContext.nestingLevel;
    const mediaQueryChanged = this.compareMediaQueries(oldContext.mediaQueries, newContext.mediaQueries);

    return {
      selectorChanged,
      variablesChanged,
      mixinsChanged,
      nestingChanged,
      mediaQueryChanged
    };
  }

  private extractSelector(content: string, lineNumber: number): string {
    const lines = content.split('\n');
    const currentLine = lines[lineNumber - 1];

    // Look for selector patterns
    const selectorPattern = /([.#]?[a-zA-Z0-9_-]+(?:\s*[>+~]\s*[.#]?[a-zA-Z0-9_-]+)*)\s*\{/;
    const match = currentLine.match(selectorPattern);

    if (match) {
      return match[1].trim();
    }

    // Look backwards for parent selector
    for (let i = lineNumber - 2; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.endsWith('{')) {
        const selectorMatch = line.match(selectorPattern);
        if (selectorMatch) {
          return selectorMatch[1].trim();
        }
      }
    }

    return '';
  }

  private extractVariables(content: string): Array<{ name: string; value: string; line: number }> {
    const variables: Array<{ name: string; value: string; line: number }> = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const variableMatch = line.match(/\$([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/);
      if (variableMatch) {
        variables.push({
          name: variableMatch[1],
          value: variableMatch[2].trim(),
          line: index + 1
        });
      }
    });

    return variables;
  }

  private extractMixins(content: string): MixinUsage[] {
    const mixins: MixinUsage[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Extract @include statements
      const includeMatch = line.match(/@include\s+([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?/);
      if (includeMatch) {
        mixins.push({
          name: includeMatch[1],
          type: 'include',
          arguments: includeMatch[2] ? includeMatch[2].split(',').map(arg => arg.trim()) : [],
          line: index + 1
        });
      }

      // Extract @mixin definitions
      const mixinMatch = line.match(/@mixin\s+([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?/);
      if (mixinMatch) {
        mixins.push({
          name: mixinMatch[1],
          type: 'definition',
          arguments: mixinMatch[2] ? mixinMatch[2].split(',').map(arg => arg.trim()) : [],
          line: index + 1
        });
      }
    });

    return mixins;
  }

  private analyzeNesting(content: string, lineNumber: number): {
    level: number;
    context: string[];
    parents: string[];
  } {
    const lines = content.split('\n');
    let level = 0;
    const context: string[] = [];
    const parents: string[] = [];

    for (let i = 0; i < lineNumber && i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes('{')) {
        level++;
        const selector = this.extractSelectorFromLine(line);
        if (selector) {
          context.push(selector);
          parents.push(selector);
        }
      }

      if (line.includes('}')) {
        level--;
        if (context.length > 0) {
          context.pop();
        }
      }
    }

    return { level, context, parents };
  }

  private extractMediaQueries(content: string, lineNumber: number): string[] {
    const mediaQueries: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lineNumber && i < lines.length; i++) {
      const line = lines[i].trim();
      const mediaMatch = line.match(/@media\s+([^{]+)/);
      
      if (mediaMatch) {
        mediaQueries.push(mediaMatch[1].trim());
      }
    }

    return mediaQueries;
  }

  private extractSelectorFromLine(line: string): string {
    const selectorMatch = line.match(/([^{]+)\s*\{/);
    return selectorMatch ? selectorMatch[1].trim() : '';
  }

  private findChangedVariables(
    oldVars: Array<{ name: string; value: string; line: number }>,
    newVars: Array<{ name: string; value: string; line: number }>
  ): string[] {
    const changed: string[] = [];
    const oldVarMap = new Map(oldVars.map(v => [v.name, v.value]));
    const newVarMap = new Map(newVars.map(v => [v.name, v.value]));

    // Check for changed values
    for (const [name, newValue] of newVarMap) {
      const oldValue = oldVarMap.get(name);
      if (oldValue && oldValue !== newValue) {
        changed.push(name);
      }
    }

    return changed;
  }

  private findChangedMixins(oldMixins: MixinUsage[], newMixins: MixinUsage[]): string[] {
    const changed: string[] = [];
    const oldMixinMap = new Map(oldMixins.map(m => [m.name, m]));
    
    for (const newMixin of newMixins) {
      const oldMixin = oldMixinMap.get(newMixin.name);
      if (oldMixin && !this.areMixinsEqual(oldMixin, newMixin)) {
        changed.push(newMixin.name);
      }
    }

    return changed;
  }

  private areMixinsEqual(mixin1: MixinUsage, mixin2: MixinUsage): boolean {
    return mixin1.type === mixin2.type &&
           mixin1.arguments.length === mixin2.arguments.length &&
           mixin1.arguments.every((arg, index) => arg === mixin2.arguments[index]);
  }

  private compareMediaQueries(oldQueries: string[], newQueries: string[]): boolean {
    if (oldQueries.length !== newQueries.length) {
      return true;
    }

    return oldQueries.some((query, index) => query !== newQueries[index]);
  }
}
```

### 3.3 Enhanced Types for Semantic Analysis (`src/diff/types.ts` - additions)

Add the following types to the existing types file:

```typescript
// Add to existing types.ts file

export interface ScssContext {
  filePath: string;
  lineNumber: number;
  selector: string;
  variables: Array<{ name: string; value: string; line: number }>;
  mixins: MixinUsage[];
  nestingLevel: number;
  nestingContext: string[];
  mediaQueries: string[];
  parentSelectors: string[];
}

export interface MixinUsage {
  name: string;
  type: 'include' | 'definition';
  arguments: string[];
  line: number;
}

export interface VariableResolution {
  variableName: string;
  originalValue: string;
  resolvedValue: string;
  isResolved: boolean;
  resolutionPath?: string[];
  error?: string;
}

export interface SemanticAnalysisResult {
  categorized: Map<PropertyCategory, CssPropertyChange[]>;
  related: CssPropertyChange[][];
  highImpact: CssPropertyChange[];
  contextChanges: {
    selectorChanged: boolean;
    variablesChanged: string[];
    mixinsChanged: string[];
    nestingChanged: boolean;
    mediaQueryChanged: boolean;
  };
  recommendations: string[];
}

// Extend existing CssPropertyChange interface
export interface CssPropertyChange {
  property: string;
  oldValue?: string;
  newValue?: string;
  category: PropertyCategory;
  impact: PropertyImpact;
  reasoning?: string; // New field
  context?: ScssContext; // New field
  variableResolutions?: VariableResolution[]; // New field
}
```

### 3.4 Integration with DiffAnalyzer

Update the `DiffAnalyzer` class from Task 2 to include semantic analysis:

```typescript
// Add to existing DiffAnalyzer class in src/diff/diff-analyzer.ts

import { CssPropertyCategorizer } from './css-property-categorizer';
import { ScssContextAnalyzer } from './scss-context-analyzer';

export class DiffAnalyzer {
  // ...existing code...
  
  private cssPropertyCategorizer: CssPropertyCategorizer;
  private scssContextAnalyzer: ScssContextAnalyzer;

  constructor() {
    // ...existing constructor code...
    this.cssPropertyCategorizer = new CssPropertyCategorizer();
    this.scssContextAnalyzer = new ScssContextAnalyzer();
  }

  /**
   * Enhanced analyzeContent with semantic analysis
   */
  public async analyzeContent(
    content1: string,
    content2: string,
    filePath: string = 'unknown'
  ): Promise<DiffChunk[]> {
    // Get basic text diff
    const chunks = await this.performTextDiff(content1, content2);

    // Add semantic analysis to each chunk
    for (const chunk of chunks) {
      await this.addSemanticAnalysis(chunk, content1, content2, filePath);
    }

    return chunks;
  }

  private async addSemanticAnalysis(
    chunk: DiffChunk,
    content1: string,
    content2: string,
    filePath: string
  ): Promise<void> {
    for (const change of chunk.changes) {
      if (change.type === 'context') continue;

      // Extract CSS properties from the change
      const cssProperties = this.extractCssPropertiesFromChange(change);
      
      if (cssProperties.length > 0) {
        // Categorize and analyze properties
        const analysis = this.cssPropertyCategorizer.analyzePropertyChanges(cssProperties);
        change.cssProperties = cssProperties;

        // Add SCSS context analysis
        const context = this.scssContextAnalyzer.analyzeContext(
          change.type === 'added' ? content2 : content1,
          filePath,
          change.lineNumber
        );
        change.scssContext = context;
      }
    }

    // Update chunk context with semantic information
    chunk.context = {
      ...chunk.context,
      semanticSummary: this.generateSemanticSummary(chunk)
    };
  }

  private extractCssPropertiesFromChange(change: DiffChange): CssPropertyChange[] {
    const properties: CssPropertyChange[] = [];
    const content = change.content.trim();

    // Match CSS property declarations
    const propertyPattern = /([a-zA-Z-]+)\s*:\s*([^;]+);?/g;
    let match;

    while ((match = propertyPattern.exec(content)) !== null) {
      const [, property, value] = match;
      
      properties.push({
        property: property.trim(),
        oldValue: change.type === 'removed' ? value.trim() : undefined,
        newValue: change.type === 'added' ? value.trim() : undefined,
        category: 'other', // Will be set by categorizer
        impact: 'medium' // Will be set by categorizer
      });
    }

    return properties;
  }

  private generateSemanticSummary(chunk: DiffChunk): string {
    const changes = chunk.changes.filter(c => c.cssProperties && c.cssProperties.length > 0);
    
    if (changes.length === 0) {
      return 'No semantic CSS changes detected';
    }

    const categories = new Set<string>();
    const highImpactCount = changes.reduce((count, change) => {
      change.cssProperties?.forEach(prop => {
        categories.add(prop.category);
        if (prop.impact === 'high') count++;
      });
      return count;
    }, 0);

    const summary = [`Changes in ${Array.from(categories).join(', ')}`];
    
    if (highImpactCount > 0) {
      summary.push(`${highImpactCount} high-impact changes`);
    }

    return summary.join('; ');
  }

  // ...rest of existing methods...
}
```

## Testing Requirements

Create comprehensive tests for the semantic analysis components:

### 3.5 Test File: `src/diff/__tests__/css-property-categorizer.test.ts`

```typescript
import { CssPropertyCategorizer } from '../css-property-categorizer';
import { CssPropertyChange } from '../types';

describe('CssPropertyCategorizer', () => {
  let categorizer: CssPropertyCategorizer;

  beforeEach(() => {
    categorizer = new CssPropertyCategorizer();
  });

  describe('categorizeProperty', () => {
    it('should categorize typography properties correctly', () => {
      const result = categorizer.categorizeProperty('font-size', '14px', '16px');
      
      expect(result.category).toBe('typography');
      expect(result.impact).toBe('high');
      expect(result.reasoning).toContain('Typography change');
    });

    it('should categorize layout properties correctly', () => {
      const result = categorizer.categorizeProperty('margin', '10px', '20px');
      
      expect(result.category).toBe('layout');
      expect(result.reasoning).toContain('Layout change');
    });

    it('should assess significant font-size changes as high impact', () => {
      const result = categorizer.categorizeProperty('font-size', '12px', '18px');
      
      expect(result.impact).toBe('high');
    });

    it('should assess subtle changes as low impact', () => {
      const result = categorizer.categorizeProperty('letter-spacing', '0.1em', '0.12em');
      
      expect(result.impact).toBe('low');
    });
  });

  describe('analyzePropertyChanges', () => {
    it('should group properties by category', () => {
      const changes: CssPropertyChange[] = [
        { property: 'font-size', newValue: '16px', category: 'other', impact: 'medium' },
        { property: 'margin', newValue: '10px', category: 'other', impact: 'medium' },
        { property: 'color', newValue: 'red', category: 'other', impact: 'medium' }
      ];

      const result = categorizer.analyzePropertyChanges(changes);
      
      expect(result.categorized.has('typography')).toBe(true);
      expect(result.categorized.has('layout')).toBe(true);
      expect(result.categorized.has('color')).toBe(true);
    });

    it('should identify related properties', () => {
      const changes: CssPropertyChange[] = [
        { property: 'margin-top', newValue: '10px', category: 'other', impact: 'medium' },
        { property: 'margin-bottom', newValue: '15px', category: 'other', impact: 'medium' },
        { property: 'color', newValue: 'blue', category: 'other', impact: 'medium' }
      ];

      const result = categorizer.analyzePropertyChanges(changes);
      
      expect(result.related).toHaveLength(1);
      expect(result.related[0]).toHaveLength(2);
    });
  });
});
```

### 3.6 Test File: `src/diff/__tests__/scss-context-analyzer.test.ts`

```typescript
import { ScssContextAnalyzer } from '../scss-context-analyzer';

describe('ScssContextAnalyzer', () => {
  let analyzer: ScssContextAnalyzer;

  beforeEach(() => {
    analyzer = new ScssContextAnalyzer();
  });

  describe('analyzeContext', () => {
    it('should extract selector context', () => {
      const content = `
        .button {
          padding: 10px;
          &:hover {
            background: blue;
          }
        }
      `;

      const context = analyzer.analyzeContext(content, 'test.scss', 4);
      
      expect(context.selector).toContain('button');
      expect(context.nestingLevel).toBeGreaterThan(0);
    });

    it('should extract variables', () => {
      const content = `
        $primary-color: #007bff;
        $secondary-color: #6c757d;
        
        .button {
          color: $primary-color;
        }
      `;

      const context = analyzer.analyzeContext(content, 'test.scss', 2);
      
      expect(context.variables).toHaveLength(2);
      expect(context.variables[0].name).toBe('primary-color');
      expect(context.variables[0].value).toBe('#007bff');
    });

    it('should extract mixin usage', () => {
      const content = `
        @mixin button-style($color) {
          background: $color;
        }
        
        .button {
          @include button-style(blue);
        }
      `;

      const context = analyzer.analyzeContext(content, 'test.scss', 7);
      
      expect(context.mixins).toHaveLength(2);
      expect(context.mixins[0].type).toBe('definition');
      expect(context.mixins[1].type).toBe('include');
    });
  });

  describe('compareContexts', () => {
    it('should detect selector changes', () => {
      const oldContext = { selector: '.button', variables: [], mixins: [], nestingLevel: 1, nestingContext: [], mediaQueries: [], parentSelectors: [], filePath: '', lineNumber: 1 };
      const newContext = { selector: '.btn', variables: [], mixins: [], nestingLevel: 1, nestingContext: [], mediaQueries: [], parentSelectors: [], filePath: '', lineNumber: 1 };

      const result = analyzer.compareContexts(oldContext, newContext);
      
      expect(result.selectorChanged).toBe(true);
    });

    it('should detect variable changes', () => {
      const oldContext = { 
        selector: '.button', 
        variables: [{ name: 'color', value: 'red', line: 1 }], 
        mixins: [], 
        nestingLevel: 1, 
        nestingContext: [], 
        mediaQueries: [], 
        parentSelectors: [], 
        filePath: '', 
        lineNumber: 1 
      };
      const newContext = { 
        selector: '.button', 
        variables: [{ name: 'color', value: 'blue', line: 1 }], 
        mixins: [], 
        nestingLevel: 1, 
        nestingContext: [], 
        mediaQueries: [], 
        parentSelectors: [], 
        filePath: '', 
        lineNumber: 1 
      };

      const result = analyzer.compareContexts(oldContext, newContext);
      
      expect(result.variablesChanged).toContain('color');
    });
  });
});
```

## Integration Points

1. **Typography System Integration**: Use existing variable resolver from `src/typography/variable-resolver.ts`
2. **Parser Integration**: Leverage AST parsing capabilities from `src/parser/`
3. **Error Handling**: Use existing error handling patterns from `src/errors.ts`

## Success Criteria

- [ ] CSS properties are correctly categorized by type (typography, layout, color, animation, other)
- [ ] Property impact is accurately assessed (high, medium, low)
- [ ] Related properties are grouped together logically
- [ ] SCSS context is properly analyzed (variables, mixins, nesting)
- [ ] Variable resolution integrates with existing typography system
- [ ] Semantic analysis enhances diff chunks with meaningful context
- [ ] All tests pass with >90% coverage
- [ ] Performance remains acceptable for large SCSS files

## Next Steps

After completing this task:
- **Task 4**: SCSS Variable Resolution and Context Analysis (enhanced variable tracking)
- **Task 5**: Diff Formatting (Unified, Split, Summary) 
- **Task 6**: Diff Rendering (Terminal, JSON, HTML)

This task provides the foundation for understanding the semantic meaning of CSS changes beyond just 
textual differences, enabling more intelligent diff analysis and better insights for developers reviewing style changes.
