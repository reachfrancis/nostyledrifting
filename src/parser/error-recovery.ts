
import { SourceLocation } from './ast-nodes';

export enum ParseErrorType {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  SEMANTIC_ERROR = 'SEMANTIC_ERROR',
  IMPORT_ERROR = 'IMPORT_ERROR',
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
  STYLE_GUIDE_VIOLATION = 'STYLE_GUIDE_VIOLATION',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MISSING_IMPORT = 'MISSING_IMPORT',
  INVALID_PATH = 'INVALID_PATH',
  MALFORMED_SELECTOR = 'MALFORMED_SELECTOR',
  UNCLOSED_BLOCK = 'UNCLOSED_BLOCK',
  INVALID_PROPERTY_VALUE = 'INVALID_PROPERTY_VALUE',
  UNDEFINED_VARIABLE = 'UNDEFINED_VARIABLE',
  MISSING_MIXIN = 'MISSING_MIXIN',
  DEEP_NESTING = 'DEEP_NESTING',
  LARGE_FILE_SIZE = 'LARGE_FILE_SIZE',
  COMPLEX_SELECTOR = 'COMPLEX_SELECTOR'
}

export enum ParseErrorSeverity {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface ParseError {
  type: ParseErrorType;
  severity: ParseErrorSeverity;
  message: string;
  location: SourceLocation;
  filePath: string;
  recoveryAction?: string;
  suggestion?: string;
  details?: any;
  canRecover: boolean;
}

export interface ParseWarning {
  type: ParseErrorType;
  message: string;
  location: SourceLocation;
  filePath: string;
  suggestion?: string;
  autofix?: boolean;
}

export interface RecoveryContext {
  currentPosition: number;
  content: string;
  errors: ParseError[];
  warnings: ParseWarning[];
  filePath: string;
}

export class ErrorRecoverySystem {
  private static readonly MAX_RECOVERY_ATTEMPTS = 10;
  private static readonly RECOVERY_SKIP_CHARS = ['\n', '}', ';'];

  public static createError(
    type: ParseErrorType,
    severity: ParseErrorSeverity,
    message: string,
    location: SourceLocation,
    filePath: string,
    recoveryAction?: string,
    suggestion?: string,
    details?: any
  ): ParseError {
    return {
      type,
      severity,
      message,
      location,
      filePath,
      recoveryAction,
      suggestion,
      details,
      canRecover: severity !== ParseErrorSeverity.FATAL
    };
  }

  public static createWarning(
    type: ParseErrorType,
    message: string,
    location: SourceLocation,
    filePath: string,
    suggestion?: string,
    autofix?: boolean
  ): ParseWarning {
    return {
      type,
      message,
      location,
      filePath,
      suggestion,
      autofix
    };
  }

  public static recoverFromSyntaxError(context: RecoveryContext): number {
    const { currentPosition, content } = context;
    let newPosition = currentPosition;
    let attempts = 0;

    while (newPosition < content.length && attempts < this.MAX_RECOVERY_ATTEMPTS) {
      const char = content[newPosition];
      
      if (this.RECOVERY_SKIP_CHARS.includes(char)) {
        // Found a recovery point
        return newPosition + 1;
      }
      
      newPosition++;
      attempts++;
    }

    // If we can't find a recovery point, skip to the next line
    const nextNewline = content.indexOf('\n', currentPosition);
    return nextNewline !== -1 ? nextNewline + 1 : content.length;
  }

  public static recoverFromUnclosedBlock(context: RecoveryContext): number {
    const { currentPosition, content } = context;
    let braceCount = 1;
    let position = currentPosition;

    while (position < content.length && braceCount > 0) {
      const char = content[position];
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
      
      position++;
    }

    return position;
  }

  public static skipToNextStablePoint(context: RecoveryContext): number {
    const { currentPosition, content } = context;
    const stablePatterns = [
      /^\s*[\w-]+\s*:/m,  // Property declaration
      /^\s*[\w-]+\s*\{/m, // Selector with opening brace
      /^\s*@[\w-]+/m,     // At-rule
      /^\s*\/\*/m,        // Comment start
      /^\s*\$[\w-]+\s*:/m // Variable declaration
    ];

    let position = currentPosition;
    
    while (position < content.length) {
      const remaining = content.slice(position);
      
      for (const pattern of stablePatterns) {
        if (pattern.test(remaining)) {
          return position;
        }
      }
      
      // Move to next line
      const nextNewline = content.indexOf('\n', position);
      if (nextNewline === -1) {
        return content.length;
      }
      
      position = nextNewline + 1;
    }

    return content.length;
  }

  public static validateComplexity(
    nestingDepth: number,
    selectorComplexity: number,
    fileSize: number,
    location: SourceLocation,
    filePath: string
  ): ParseWarning[] {
    const warnings: ParseWarning[] = [];

    if (nestingDepth > 6) {
      warnings.push(this.createWarning(
        ParseErrorType.DEEP_NESTING,
        `Deep nesting detected (${nestingDepth} levels). Consider refactoring for better maintainability.`,
        location,
        filePath,
        'Reduce nesting depth to 6 or fewer levels'
      ));
    }

    if (selectorComplexity > 4) {
      warnings.push(this.createWarning(
        ParseErrorType.COMPLEX_SELECTOR,
        `Complex selector detected (complexity: ${selectorComplexity}). Consider simplifying.`,
        location,
        filePath,
        'Simplify selector or split into multiple rules'
      ));
    }

    if (fileSize > 1024 * 1024) { // 1MB
      warnings.push(this.createWarning(
        ParseErrorType.LARGE_FILE_SIZE,
        `Large file size detected (${Math.round(fileSize / 1024)}KB). Consider splitting into smaller files.`,
        location,
        filePath,
        'Split large files into smaller, more focused modules'
      ));
    }

    return warnings;
  }

  public static getRecoveryStrategy(errorType: ParseErrorType): string {
    switch (errorType) {
      case ParseErrorType.UNCLOSED_BLOCK:
        return 'Skip to next closing brace or stable parsing point';
      case ParseErrorType.MALFORMED_SELECTOR:
        return 'Skip to next property declaration or rule';
      case ParseErrorType.INVALID_PROPERTY_VALUE:
        return 'Skip to next semicolon or declaration';
      case ParseErrorType.UNDEFINED_VARIABLE:
        return 'Create placeholder variable and continue parsing';
      case ParseErrorType.MISSING_MIXIN:
        return 'Create placeholder mixin and continue parsing';
      case ParseErrorType.CIRCULAR_DEPENDENCY:
        return 'Break circular reference and continue parsing';
      default:
        return 'Skip to next stable parsing point';
    }
  }

  public static createLocationFromOffset(
    content: string,
    offset: number,
    length: number,
    filePath: string
  ): SourceLocation {
    const lines = content.slice(0, offset).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    // Get context lines (2 before, current, 2 after)
    const allLines = content.split('\n');
    const currentLineIndex = line - 1;
    const contextStart = Math.max(0, currentLineIndex - 2);
    const contextEnd = Math.min(allLines.length, currentLineIndex + 3);
    const context = allLines.slice(contextStart, contextEnd);

    return {
      file: filePath,
      line,
      column,
      offset,
      length,
      context
    };
  }
}
