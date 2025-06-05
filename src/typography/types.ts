import { SourceLocation as ParserSourceLocation, SCSSNode } from '../parser/ast-nodes';

// Re-export for convenience
export type SourceLocation = ParserSourceLocation;
export type ASTNode = SCSSNode;

/**
 * AST Node type mappings for compatibility
 */
export enum ASTNodeType {
  STYLESHEET = 'root',
  RULE = 'rule',
  SELECTOR = 'selector',
  DECLARATION_BLOCK = 'block',
  DECLARATION = 'declaration',
  AT_RULE = 'atrule',
  VARIABLE_DECLARATION = 'variable',
  FUNCTION_DECLARATION = 'function',
  MIXIN_DECLARATION = 'mixin',
  COMMENT = 'comment',
  IMPORT = 'import',
  USE = 'use'
}

/**
 * Typography property types that we extract
 */
export type TypographyProperty = 
  // Font Properties
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'font-style'
  | 'font-variant'
  | 'font-stretch'
  | 'font'
  // Text Properties
  | 'line-height'
  | 'letter-spacing'
  | 'word-spacing'
  | 'text-transform'
  | 'text-decoration'
  | 'text-align'
  | 'text-indent'
  // Advanced Typography
  | 'font-feature-settings'
  | 'font-variant-numeric'
  | 'font-variant-ligatures'
  | 'font-kerning'
  // CSS Custom Properties (pattern)
  | string; // For custom properties starting with --

/**
 * Media query context for responsive typography
 */
export interface MediaQueryContext {
  breakpoint: {
    type: 'min-width' | 'max-width' | 'range';
    value: string;
    unit: 'px' | 'em' | 'rem' | 'vw';
    numericValue: number;
  };
  conditions: MediaCondition[];
  typographyOverrides: TypographyProperty[];
  specificity: number;
  order: number;
}

export interface MediaCondition {
  feature: string;
  operator?: string;
  value?: string;
}

/**
 * Scope information for variable resolution
 */
export interface ScopeContext {
  type: 'global' | 'block' | 'mixin' | 'function';
  selector?: string;
  variables: Map<string, string>;
  parent?: ScopeContext;
}

export interface ScopeInfo {
  currentScope: ScopeContext;
  inheritedScopes: ScopeContext[];
}

/**
 * Variable resolution context
 */
export interface VariableResolutionContext {
  scssVariables: Map<string, SCSSVariableDefinition>;
  customProperties: Map<string, CSSCustomProperty>;
  currentScope: ScopeContext;
  globalScope: ScopeContext;
  importedVariables: Map<string, ImportedVariable>;
  options: {
    resolveToComputed: boolean;
    preserveOriginal: boolean;
    trackDependencies: boolean;
  };
}

export interface SCSSVariableDefinition {
  name: string;
  value: string;
  scope: string;
  isDefault: boolean;
  location: SourceLocation;
}

export interface CSSCustomProperty {
  name: string;
  value: string;
  fallback?: string;
  location: SourceLocation;
}

export interface ImportedVariable {
  name: string;
  value: string;
  source: string;
  location: SourceLocation;
}

/**
 * Resolved value types
 */
export interface ResolvedValue {
  original: string;
  resolved: string;
  dependencies: string[];
  confidence: 'exact' | 'approximate' | 'unknown';
}

export interface ComputedValue {
  value: number;
  unit: string;
  expression: string;
  confidence: 'exact' | 'approximate' | 'unknown';
}

/**
 * Typography entry model
 */
export interface TypographyEntry {
  id: string;
  selector: string;
  property: TypographyProperty;
  value: {
    original: string;
    resolved: string;
    computed?: ComputedValue;
    fallbacks?: string[];
  };
  context: {
    file: string;
    location: SourceLocation;
    scope: ScopeInfo;
    specificity: number;
    mediaQuery?: MediaQueryContext;
    parentSelectors: string[];
  };
  dependencies: {
    variables: string[];
    mixins: string[];
    imports: string[];
    customProperties: string[];
  };  metadata: {
    isResponsive: boolean;
    hasVariables: boolean;
    hasFunctions: boolean;
    isInherited: boolean;
    overrides: string[];
    isShorthand?: boolean;
    shorthandSource?: string;
  };
}

