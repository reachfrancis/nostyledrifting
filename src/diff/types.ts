/**
 * Core type definitions for the Style Diff Engine
 * Provides the foundational interfaces and types for diff operations
 */

/**
 * Configuration options for diff operations
 */
export interface DiffOptions {
  /** How to display the diff results */
  viewMode: 'unified' | 'split' | 'summary';
  /** Number of context lines to show around changes */
  contextLines: number;
  /** Whether to group related changes together */
  groupRelatedChanges: boolean;
  /** Whether to resolve SCSS variables to their values */
  resolveVariables: boolean;
  /** Whether to show only changed files/lines */
  showOnlyChanges: boolean;
  /** Output format for the diff results */
  format: 'terminal' | 'json' | 'html';
}

/**
 * Main result structure for style diff operations
 */
export interface StyleDiffResult {
  /** Name of the first branch being compared */
  branch1: string;
  /** Name of the second branch being compared */
  branch2: string;
  /** Array of file-level diff results */
  fileDiffs: FileDiffResult[];
  /** Summary statistics of the diff operation */
  summary: DiffSummary;
  /** Metadata about the diff operation */
  metadata: DiffMetadata;
}

/**
 * Diff result for a single file
 */
export interface FileDiffResult {
  /** Relative path to the file */
  filePath: string;
  /** Type of change for this file */
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  /** Array of diff chunks within the file */
  chunks: DiffChunk[];
  /** Summary statistics for this file */
  summary: FileDiffSummary;
}

/**
 * A chunk represents a contiguous block of changes
 */
export interface DiffChunk {
  /** Starting line number in the old file */
  oldStart: number;
  /** Number of lines in the old file */
  oldLength: number;
  /** Starting line number in the new file */
  newStart: number;
  /** Number of lines in the new file */
  newLength: number;
  /** Array of individual changes within this chunk */
  changes: DiffChange[];
  /** Context information for this chunk */
  context: ChunkContext;
}

/**
 * Individual line change within a diff chunk
 */
export interface DiffChange {
  /** Type of change */
  type: 'added' | 'removed' | 'modified' | 'context';
  /** Line number in the relevant file */
  lineNumber: number;
  /** Content of the line */
  content: string;
  /** CSS property changes (if applicable) */
  cssProperties?: CssPropertyChange[];
  /** SCSS context information */
  scssContext?: ScssContext;
}

/**
 * Detailed information about a CSS property change
 */
export interface CssPropertyChange {
  /** CSS property name */
  property: string;
  /** Previous value (if modified/removed) */
  oldValue?: string;
  /** New value (if modified/added) */
  newValue?: string;
  /** Category of the CSS property */
  category: 'typography' | 'layout' | 'color' | 'animation' | 'other';
  /** Impact level of this change */
  impact: 'high' | 'medium' | 'low';
  /** Visual impact assessment */
  visualImpact?: 'major' | 'moderate' | 'minor';
  /** Performance impact assessment */
  performanceImpact?: 'high' | 'medium' | 'low' | 'none';
  /** Whether this property affects accessibility */
  accessibility?: boolean;
  /** Whether this property is responsive-related */
  responsive?: boolean;
  /** Properties related to this change */
  relatedProperties?: string[];
  /** Semantic impact of the change */
  semanticImpact?: 'breaking' | 'visual' | 'functional' | 'cosmetic';
  /** Selectors potentially affected by this change */
  affectedSelectors?: string[];
}

/**
 * Grouping of related diff changes
 */
export interface DiffGroup {
  /** Category or type of the group */
  category: string;
  /** CSS selector associated with the group */
  selector: string;
  /** Changes belonging to this group */
  changes: DiffChange[];
  /** Whether changes in this group are related */
  related: boolean;
}

/**
 * Summary statistics for diff results
 */
export interface DiffSummary {
  /** Total number of files changed */
  filesChanged: number;
  /** Total number of lines added */
  linesAdded: number;
  /** Total number of lines removed */
  linesRemoved: number;
  /** Total number of lines modified */
  linesModified: number;
  /** Total number of CSS properties changed */
  propertiesChanged: number;
  /** Number of high-impact changes */
  highImpactChanges: number;
  /** Number of medium-impact changes */
  mediumImpactChanges: number;
  /** Number of low-impact changes */
  lowImpactChanges: number;
}

/**
 * Summary statistics for a single file
 */
export interface FileDiffSummary {
  /** Number of lines added in this file */
  linesAdded: number;
  /** Number of lines removed in this file */
  linesRemoved: number;
  /** Number of lines modified in this file */
  linesModified: number;
  /** Number of CSS properties changed in this file */
  propertiesChanged: number;
  /** Overall complexity of changes in this file */
  changeComplexity: 'low' | 'medium' | 'high';
}

/**
 * Metadata about the diff operation
 */
export interface DiffMetadata {
  /** When the comparison was performed */
  comparisonTime: Date;
  /** Time taken to process the diff in milliseconds */
  processingTimeMs: number;
  /** Algorithm used for diff calculation */
  diffAlgorithm: string;
  /** Version of the diff engine */
  version: string;
  /** Options used for this diff operation */
  options: DiffOptions;
}

/**
 * Context information for a diff chunk
 */
export interface ChunkContext {
  /** Number of surrounding context lines */
  surroundingLines: number;
  /** CSS selector if applicable */
  selector?: string;
  /** Nesting level in SCSS */
  nestingLevel: number;
  /** Media query context if applicable */
  mediaQuery?: string;
}

/**
 * SCSS-specific context information
 */
