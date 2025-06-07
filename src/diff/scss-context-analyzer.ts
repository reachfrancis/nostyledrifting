/**
 * SCSS Context Analysis Engine
 * Provides semantic understanding of SCSS structure and context
 */

import { ScssContext } from './types';
import { VariableResolver } from '../typography/variable-resolver';

export interface ScssRule {
  selector: string;
  properties: Map<string, string>;
  nestedRules: ScssRule[];
  mediaQuery?: string;
  parentSelector?: string;
  startLine: number;
  endLine: number;
}

export interface ScssAnalysisResult {
  rules: ScssRule[];
  variables: Map<string, string>;
  mixins: Map<string, string>;
  imports: string[];
  mediaQueries: string[];
  selectors: string[];
  nestingDepth: number;
  complexity: 'low' | 'medium' | 'high';
  accessibility: {
    contrastIssues: string[];
    focusableElements: string[];
    ariaProperties: string[];
  };
}

export interface ContextualChange {
  selector: string;
  property: string;
  oldValue?: string;
  newValue?: string;
  context: ScssContext;
  semanticImpact: 'breaking' | 'visual' | 'functional' | 'cosmetic';
  affectedSelectors: string[];
}

/**
 * SCSS Context Analyzer
 */
export class ScssContextAnalyzer {
  private variableResolver: VariableResolver;
  private readonly selectorPatterns: Map<RegExp, string>;

  constructor() {
    this.variableResolver = new VariableResolver();
    this.selectorPatterns = new Map();
    this.initializeSelectorPatterns();
  }

  /**
   * Analyze SCSS content and extract semantic context
   */
  analyzeContent(content: string): ScssAnalysisResult {
    const lines = content.split('\n');
    const result: ScssAnalysisResult = {
      rules: [],
      variables: new Map(),
      mixins: new Map(),
      imports: [],
      mediaQueries: [],
      selectors: [],
      nestingDepth: 0,
      complexity: 'low',
      accessibility: {
        contrastIssues: [],
        focusableElements: [],
        ariaProperties: []
      }
    };

    let currentRule: ScssRule | null = null;
    let nestingLevel = 0;
    let maxNestingDepth = 0;
    let bracketStack: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip empty lines and comments
      if (!line || line.startsWith('//') || line.startsWith('/*')) {
        continue;
      }

      // Handle imports
      if (line.startsWith('@import') || line.startsWith('@use')) {
        const importPath = this.extractImportPath(line);
        if (importPath) {
          result.imports.push(importPath);
        }
        continue;
      }

      // Handle variables
      if (line.startsWith('$')) {
        const variable = this.extractVariable(line);
        if (variable) {
          result.variables.set(variable.name, variable.value);
        }
        continue;
      }

      // Handle mixins
      if (line.startsWith('@mixin')) {
        const mixin = this.extractMixin(line);
        if (mixin) {
          result.mixins.set(mixin.name, mixin.definition);
        }
        continue;
      }

      // Handle media queries
      if (line.startsWith('@media')) {
        const mediaQuery = this.extractMediaQuery(line);
        if (mediaQuery) {
          result.mediaQueries.push(mediaQuery);
        }
      }

      // Handle opening braces
      if (line.includes('{')) {
        nestingLevel++;
        bracketStack.push(lineNumber);
        maxNestingDepth = Math.max(maxNestingDepth, nestingLevel);

        // Extract selector
        const selector = this.extractSelector(line);
        if (selector) {
          result.selectors.push(selector);
          
          currentRule = {
            selector,
            properties: new Map(),
            nestedRules: [],
            startLine: lineNumber,
            endLine: lineNumber
          };

          // Check for accessibility-related selectors
          this.analyzeAccessibilitySelector(selector, result);
        }
      }

      // Handle closing braces
      if (line.includes('}')) {
        nestingLevel--;
        bracketStack.pop();
        
        if (currentRule) {
          currentRule.endLine = lineNumber;
          result.rules.push(currentRule);
          currentRule = null;
        }
      }

      // Handle properties
      if (line.includes(':') && !line.includes('{') && currentRule) {
        const property = this.extractProperty(line);
        if (property) {
          currentRule.properties.set(property.name, property.value);
          
          // Check for accessibility properties
          this.analyzeAccessibilityProperty(property.name, property.value, result);
        }
      }
    }

    result.nestingDepth = maxNestingDepth;
    result.complexity = this.calculateComplexity(result);