/**
 * Font face declaration
 */
export interface FontFaceDeclaration {
  fontFamily: string;
  sources: FontSource[];
  descriptors: {
    weight?: string | string[];
    style?: string;
    stretch?: string;
    unicodeRange?: string[];
    featureSettings?: string;
    variationSettings?: string;
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  };
  loading: {
    strategy: string;
    priority: number;
  };
  location: SourceLocation;
}

export interface FontSource {
  url: string;
  format?: string;
  tech?: string[];
  isLocal: boolean;
  resolvedPath?: string;
}

/**
 * Custom property definition
 */
export interface CustomPropertyDefinition {
  name: string;
  value: string;
  fallback?: string;
  scope: string;
  location: SourceLocation;
}

/**
 * Typography properties collection
 */
export interface TypographyProperties {
  [property: string]: string;
}

/**
 * Responsive typography mapping
 */
export interface ResponsiveTypographyMap {
  base: TypographyProperties;
  breakpoints: Map<string, TypographyProperties>;
  cascade: TypographyCascade[];
}

export interface TypographyCascade {
  mediaQuery: string;
  properties: TypographyProperties;
  specificity: number;
  order: number;
}

/**
 * Font stack analysis
 */
export interface FontStackAnalysis {
  primaryFont: string;
  fallbackChain: string[];
  genericFallback?: 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy';
  usage: {
    selectors: string[];
    count: number;
    percentage: number;
  };
  fontFace?: FontFaceDeclaration;
  isWebFont: boolean;
  validation: {
    hasGenericFallback: boolean;
    fallbackCount: number;
    recommendedFallbacks?: string[];
  };
}

/**
 * Analysis results
 */
export interface ConsistencyReport {
  fontFamilyConsistency: number;
  fontSizeScale: number;
  lineHeightConsistency: number;
  issues: ConsistencyIssue[];
}

export interface ConsistencyIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: SourceLocation;
  suggestions?: string[];
}

export interface AccessibilityInsights {
  readability: {
    minimumFontSize: string;
    lineHeightRatio: number;
    contrastRequirements: ContrastRequirement[];
  };
  fontAccessibility: {
    systemFontUsage: boolean;
    webFontFallbacks: boolean;
    dyslexiaFriendlyFonts: string[];
  };
  responsiveAccessibility: {
    scalableUnits: boolean;
    fluidTypography: boolean;
    zoomSupport: boolean;
  };
  recommendations: AccessibilityRecommendation[];
}

export interface ContrastRequirement {
  level: 'AA' | 'AAA';
  size: 'normal' | 'large';
  ratio: number;
}

export interface AccessibilityRecommendation {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fix?: string;
}

/**
 * Main typography analysis result
 */
export interface TypographyAnalysisResult {
  summary: {
    totalProperties: number;
    uniqueFonts: number;
    responsiveProperties: number;
    customProperties: number;
    fontFaceDeclarations: number;
  };
  typography: {
    entries: TypographyEntry[];
    fontFaces: FontFaceDeclaration[];
    customProperties: CustomPropertyDefinition[];
  };
  byProperty: Map<TypographyProperty, TypographyEntry[]>;
  bySelector: Map<string, TypographyEntry[]>;
  byBreakpoint: Map<string, TypographyEntry[]>;
  fontStacks: FontStackAnalysis[];
  consistency: ConsistencyReport;
  accessibility: AccessibilityInsights;
  responsiveness: ResponsivenessReport;
}

/**
 * Configuration interfaces
 */
export interface ExtractionOptions {
  resolveVariables: boolean;
  evaluateFunctions: boolean;
  computeValues: boolean;
  propertyFilter?: TypographyProperty[];
  selectorFilter?: RegExp;
  parallel: boolean;
  cacheResults: boolean;
  includeContext: boolean;
  includeMetadata: boolean;
}

