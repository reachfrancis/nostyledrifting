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
