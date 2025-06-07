/**
 * Error handling classes for the Style Diff Engine
 * Provides specialized error types for different diff operation failures
 */

/**
 * Enumeration of possible diff error types
 */
export enum DiffErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR', 
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  INVALID_DIFF_OPTIONS = 'INVALID_DIFF_OPTIONS',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE'
}

/**
 * Base error class for all diff-related errors
 */
export class DiffError extends Error {
  public readonly type: DiffErrorType;
  public readonly filePath?: string;
  public readonly context?: any;
  
  constructor(type: DiffErrorType, message: string, filePath?: string, context?: any) {
    super(message);
    this.name = 'DiffError';
    this.type = type;
    this.filePath = filePath;
    this.context = context;
  }
}

/**
 * Error thrown when diff analysis times out or fails
 */
export class DiffAnalysisError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.ANALYSIS_TIMEOUT, message, filePath, context);
    this.name = 'DiffAnalysisError';
  }
}

/**
 * Error thrown when parsing SCSS/CSS files fails
 */
export class DiffParseError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.PARSE_ERROR, message, filePath, context);
    this.name = 'DiffParseError';
  }
}

/**
 * Error thrown when file operations fail
 */
export class DiffFileError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.FILE_NOT_FOUND, message, filePath, context);
    this.name = 'DiffFileError';
  }
}

/**
 * Error thrown when diff options are invalid
 */
export class DiffOptionsError extends DiffError {
  constructor(message: string, context?: any) {
    super(DiffErrorType.INVALID_DIFF_OPTIONS, message, undefined, context);
    this.name = 'DiffOptionsError';
  }
}

/**
 * Error thrown when memory limits are exceeded
 */
export class DiffMemoryError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.MEMORY_LIMIT_EXCEEDED, message, filePath, context);
    this.name = 'DiffMemoryError';
  }
}

/**
 * Error thrown when file type is not supported
 */
export class DiffUnsupportedFileError extends DiffError {
  constructor(message: string, filePath?: string, context?: any) {
    super(DiffErrorType.UNSUPPORTED_FILE_TYPE, message, filePath, context);
    this.name = 'DiffUnsupportedFileError';
  }
}