export interface ExtractorConfiguration {
  maxCacheSize: number;
  timeoutMs: number;
  enableStreaming: boolean;
  chunkSize: number;
  enableDebugLogging: boolean;
}

/**
 * Cache interfaces
 */
export interface TypographyCache {
  variableCache: Map<string, ResolvedValue>;
  functionCache: Map<string, ComputedValue>;
  selectorCache: Map<string, TypographyAnalysisResult>;
  invalidate(reason: InvalidationReason): void;
}

export type InvalidationReason = 'file-change' | 'dependency-change' | 'manual' | 'timeout';

/**
 * Error handling
 */
export enum ExtractionErrorType {
  PARSE_ERROR = 'PARSE_ERROR',
  AST_ERROR = 'AST_ERROR',
  IMPORT_ERROR = 'IMPORT_ERROR',
  MISSING_PROPERTY = 'MISSING_PROPERTY',
  INVALID_PROPERTY_VALUE = 'INVALID_PROPERTY_VALUE',
  VARIABLE_NOT_FOUND = 'VARIABLE_NOT_FOUND',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  FUNCTION_EVALUATION_ERROR = 'FUNCTION_EVALUATION_ERROR',
  MALFORMED_FONT_FACE = 'MALFORMED_FONT_FACE',
  UNSUPPORTED_SYNTAX = 'UNSUPPORTED_SYNTAX',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  TIMEOUT = 'TIMEOUT',
  MEMORY_LIMIT = 'MEMORY_LIMIT',
  VARIABLE_RESOLUTION = 'VARIABLE_RESOLUTION'
}

export interface ExtractionError {
  type: ExtractionErrorType;
  message: string;
  location: SourceLocation;
  property?: string;
  value?: string;
  recovery?: RecoveryStrategy;
  severity?: 'error' | 'warning' | 'critical';
  timestamp?: Date;
  recovered?: boolean;
  context?: any;
}

/**
 * Error handling interfaces
 */
export interface ErrorContext {
  filePath: string;
  operation: string;
  astNode?: SCSSNode;
  property?: string;
  value?: string;
  source?: string;
  selector?: string;
  [key: string]: any;
}

export interface RecoveryStrategy {
  recover(error: ExtractionError, context: ErrorContext): RecoveryResult;
}

export interface RecoveryResult {
  canRecover: boolean;
  recoveredValue: any;
  strategy: string;
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ExtractionError[];
  warnings: string[];
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsByFile: Map<string, number>;
  errorsByOperation: Map<string, number>;
  criticalErrors: number;
  warningErrors: number;
  recoveredErrors: number;
}

/**
 * Unit conversion and calculation
 */
export interface UnitConversionContext {
  baseFontSize: number;
  viewportWidth: number;
  viewportHeight: number;
  dpi: number;
}

export interface CalcAST {
  type: 'binary' | 'unary' | 'value' | 'function';
  operator?: '+' | '-' | '*' | '/';
  left?: CalcAST;
  right?: CalcAST;
  value?: string | number;
  unit?: string;
}

export interface EvaluationContext {
  variables: Map<string, string>;
  functions: Map<string, Function>;
  unitContext: UnitConversionContext;
}

/**
 * Viewport and responsive context
 */
export interface ViewportSize {
  width: number;
  height: number;
  unit: 'px' | 'em' | 'rem' | 'vw' | 'vh';
}

export interface BreakpointCascade {
  breakpoints: MediaQueryContext[];
  orderedBySpecificity: MediaQueryContext[];
}

export interface ResponsivenessReport {
  breakpointCoverage: number;
  fluidTypographyUsage: number;
  responsiveProperties: string[];
  gaps: ResponsiveGap[];
}

export interface ResponsiveGap {
  property: TypographyProperty;
  missingBreakpoints: string[];
  recommendation: string;
}