    return result;
  }

  /**
   * Create SCSS context for a specific line
   */
  createContext(content: string, lineNumber: number): ScssContext {
    const lines = content.split('\n');
    const context: ScssContext = {
      variables: new Map(),
      mixins: [],
      imports: [],
      nestingPath: []
    };

    let nestingStack: string[] = [];

    // Analyze content up to the specified line
    for (let i = 0; i < Math.min(lineNumber, lines.length); i++) {
      const line = lines[i].trim();

      // Track variables
      if (line.startsWith('$')) {
        const variable = this.extractVariable(line);
        if (variable) {
          context.variables.set(variable.name, variable.value);
        }
      }

      // Track imports
      if (line.startsWith('@import') || line.startsWith('@use')) {
        const importPath = this.extractImportPath(line);
        if (importPath) {
          context.imports.push(importPath);
        }
      }

      // Track mixins
      if (line.startsWith('@mixin')) {
        const mixin = this.extractMixin(line);
        if (mixin) {
          context.mixins.push(mixin.name);
        }
      }

      // Track nesting
      if (line.includes('{')) {
        const selector = this.extractSelector(line);
        if (selector) {
          nestingStack.push(selector);
        }
      }

      if (line.includes('}')) {
        nestingStack.pop();
      }
    }

    context.nestingPath = [...nestingStack];
    return context;
  }

  /**
   * Analyze contextual changes between two SCSS contents
   */
  analyzeContextualChanges(
    oldContent: string,
    newContent: string
  ): ContextualChange[] {
    const oldAnalysis = this.analyzeContent(oldContent);
    const newAnalysis = this.analyzeContent(newContent);
    const changes: ContextualChange[] = [];

    // Compare rules and properties
    const oldRuleMap = this.createRuleMap(oldAnalysis.rules);
    const newRuleMap = this.createRuleMap(newAnalysis.rules);

    // Find modified and added rules
    for (const [selector, newRule] of newRuleMap) {
      const oldRule = oldRuleMap.get(selector);
      
      if (!oldRule) {
        // New rule added
        for (const [property, value] of newRule.properties) {
          changes.push({
            selector,
            property,
            newValue: value,
            context: this.createContextFromRule(newRule, newAnalysis),
            semanticImpact: this.determineSemanticImpact(property, undefined, value),
            affectedSelectors: this.findAffectedSelectors(selector, newAnalysis)
          });
        }
      } else {
        // Compare properties in existing rule
        for (const [property, newValue] of newRule.properties) {
          const oldValue = oldRule.properties.get(property);
          
          if (oldValue !== newValue) {
            changes.push({
              selector,
              property,
              oldValue,
              newValue,
              context: this.createContextFromRule(newRule, newAnalysis),
              semanticImpact: this.determineSemanticImpact(property, oldValue, newValue),
              affectedSelectors: this.findAffectedSelectors(selector, newAnalysis)
            });
          }
        }

        // Check for removed properties
        for (const [property, oldValue] of oldRule.properties) {
          if (!newRule.properties.has(property)) {
            changes.push({
              selector,
              property,
              oldValue,
              context: this.createContextFromRule(oldRule, oldAnalysis),
              semanticImpact: this.determineSemanticImpact(property, oldValue, undefined),
              affectedSelectors: this.findAffectedSelectors(selector, oldAnalysis)
            });
          }
        }
      }
    }

    // Find removed rules
    for (const [selector, oldRule] of oldRuleMap) {
      if (!newRuleMap.has(selector)) {
        for (const [property, oldValue] of oldRule.properties) {
          changes.push({
            selector,
            property,
            oldValue,
            context: this.createContextFromRule(oldRule, oldAnalysis),
            semanticImpact: 'breaking',
            affectedSelectors: this.findAffectedSelectors(selector, oldAnalysis)
          });
        }
      }
    }

    return changes;
  }

  /**
   * Resolve variables in a given context
   */
  resolveVariables(value: string, context: ScssContext): string {
    return this.variableResolver.resolveValue(value, context.variables);
  }

  private extractImportPath(line: string): string | null {
    const match = line.match(/@(?:import|use)\s+['"`]([^'"`]+)['"`]/);
    return match ? match[1] : null;
  }

  private extractVariable(line: string): { name: string; value: string } | null {
    const match = line.match(/\$([^:]+):\s*([^;]+);?/);
    if (match) {
      return {
        name: match[1].trim(),
        value: match[2].trim()
      };
    }
    return null;
  }

  private extractMixin(line: string): { name: string; definition: string } | null {
    const match = line.match(/@mixin\s+([^({\s]+)(\([^)]*\))?\s*\{?/);
    if (match) {
      return {
        name: match[1].trim(),
        definition: line.trim()
      };
    }
    return null;
  }

  private extractMediaQuery(line: string): string | null {
    const match = line.match(/@media\s+([^{]+)/);
    return match ? match[1].trim() : null;
  }

  private extractSelector(line: string): string | null {
    const beforeBrace = line.split('{')[0].trim();
    if (beforeBrace && !beforeBrace.startsWith('@') && !beforeBrace.includes(':')) {
      return beforeBrace;
    }
    return null;
  }

  private extractProperty(line: string): { name: string; value: string } | null {
    const match = line.match(/([^:]+):\s*([^;]+);?/);
    if (match) {
      return {
        name: match[1].trim(),
        value: match[2].trim()
      };
    }
    return null;
  }

  private analyzeAccessibilitySelector(selector: string, result: ScssAnalysisResult): void {
    // Check for focusable elements
    const focusablePatterns = [
      /button/i, /input/i, /select/i, /textarea/i, /a\[href\]/i,
      /:focus/i, /:hover/i, /\[tabindex\]/i
    ];

    for (const pattern of focusablePatterns) {
      if (pattern.test(selector)) {
        result.accessibility.focusableElements.push(selector);
        break;
      }
    }

    // Check for ARIA attributes
    if (selector.includes('[aria-') || selector.includes('[role=')) {
      result.accessibility.ariaProperties.push(selector);
    }
  }

  private analyzeAccessibilityProperty(name: string, value: string, result: ScssAnalysisResult): void {
    // Check for potential contrast issues
    if (name === 'color' || name === 'background-color') {
      // Simple heuristic - could be enhanced with actual contrast calculation
      if (value.includes('#fff') || value.includes('white') || 
          value.includes('#000') || value.includes('black')) {
        result.accessibility.contrastIssues.push(`${name}: ${value}`);
      }
    }
  }

  private calculateComplexity(result: ScssAnalysisResult): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Nesting depth contribution
    complexityScore += result.nestingDepth * 2;

    // Number of rules contribution
    complexityScore += result.rules.length;

    // Number of media queries contribution
    complexityScore += result.mediaQueries.length * 3;

    // Number of variables contribution
    complexityScore += result.variables.size;

    if (complexityScore < 10) {
      return 'low';
    } else if (complexityScore < 25) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  private createRuleMap(rules: ScssRule[]): Map<string, ScssRule> {
    const map = new Map<string, ScssRule>();
    for (const rule of rules) {
      map.set(rule.selector, rule);
    }
    return map;
  }

  private createContextFromRule(rule: ScssRule, analysis: ScssAnalysisResult): ScssContext {
    return {
      variables: analysis.variables,
      mixins: Array.from(analysis.mixins.keys()),
      imports: analysis.imports,
      nestingPath: this.buildNestingPath(rule.selector)
    };
  }

  private buildNestingPath(selector: string): string[] {
    // Simplified nesting path extraction
    return selector.split(/\s+/).filter(part => part.trim());
  }

  private determineSemanticImpact(
    property: string,
    oldValue?: string,
    newValue?: string
  ): 'breaking' | 'visual' | 'functional' | 'cosmetic' {
    // Properties that can break layout
    const breakingProperties = ['display', 'position', 'float', 'clear', 'overflow'];
    
    // Properties that affect functionality
    const functionalProperties = ['z-index', 'pointer-events', 'visibility', 'opacity'];
    
    // Properties that have major visual impact
    const visualProperties = ['width', 'height', 'margin', 'padding', 'font-size', 'color', 'background'];

    if (breakingProperties.some(prop => property.includes(prop))) {
      return 'breaking';
    }
    
    if (functionalProperties.some(prop => property.includes(prop))) {
      return 'functional';
    }
    
    if (visualProperties.some(prop => property.includes(prop))) {
      return 'visual';
    }
    
    return 'cosmetic';
  }

  private findAffectedSelectors(selector: string, analysis: ScssAnalysisResult): string[] {
    // Find selectors that might be affected by this change
    const affected: string[] = [];
    
    // Simple heuristic: find selectors with similar class names or element types
    const selectorParts = selector.split(/[\s.#:]+/).filter(part => part);
    
    for (const otherSelector of analysis.selectors) {
      if (otherSelector !== selector) {
        const otherParts = otherSelector.split(/[\s.#:]+/).filter(part => part);
        const commonParts = selectorParts.filter(part => otherParts.includes(part));
        
        if (commonParts.length > 0) {
          affected.push(otherSelector);
        }
      }
    }
    
    return affected;
  }

  private initializeSelectorPatterns(): void {
    // Component patterns
    this.selectorPatterns.set(/\.[\w-]+__[\w-]+/, 'BEM block__element');
    this.selectorPatterns.set(/\.[\w-]+--[\w-]+/, 'BEM block--modifier');
    
    // State patterns
    this.selectorPatterns.set(/:hover|:focus|:active|:visited/, 'pseudo-class');
    this.selectorPatterns.set(/::before|::after|::first-line/, 'pseudo-element');
    
    // Accessibility patterns
    this.selectorPatterns.set(/\[aria-[\w-]+\]/, 'ARIA attribute');
    this.selectorPatterns.set(/\[role=["'][\w-]+["']\]/, 'ARIA role');
  }
}

/**
 * Default singleton instance for global use
 */
export const defaultScssContextAnalyzer = new ScssContextAnalyzer();