export interface ScssContext {
  /** SCSS variables available in this context */
  variables: Map<string, string>;
  /** Mixins available in this context */
  mixins: string[];
  /** Import statements affecting this context */
  imports: string[];
  /** Nesting path in SCSS structure */
  nestingPath: string[];
  /** Selector complexity analysis */
  selectorComplexity?: 'low' | 'medium' | 'high';
  /** Media query context if applicable */
  mediaQuery?: string;
  /** Parent selector hierarchy */
  parentSelectors?: string[];
}

/**
 * SCSS variable definition with full context information
 */
export interface VariableDefinition {
  /** Variable name without $ prefix */
  name: string;
  /** Variable value as string */
  value: string;
  /** File path where variable is defined */
  filePath: string;
  /** Line number in the file */
  lineNumber: number;
  /** Variable scope */
  scope: VariableScope;
  /** Whether variable has !default flag */
  isDefault: boolean;
  /** Whether variable has !global flag */
  isGlobal: boolean;
  /** Other variables this variable depends on */
  dependencies: string[];
}

/**
 * Variable scope types
 */
export type VariableScope = 'global' | 'file' | 'component' | 'mixin' | 'function';

/**
 * Variable resolution context for scoped lookups
 */
export interface VariableResolutionContext {
  /** Current file path */
  filePath: string;
  /** Current CSS selector context */
  selector: string | null;
  /** Current media query context */
  mediaQuery: string | null;
  /** Current mixin context */
  mixinContext?: string;
  /** Current function context */
  functionContext?: string;
}

/**
 * Variable dependency graph mapping variable names to their dependencies
 */
export type VariableDependencyGraph = Map<string, string[]>;

/**
 * Analysis of variable impact when changed
 */
export interface VariableImpactAnalysis {
  /** Variables added in the new version */
  addedVariables: VariableDefinition[];
  /** Variables removed in the new version */
  removedVariables: VariableDefinition[];
  /** Variables modified in the new version */
  modifiedVariables: Array<{
    variable: VariableDefinition;
    oldValue: any;
    newValue: any;
    impact: 'low' | 'medium' | 'high';
  }>;
  /** Components potentially affected by variable changes */
  affectedComponents: string[];
  /** Cascade effects of variable changes */
  cascadeEffects: Array<{
    variableName: string;
    affectedVariables: string[];
    cascadeDepth: number;
    impactLevel: 'low' | 'medium' | 'high';
  }>;
  /** Recommendations for handling variable changes */
  recommendations: string[];
}

/**
 * Analysis of selector context changes
 */
export interface SelectorContextChange {
  /** Type of selector change */
  type: 'added' | 'removed' | 'modified';
  /** Original selector (for removed/modified) */
  oldSelector?: string;
  /** New selector (for added/modified) */
  newSelector?: string;
  /** Line number where change occurs */
  line: number;
  /** Impact assessment of the change */
  impact: 'low' | 'medium' | 'high';
  /** Human-readable reasoning for the change */
  reasoning: string;
}

/**
 * Analysis of import dependency changes
 */
export interface ImportDependencyChange {
  /** Type of import change */
  type: 'added' | 'removed' | 'modified';
  /** Import path */
  importPath: string;
  /** Line number where change occurs */
  line: number;
  /** Impact assessment of the change */
  impact: 'low' | 'medium' | 'high';
  /** Human-readable reasoning for the change */
  reasoning: string;
}

/**
 * Enhanced diff result with contextual analysis
 */
export interface ContextualDiffResult {
  /** File path being analyzed */
  filePath: string;
  /** Enhanced diff chunks with variable context */
  chunks: EnhancedDiffChunk[];
  /** Variable impact analysis */
  variableImpact: VariableImpactAnalysis;
  /** Selector context changes */
  selectorChanges: SelectorContextChange[];
  /** Import dependency changes */
  importChanges: ImportDependencyChange[];
  /** Contextual summary */
  summary: ContextualDiffSummary;
}

/**
 * Enhanced diff chunk with variable resolution context
 */
export interface EnhancedDiffChunk extends DiffChunk {
  /** Variable definitions affected by this chunk */
  affectedVariables: VariableDefinition[];
  /** Variables resolved in this chunk's context */
  resolvedVariables: Map<string, any>;
  /** Import statements affecting this chunk */
  importContext: string[];
  /** Mixin usage in this chunk */
  mixinUsage: string[];
}

/**
 * Contextual summary including variable and dependency analysis
 */
export interface ContextualDiffSummary extends FileDiffSummary {
  /** Number of variables changed */
  variablesChanged: number;
  /** Number of high-impact variable changes */
  highImpactVariableChanges: number;
  /** Number of import dependency changes */
  importChanges: number;
  /** Number of selector context changes */
  selectorChanges: number;
  /** Overall contextual complexity */
  contextualComplexity: 'low' | 'medium' | 'high';
}

/**
 * Default configuration for diff options
 */
export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  viewMode: 'unified',
  contextLines: 3,
  groupRelatedChanges: true,
  resolveVariables: true,
  showOnlyChanges: false,
  format: 'terminal'
};

/**
 * Type guard to check if an object is a valid DiffOptions
 */
export function isDiffOptions(obj: any): obj is DiffOptions {
  return obj &&
    typeof obj === 'object' &&
    ['unified', 'split', 'summary'].includes(obj.viewMode) &&
    typeof obj.contextLines === 'number' &&
    typeof obj.groupRelatedChanges === 'boolean' &&
    typeof obj.resolveVariables === 'boolean' &&
    typeof obj.showOnlyChanges === 'boolean' &&
    ['terminal', 'json', 'html'].includes(obj.format);
}

/**
 * Type guard to check if an object is a valid StyleDiffResult
 */
export function isStyleDiffResult(obj: any): obj is StyleDiffResult {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.branch1 === 'string' &&
    typeof obj.branch2 === 'string' &&
    Array.isArray(obj.fileDiffs) &&
    obj.summary &&
    obj.metadata;
}
