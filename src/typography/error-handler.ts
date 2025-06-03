import { 
  ExtractionError, 
  TypographyEntry, 
  ExtractionErrorType,
  SourceLocation,
  ErrorContext,
  RecoveryStrategy,
  RecoveryResult,
  ValidationResult,
  ErrorStatistics,
  ASTNode
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
      const fileCount = stats.errorsByFile.get(error.location?.file || 'unknown') || 0;
      stats.errorsByFile.set(error.location?.file || 'unknown', fileCount + 1);

      // By operation - get from context
      const operation = error.context?.operation || 'unknown';
      const opCount = stats.errorsByOperation.get(operation) || 0;
      stats.errorsByOperation.set(operation, opCount + 1);

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
          strategy: 'fallback_value',
          warnings: [`Used fallback value '${fallbackValue}' for invalid property value`]
        };
      }
    });

    // Missing property recovery
    this.recoveryStrategies.set('MISSING_PROPERTY', {
      recover: (error, context) => {
        return {
          canRecover: false,
          recoveredValue: null,
          strategy: 'skip_entry',
          warnings: ['Skipped entry with missing property']
        };
      }
    });

    // Parse error recovery
    this.recoveryStrategies.set('PARSE_ERROR', {
      recover: (error, context) => {
        return {
          canRecover: false,
          recoveredValue: null,
          strategy: 'skip_section',
          warnings: ['Skipped section due to parse error']
        };
      }
    });

    // AST error recovery
    this.recoveryStrategies.set('AST_ERROR', {
      recover: (error, context) => {
        return {
          canRecover: false,
          recoveredValue: null,
          strategy: 'skip_file',
          warnings: ['Skipped file due to AST error']
        };
      }
    });

    // Import error recovery
    this.recoveryStrategies.set('IMPORT_ERROR', {
      recover: (error, context) => {
        return {
          canRecover: true,
          recoveredValue: '',
          strategy: 'ignore_import',
          warnings: ['Ignored failed import']
        };
      }
    });
  }

  private normalizeError(
    error: Error | ExtractionError,
    context: ErrorContext
  ): ExtractionError {
    if (this.isExtractionError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context }
      };
    }

    return {
      type: ExtractionErrorType.PARSE_ERROR,
      message: error.message,
      location: {
        file: context.filePath,
        line: 0,
        column: 0,
        offset: 0,
        length: 0
      },
      severity: 'error',
      context,
      timestamp: new Date()
    };
  }

  private isExtractionError(error: any): error is ExtractionError {
    return error && typeof error.type === 'string' && typeof error.message === 'string';
  }

  private getRecoveryStrategy(errorType: string): RecoveryStrategy {
    return this.recoveryStrategies.get(errorType) || {
      recover: () => ({
        canRecover: false,
        recoveredValue: null,
        strategy: 'default',
        warnings: ['No specific recovery strategy available']
      })
    };
  }

  private validateASTStructure(ast: ASTNode, errors: ExtractionError[]): void {
    if (!ast || typeof ast !== 'object') {
      errors.push({
        type: ExtractionErrorType.AST_ERROR,
        message: 'Invalid AST structure',
        location: { file: 'unknown', line: 0, column: 0, offset: 0, length: 0 },
        severity: 'critical'
      });
      return;
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
        computed: entry.value?.computed || undefined,
        fallbacks: entry.value?.fallbacks || []
      },
      context: {
        file: entry.context?.file || 'unknown',
        location: entry.context?.location || { file: 'unknown', line: 0, column: 0, offset: 0, length: 0 },
        scope: entry.context?.scope || { currentScope: { type: 'global', variables: new Map() }, inheritedScopes: [] },
        specificity: entry.context?.specificity || 0,
        mediaQuery: entry.context?.mediaQuery,
        parentSelectors: entry.context?.parentSelectors || []
      },
      dependencies: {
        variables: entry.dependencies?.variables || [],
        mixins: entry.dependencies?.mixins || [],
        imports: entry.dependencies?.imports || [],
        customProperties: entry.dependencies?.customProperties || []
      },
      metadata: {
        isResponsive: entry.metadata?.isResponsive || false,
        hasVariables: entry.metadata?.hasVariables || false,
        hasFunctions: entry.metadata?.hasFunctions || false,
        isInherited: entry.metadata?.isInherited || false,
        overrides: entry.metadata?.overrides || []
      }
    };
  }

  private sanitizeSelector(selector: string): string {
    return selector.trim().replace(/[^\w\-.:#+\s>~\[\]()="']/g, '');
  }

  private sanitizeValue(value: string): string {
    return value.trim().replace(/[<>]/g, '');
  }

  private validateSanitizedEntry(entry: TypographyEntry): boolean {
    return !!(entry.id && entry.selector && entry.property && entry.value?.original);
  }

  private simplifyCalcFunction(value: string, property: string): string {
    // Simple calc() simplification - extract first numeric value
    const match = value.match(/calc\(([^)]+)\)/);
    if (match) {
      const expression = match[1];
      const numberMatch = expression.match(/(\d+(?:\.\d+)?)(px|em|rem|%)/);
      if (numberMatch) {
        return numberMatch[0];
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
    // Return first font in the stack
    const fonts = value.split(',');
    return fonts[0].trim().replace(/['"]/g, '');
  }
}

// Re-export types for convenience
export { ValidationResult, ErrorStatistics } from './types';
