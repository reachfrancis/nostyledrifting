
import { 
  ExtractionError, 
  TypographyEntry, 
  ASTNode, 
  ExtractionErrorType,
  SourceLocation 
} from './types';

/**
 * Comprehensive error handler for typography extraction
 */
export class TypographyErrorHandler {
  private errorLog: ExtractionError[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle error during extraction with recovery
   */
  handleError(
    error: Error | ExtractionError,
    context: ErrorContext
  ): RecoveryResult {
    const extractionError = this.normalizeError(error, context);
    this.errorLog.push(extractionError);

    const strategy = this.getRecoveryStrategy(extractionError.type);
    return strategy.recover(extractionError, context);
  }

  /**
   * Validate AST before processing
   */
  validateAST(ast: ASTNode): ValidationResult {
    const errors: ExtractionError[] = [];
    
    try {
      this.validateASTStructure(ast, errors);
      this.validateASTContent(ast, errors);
    } catch (error) {
      errors.push(this.normalizeError(error as Error, {
        filePath: 'unknown',
        operation: 'AST_VALIDATION',
        astNode: ast
      }));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: this.generateWarnings(ast)
    };
  }

  /**
   * Sanitize typography entry
   */
  sanitizeEntry(entry: Partial<TypographyEntry>): TypographyEntry | null {
    try {
      const sanitized = this.performSanitization(entry);
      return this.validateSanitizedEntry(sanitized) ? sanitized : null;
    } catch (error) {
      this.handleError(error as Error, {
        filePath: 'unknown',
        operation: 'ENTRY_SANITIZATION',
        entry
      });
      return null;
    }
  }

  /**
   * Create safe fallback value
   */
  createFallbackValue(property: string, originalValue: string): string {
    const fallbacks: Record<string, string> = {
      'font-family': 'sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'line-height': '1.5',
      'letter-spacing': 'normal',
      'word-spacing': 'normal',
      'text-align': 'left',
      'text-decoration': 'none',
      'text-transform': 'none'
    };

    return fallbacks[property] || originalValue || 'inherit';
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: this.errorLog.length,
      errorsByType: new Map(),
      errorsByFile: new Map(),
      errorsByOperation: new Map(),
      criticalErrors: 0,
      warningErrors: 0,
      recoveredErrors: 0
    };

    for (const error of this.errorLog) {
      // By type
      const typeCount = stats.errorsByType.get(error.type) || 0;
      stats.errorsByType.set(error.type, typeCount + 1);

      // By file
      const fileCount = stats.errorsByFile.get(error.location?.file || 'unknown') || 0;
      stats.errorsByFile.set(error.location?.file || 'unknown', fileCount + 1);

      // By severity
      if (error.severity === 'critical') stats.criticalErrors++;
      else if (error.severity === 'warning') stats.warningErrors++;

      // Recovered
      if (error.recovered) stats.recoveredErrors++;
    }

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrors(): void {
    this.errorLog = [];
  }

  /**
   * Export error log
   */
  exportErrorLog(): ExtractionError[] {
    return [...this.errorLog];
  }

  private initializeRecoveryStrategies(): void {
    // Invalid property value recovery
    this.recoveryStrategies.set('INVALID_PROPERTY_VALUE', {
      recover: (error, context) => {
        const fallbackValue = this.createFallbackValue(
          error.property || 'unknown',
          error.value || ''
        );
        
        return {
          canRecover: true,
          recoveredValue: fallbackValue,
          strategy: 'FALLBACK_VALUE',
          warnings: [`Used fallback value '${fallbackValue}' for invalid '${error.property}' value`]
        };
      }
    });

    // Variable resolution error recovery
    this.recoveryStrategies.set('VARIABLE_NOT_FOUND', {
      recover: (error, context) => {
        const fallbackValue = this.createFallbackValue(
          error.property || '',
          error.value || ''
        );
        
        return {
          canRecover: true,
          recoveredValue: fallbackValue,
          strategy: 'VARIABLE_FALLBACK',
          warnings: [`Used fallback value for unresolved variable`]
        };
      }
    });
  }

  private normalizeError(error: Error | ExtractionError, context: ErrorContext): ExtractionError {
    if (this.isExtractionError(error)) {
      return {
        ...error,
        context: context,
        timestamp: new Date(),
        severity: error.severity || 'warning'
      };
    }

    return {
      type: this.categorizeError(error),
      message: error.message,
      location: this.extractLocation(context),
      property: context.property,
      value: context.value,
      context: context,
      timestamp: new Date(),
      severity: 'warning',
      recovered: false
    };
  }

  private isExtractionError(error: any): error is ExtractionError {
    return error.type && error.message;
  }

  private categorizeError(error: Error): ExtractionErrorType {
    if (error.name === 'SyntaxError') return ExtractionErrorType.UNSUPPORTED_SYNTAX;
    if (error.message.includes('variable')) return ExtractionErrorType.VARIABLE_NOT_FOUND;
    if (error.message.includes('function')) return ExtractionErrorType.FUNCTION_EVALUATION_ERROR;
    return ExtractionErrorType.UNSUPPORTED_SYNTAX;
  }

  private extractLocation(context: ErrorContext): SourceLocation {
    if (context.astNode?.location) {
      return context.astNode.location;
    }

    return { 
      file: context.filePath || 'unknown',
      line: 0, 
      column: 0, 
      offset: 0,
      length: 0
    };
  }

  private getRecoveryStrategy(errorType: ExtractionErrorType): RecoveryStrategy {
    return this.recoveryStrategies.get(errorType) || {
      recover: () => ({
        canRecover: false,
        recoveredValue: null,
        strategy: 'NO_RECOVERY',
        warnings: ['No recovery strategy available']
      })
    };
  }

  private validateASTStructure(ast: ASTNode, errors: ExtractionError[]): void {
    if (!ast.type) {
      errors.push({
        type: ExtractionErrorType.UNSUPPORTED_SYNTAX,
        message: 'AST node missing type',
        location: { file: 'unknown', line: 0, column: 0, offset: 0, length: 0 },
        severity: 'critical'
      });
    }

    if (ast.children) {
      for (const child of ast.children) {
        this.validateASTStructure(child, errors);
      }
    }
  }

  private validateASTContent(ast: ASTNode, errors: ExtractionError[]): void {
    // Type casting for specific node types
    if (ast.type === 'declaration') {
      const declNode = ast as any;
      if (!declNode.property) {
        errors.push({
          type: ExtractionErrorType.INVALID_PROPERTY_VALUE,
          message: 'Declaration node missing property',
          location: { file: 'unknown', line: 0, column: 0, offset: 0, length: 0 },
          severity: 'warning'
        });
      }
    }
  }

  private generateWarnings(ast: ASTNode): string[] {
    const warnings: string[] = [];
    
    // Check for deprecated properties
    if (ast.type === 'declaration') {
      const declNode = ast as any;
      if (this.isDeprecatedProperty(declNode.property)) {
        warnings.push(`Deprecated property: ${declNode.property}`);
      }
    }

    return warnings;
  }

  private isDeprecatedProperty(property?: string): boolean {
    const deprecated = ['font-stretch', 'text-decoration-color'];
    return property ? deprecated.includes(property) : false;
  }

  private performSanitization(entry: Partial<TypographyEntry>): TypographyEntry {
    return {
      id: entry.id || 'unknown',
      selector: this.sanitizeSelector(entry.selector || ''),
      property: entry.property || '' as any,
      value: {
        original: this.sanitizeValue(entry.value?.original || ''),
        resolved: entry.value?.resolved || entry.value?.original || '',
        computed: entry.value?.computed
      },
      context: {
        file: 'unknown',
        location: entry.context?.location || { file: 'unknown', line: 0, column: 0, offset: 0, length: 0 },
        scope: entry.context?.scope || { currentScope: { type: 'global', variables: new Map() }, inheritedScopes: [] },
        specificity: entry.context?.specificity || 0,
        mediaQuery: entry.context?.mediaQuery,
        parentSelectors: entry.context?.parentSelectors || []
      },
      dependencies: entry.dependencies || {
        variables: [],
        mixins: [],
        imports: [],
        customProperties: []
      },
      metadata: entry.metadata || {
        isResponsive: false,
        hasVariables: false,
        hasFunctions: false,
        isInherited: false,
        overrides: []
      }
    };
  }

  private sanitizeSelector(selector: string): string {
    return selector.replace(/[<>'"]/g, '').trim();
  }

  private sanitizeValue(value: string): string {
    return value.replace(/javascript:|expression\(|@import/gi, '').trim();
  }

  private validateSanitizedEntry(entry: TypographyEntry): boolean {
    return !!(entry.selector && entry.property && entry.value.original);
  }
}

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle error during extraction with recovery
   */
  handleError(
    error: Error | ExtractionError,
    context: ErrorContext
  ): RecoveryResult {
    const extractionError = this.normalizeError(error, context);
    this.errorLog.push(extractionError);

    const strategy = this.getRecoveryStrategy(extractionError.type);
    return strategy.recover(extractionError, context);
  }

  /**
   * Validate AST before processing
   */
  validateAST(ast: ASTNode): ValidationResult {
    const errors: ExtractionError[] = [];
    
    try {
      this.validateASTStructure(ast, errors);
      this.validateASTContent(ast, errors);
    } catch (error) {
      errors.push(this.normalizeError(error as Error, {
        filePath: 'unknown',
        operation: 'AST_VALIDATION',
        astNode: ast
      }));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: this.generateWarnings(ast)
    };
  }

  /**
   * Sanitize typography entry
   */
  sanitizeEntry(entry: Partial<TypographyEntry>): TypographyEntry | null {
    try {
      const sanitized = this.performSanitization(entry);
      return this.validateSanitizedEntry(sanitized) ? sanitized : null;
    } catch (error) {
      this.handleError(error as Error, {
        filePath: 'unknown',
        operation: 'ENTRY_SANITIZATION',
        entry
      });
      return null;
    }
  }

  /**
   * Create safe fallback value
   */
  createFallbackValue(property: string, originalValue: string): string {
    const fallbacks: Record<string, string> = {
      'font-family': 'sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'line-height': '1.5',
      'letter-spacing': 'normal',
      'word-spacing': 'normal',
      'text-align': 'left',
      'text-decoration': 'none',
      'text-transform': 'none'
    };

    return fallbacks[property] || originalValue || 'inherit';
  }

  /**
   * Graceful degradation for complex values
   */
  degradeComplexValue(value: string, property: string): string {
    try {
      // Handle calc() functions
      if (value.includes('calc(')) {
        return this.simplifyCalcFunction(value, property);
      }

      // Handle custom properties
      if (value.includes('var(')) {
        return this.resolveCustomPropertyFallback(value, property);
      }

      // Handle complex font stacks
      if (property === 'font-family' && value.includes(',')) {
        return this.simplifyFontStack(value);
      }

      return value;
    } catch {
      return this.createFallbackValue(property, value);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: this.errorLog.length,
      errorsByType: new Map(),
      errorsByFile: new Map(),
      errorsByOperation: new Map(),
      criticalErrors: 0,
      warningErrors: 0,
      recoveredErrors: 0
    };

    for (const error of this.errorLog) {
      // By type
      const typeCount = stats.errorsByType.get(error.type) || 0;
      stats.errorsByType.set(error.type, typeCount + 1);

      // By file
      const fileCount = stats.errorsByFile.get(error.location?.source || 'unknown') || 0;
      stats.errorsByFile.set(error.location?.source || 'unknown', fileCount + 1);

      // By severity
      if (error.severity === 'critical') stats.criticalErrors++;
      else if (error.severity === 'warning') stats.warningErrors++;

      // Recovered
      if (error.recovered) stats.recoveredErrors++;
    }

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrors(): void {
    this.errorLog = [];
  }

  /**
   * Export error log
   */
  exportErrorLog(): ExtractionError[] {
    return [...this.errorLog];
  }

  private initializeRecoveryStrategies(): void {
    // Invalid property value recovery
    this.recoveryStrategies.set('INVALID_PROPERTY_VALUE', {
      recover: (error, context) => {
        const fallbackValue = this.createFallbackValue(
          error.property || 'unknown',
          error.value || ''
        );
        
        return {
          canRecover: true,
          recoveredValue: fallbackValue,
          strategy: 'FALLBACK_VALUE',
          warnings: [`Used fallback value '${fallbackValue}' for invalid '${error.property}' value`]
        };
      }
    });

    // Parse error recovery
    this.recoveryStrategies.set('PARSE_ERROR', {
      recover: (error, context) => {
        return {
          canRecover: true,
          recoveredValue: null,
          strategy: 'SKIP_INVALID_NODE',
          warnings: [`Skipped invalid AST node at ${error.location?.line}:${error.location?.column}`]
        };
      }
    });

    // Variable resolution error recovery
    this.recoveryStrategies.set('VARIABLE_RESOLUTION_ERROR', {
      recover: (error, context) => {
        const degradedValue = this.degradeComplexValue(
          error.value || '',
          error.property || ''
        );
        
        return {
          canRecover: true,
          recoveredValue: degradedValue,
          strategy: 'DEGRADE_COMPLEX_VALUE',
          warnings: [`Used degraded value '${degradedValue}' for unresolved variable`]
        };
      }
    });

    // Function evaluation error recovery
    this.recoveryStrategies.set('FUNCTION_EVALUATION_ERROR', {
      recover: (error, context) => {
        const simplifiedValue = this.simplifyFunctionValue(
          error.value || '',
          error.property || ''
        );
        
        return {
          canRecover: true,
          recoveredValue: simplifiedValue,
          strategy: 'SIMPLIFY_FUNCTION',
          warnings: [`Simplified function to '${simplifiedValue}'`]
        };
      }
    });

    // Timeout error recovery
    this.recoveryStrategies.set('TIMEOUT_ERROR', {
      recover: (error, context) => {
        return {
          canRecover: false,
          recoveredValue: null,
          strategy: 'ABORT_PROCESSING',
          warnings: ['Processing aborted due to timeout']
        };
      }
    });
  }

  private normalizeError(error: Error | ExtractionError, context: ErrorContext): ExtractionError {
    if (this.isExtractionError(error)) {
      return {
        ...error,
        context: context,
        timestamp: new Date(),
        severity: error.severity || 'warning'
      };
    }

    return {
      type: this.categorizeError(error),
      message: error.message,
      location: this.extractLocation(context),
      property: context.property,
      value: context.value,
      context: context,
      timestamp: new Date(),
      severity: 'warning',
      recovered: false
    };
  }

  private isExtractionError(error: any): error is ExtractionError {
    return error.type && error.message;
  }

  private categorizeError(error: Error): string {
    if (error.name === 'SyntaxError') return 'PARSE_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('variable')) return 'VARIABLE_RESOLUTION_ERROR';
    if (error.message.includes('function')) return 'FUNCTION_EVALUATION_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private extractLocation(context: ErrorContext): { line: number; column: number; index: number; source?: string } {
    if (context.astNode?.location) {
      return {
        line: context.astNode.location.line || 0,
        column: context.astNode.location.column || 0,
        index: context.astNode.location.index || 0,
        source: context.filePath
      };
    }

    return { line: 0, column: 0, index: 0, source: context.filePath };
  }

  private getRecoveryStrategy(errorType: string): RecoveryStrategy {
    return this.recoveryStrategies.get(errorType) || {
      recover: () => ({
        canRecover: false,
        recoveredValue: null,
        strategy: 'NO_RECOVERY',
        warnings: ['No recovery strategy available']
      })
    };
  }

  private validateASTStructure(ast: ASTNode, errors: ExtractionError[]): void {
    if (!ast.type) {
      errors.push({
        type: 'INVALID_AST_STRUCTURE',
        message: 'AST node missing type',
        location: { line: 0, column: 0, index: 0 },
        severity: 'critical'
      } as ExtractionError);
    }

    if (ast.children) {
      for (const child of ast.children) {
        this.validateASTStructure(child, errors);
      }
    }
  }

  private validateASTContent(ast: ASTNode, errors: ExtractionError[]): void {
    if (ast.type === 'DECLARATION' && !ast.property) {
      errors.push({
        type: 'INVALID_DECLARATION',
        message: 'Declaration node missing property',
        location: { line: 0, column: 0, index: 0 },
        property: ast.property,
        severity: 'warning'
      } as ExtractionError);
    }
  }

  private generateWarnings(ast: ASTNode): string[] {
    const warnings: string[] = [];
    
    // Check for deprecated properties
    if (ast.type === 'DECLARATION' && this.isDeprecatedProperty(ast.property)) {
      warnings.push(`Deprecated property: ${ast.property}`);
    }

    return warnings;
  }

  private isDeprecatedProperty(property?: string): boolean {
    const deprecated = ['font-stretch', 'text-decoration-color'];
    return property ? deprecated.includes(property) : false;
  }

  private performSanitization(entry: Partial<TypographyEntry>): TypographyEntry {
    return {
      selector: this.sanitizeSelector(entry.selector || ''),
      property: this.sanitizeProperty(entry.property || ''),
      value: {
        original: this.sanitizeValue(entry.value?.original || ''),
        resolved: entry.value?.resolved,
        computed: entry.value?.computed
      },
      context: {
        location: entry.context?.location || { line: 0, column: 0, index: 0 },
        parentRule: entry.context?.parentRule || null,
        mediaQuery: entry.context?.mediaQuery || null,
        declaration: entry.context?.declaration || null
      }
    };
  }

  private sanitizeSelector(selector: string): string {
    // Remove dangerous characters and normalize
    return selector.replace(/[<>'"]/g, '').trim();
  }

  private sanitizeProperty(property: string): string {
    // Validate CSS property name
    return property.replace(/[^a-z-]/gi, '').toLowerCase();
  }

  private sanitizeValue(value: string): string {
    // Remove potentially dangerous content
    return value.replace(/javascript:|expression\(|@import/gi, '').trim();
  }

  private validateSanitizedEntry(entry: TypographyEntry): boolean {
    return !!(entry.selector && entry.property && entry.value.original);
  }

  private simplifyCalcFunction(value: string, property: string): string {
    // Extract numeric values from calc() and provide reasonable fallback
    const match = value.match(/calc\(([^)]+)\)/);
    if (match) {
      const expr = match[1];
      // Simple evaluation for basic expressions
      if (/^\d+px\s*[+\-*/]\s*\d+px$/.test(expr)) {
        try {
          const result = eval(expr.replace(/px/g, ''));
          return `${result}px`;
        } catch {
          return this.createFallbackValue(property, value);
        }
      }
    }
    return this.createFallbackValue(property, value);
  }

  private resolveCustomPropertyFallback(value: string, property: string): string {
    // Extract fallback from var() function
    const match = value.match(/var\([^,]+,\s*([^)]+)\)/);
    if (match) {
      return match[1].trim();
    }
    return this.createFallbackValue(property, value);
  }

  private simplifyFontStack(value: string): string {
    // Return first valid font family from stack
    const fonts = value.split(',').map(f => f.trim().replace(/['"]/g, ''));
    return fonts[0] || 'sans-serif';
  }

  private simplifyFunctionValue(value: string, property: string): string {
    // Remove function calls and extract basic value
    const simplified = value.replace(/\w+\([^)]*\)/g, '');
    return simplified.trim() || this.createFallbackValue(property, value);
  }
}

/**
 * Error context interface
 */
export interface ErrorContext {
  filePath: string;
  operation: string;
  astNode?: ASTNode;
  entry?: Partial<TypographyEntry>;
  property?: string;
  value?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ExtractionError[];
  warnings: string[];
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  recover(error: ExtractionError, context: ErrorContext): RecoveryResult;
}

/**
 * Recovery result interface
 */
export interface RecoveryResult {
  canRecover: boolean;
  recoveredValue: any;
  strategy: string;
  warnings: string[];
}

/**
 * Error statistics interface
 */
export interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsByFile: Map<string, number>;
  errorsByOperation: Map<string, number>;
  criticalErrors: number;
  warningErrors: number;
  recoveredErrors: number;
}
