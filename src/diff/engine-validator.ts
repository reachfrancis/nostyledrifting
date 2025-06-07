import { StyleDiffOptions, DiffValidationResult, DiffComparison, DiffAnalysisMode } from './types';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Validates inputs and operations for the Style Diff Engine
 */
export class EngineValidator {
  
  /**
   * Validate file access and content for comparison
   */
  public static async validateFiles(file1: string, file2: string): Promise<DiffValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    

    try {
      // Check if files exist and are accessible
      const [stat1, stat2] = await Promise.all([
        this.validateFileAccess(file1),
        this.validateFileAccess(file2)
      ]);

      if (!stat1.exists) {
        errors.push(`File does not exist: ${file1}`);
      } else if (!stat1.readable) {
        errors.push(`File is not readable: ${file1}`);
      } else if (stat1.isDirectory) {
        errors.push(`Path is a directory, not a file: ${file1}`);
      }

      if (!stat2.exists) {
        errors.push(`File does not exist: ${file2}`);
      } else if (!stat2.readable) {
        errors.push(`File is not readable: ${file2}`);
      } else if (stat2.isDirectory) {
        errors.push(`Path is a directory, not a file: ${file2}`);
      }

      // Check file extensions
      if (stat1.exists && stat2.exists) {
        const ext1 = path.extname(file1).toLowerCase();
        const ext2 = path.extname(file2).toLowerCase();

        if (!this.isSupportedExtension(ext1)) {
          warnings.push(`File type may not be supported: ${ext1} (${file1})`);
        }
        if (!this.isSupportedExtension(ext2)) {
          warnings.push(`File type may not be supported: ${ext2} (${file2})`);
        }

        if (ext1 !== ext2) {
          warnings.push(`Files have different extensions: ${ext1} vs ${ext2}`);
        }
      }

      // Check file sizes
      if (stat1.exists && stat1.size > 10 * 1024 * 1024) { // 10MB
        warnings.push(`Large file may impact performance: ${file1} (${this.formatBytes(stat1.size)})`);
        
      }
      if (stat2.exists && stat2.size > 10 * 1024 * 1024) { // 10MB
        warnings.push(`Large file may impact performance: ${file2} (${this.formatBytes(stat2.size)})`);
        
      }

      // Validate file contents if accessible
      if (stat1.exists && stat1.readable && stat2.exists && stat2.readable) {
        try {
          const [content1, content2] = await Promise.all([
            fs.readFile(file1, 'utf-8'),
            fs.readFile(file2, 'utf-8')
          ]);

          const contentValidation = await this.validateContent(content1, content2);
          errors.push(...contentValidation.errors);
          warnings.push(...contentValidation.warnings);
          

        } catch (error) {
          warnings.push(`Could not read file contents for validation: ${(error as Error).message}`);
        }
      }    } catch (error) {
      errors.push(`File validation failed: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate SCSS content strings
   */
  public static async validateContent(content1: string, content2: string): Promise<DiffValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    

    // Basic content validation
    if (typeof content1 !== 'string') {
      errors.push('First content parameter must be a string');
    }
    if (typeof content2 !== 'string') {
      errors.push('Second content parameter must be a string');
    }

    if (content1.length === 0 && content2.length === 0) {
      warnings.push('Both content strings are empty');
    }

    // Check for extremely large content
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (content1.length > maxSize) {
      warnings.push(`First content is very large (${this.formatBytes(content1.length)})`);
      
    }
    if (content2.length > maxSize) {
      warnings.push(`Second content is very large (${this.formatBytes(content2.length)})`);
      
    }

    // Validate SCSS syntax (basic check)
    const syntax1 = await this.validateScssContent(content1);
    const syntax2 = await this.validateScssContent(content2);

    if (!syntax1.valid) {
      warnings.push(`First content may have SCSS syntax issues: ${syntax1.errors.join(', ')}`);
    }
    if (!syntax2.valid) {
      warnings.push(`Second content may have SCSS syntax issues: ${syntax2.errors.join(', ')}`);
    }

    // Check for binary content
    if (this.containsBinaryData(content1)) {
      errors.push('First content appears to contain binary data');
    }
    if (this.containsBinaryData(content2)) {
      errors.push('Second content appears to contain binary data');
    }

    // Check character encoding issues
    if (this.hasEncodingIssues(content1)) {
      warnings.push('First content may have character encoding issues');
    }
    if (this.hasEncodingIssues(content2)) {
      warnings.push('Second content may have character encoding issues');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      
    };
  }

  /**
   * Validate diff options
   */
  public static validateOptions(options: StyleDiffOptions): DiffValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    

    if (!options) {
      errors.push('Options object is required');
      return { valid: false, errors, warnings };
    }    // Validate analysis mode
    if (options.analysisMode && !Object.values(DiffAnalysisMode).includes(options.analysisMode)) {
      errors.push(`Invalid analysis mode: ${options.analysisMode}`);
    }

    // Validate context depth
    if (options.contextLines !== undefined) {
      if (typeof options.contextLines !== 'number' || options.contextLines < 0) {
        errors.push('Context depth must be a non-negative number');
      } else if (options.contextLines > 20) {
        warnings.push('High context depth may impact performance');
        
      }
    }    // Validate performance options
    // Note: timeout property removed from interface
    
    // Validate boolean options
    const booleanOptions = [
      'includeVariables', 'includeImports', 'ignoreWhitespace', 
      'ignoreComments', 'enableCaching', 'strictMode'
    ];

    booleanOptions.forEach(option => {
      if (options.hasOwnProperty(option) && typeof (options as any)[option] !== 'boolean') {
        errors.push(`${option} must be a boolean value`);
      }
    });    // Validate file paths - removed as they're not part of StyleDiffOptions
    // File paths are handled through DiffComparison interface instead    // Logical validation
    if (options.ignoreWhitespace && options.analysisMode === DiffAnalysisMode.SEMANTIC) {
      warnings.push('Ignoring whitespace in semantic mode may affect semantic analysis');
    }

    if (options.strictMode && options.analysisMode === DiffAnalysisMode.TEXT) {
      // Note: Logical validation for strict mode with text analysis
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      
    };
  }
  /**
   * Validate batch comparison operation
   */
  public validateBatchOperation(comparisons: DiffComparison[]): DiffValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    

    if (!Array.isArray(comparisons)) {
      errors.push('Comparisons must be an array');
      return { valid: false, errors, warnings };
    }

    if (comparisons.length === 0) {
      warnings.push('No comparisons to perform');
    }

    if (comparisons.length > 1000) {
      warnings.push(`Large batch size (${comparisons.length}) may impact performance`);
      
    }    // Validate each comparison
    comparisons.forEach((comparison, index) => {
      switch (comparison.type) {
        case 'files':
          if (!comparison.file1 || !comparison.file2) {
            errors.push(`Comparison ${index}: file1 and file2 are required for file comparison`);
          }
          break;

        case 'content':
          if (!comparison.content1 || !comparison.content2) {
            errors.push(`Comparison ${index}: content1 and content2 are required for content comparison`);
          }
          break;

        case 'branch-files':
          if (!comparison.branch1 || !comparison.branch2 || !comparison.filePath) {
            errors.push(`Comparison ${index}: branch1, branch2, and filePath are required for branch comparison`);
          }
          break;

        default:
          errors.push(`Comparison ${index}: unknown comparison type: ${(comparison as any).type}`);
      }

      // Validate options if provided
      if (comparison.options) {
        const optionValidation = EngineValidator.validateOptions(comparison.options);
        if (!optionValidation.valid) {
          errors.push(`Comparison ${index} options: ${optionValidation.errors.join(', ')}`);
        }
      }
    });

    // Check for duplicate comparisons
    const uniqueComparisons = new Set();
    comparisons.forEach((comparison, index) => {
      const key = EngineValidator.getComparisonKey(comparison);
      if (uniqueComparisons.has(key)) {
        warnings.push(`Comparison ${index}: duplicate comparison detected`);
      } else {
        uniqueComparisons.add(key);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      
    };
  }

  // Private helper methods

  private static async validateFileAccess(filePath: string): Promise<{
    exists: boolean;
    readable: boolean;
    isDirectory: boolean;
    size: number;
  }> {
    try {
      const stat = await fs.stat(filePath);
      const readable = await fs.access(filePath, fs.constants.R_OK).then(() => true).catch(() => false);

      return {
        exists: true,
        readable,
        isDirectory: stat.isDirectory(),
        size: stat.size
      };
    } catch (error) {
      return {
        exists: false,
        readable: false,
        isDirectory: false,
        size: 0
      };
    }
  }

  private static isSupportedExtension(ext: string): boolean {
    const supportedExtensions = ['.scss', '.sass', '.css'];
    return supportedExtensions.includes(ext.toLowerCase());
  }

  private static async validateScssContent(content: string): Promise<DiffValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    

    // Basic SCSS syntax checks
    const lines = content.split('\n');
    let braceDepth = 0;
    let inComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : '';

        // Handle string literals
        if (!inComment && (char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
          continue;
        }

        if (inString) continue;

        // Handle comments
        if (char === '/' && j < line.length - 1) {
          const nextChar = line[j + 1];
          if (nextChar === '*') {
            inComment = true;
            j++; // Skip next character
            continue;
          }
          if (nextChar === '/') {
            break; // Rest of line is comment
          }
        }

        if (inComment && char === '*' && j < line.length - 1 && line[j + 1] === '/') {
          inComment = false;
          j++; // Skip next character
          continue;
        }

        if (inComment) continue;

        // Count braces
        if (char === '{') {
          braceDepth++;
        } else if (char === '}') {
          braceDepth--;
          if (braceDepth < 0) {
            errors.push(`Line ${i + 1}: Unexpected closing brace`);
          }
        }
      }
    }

    if (braceDepth > 0) {
      errors.push(`Missing ${braceDepth} closing brace(s)`);
    }

    if (inComment) {
      warnings.push('Unclosed block comment at end of file');
    }

    // Check for common SCSS patterns
    if (content.includes('@import') && !content.includes(';')) {
      warnings.push('@import statements should end with semicolons');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      
    };
  }

  private static containsBinaryData(content: string): boolean {
    // Check for null bytes or other binary indicators
    return content.includes('\0') || /[\x00-\x08\x0E-\x1F\x7F]/.test(content);
  }

  private static hasEncodingIssues(content: string): boolean {
    // Check for common encoding issue patterns
    return /�/.test(content) || /\uFFFD/.test(content);
  }

  private static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  private static getComparisonKey(comparison: DiffComparison): string {
    switch (comparison.type) {
      case 'files':
        return `files:${comparison.file1}:${comparison.file2}`;
      case 'content':
        // Use hash for content to avoid storing large strings
        const hash1 = this.simpleHash(comparison.content1 || '');
        const hash2 = this.simpleHash(comparison.content2 || '');
        return `content:${hash1}:${hash2}`;
      case 'branch-files':
        return `branch:${comparison.branch1}:${comparison.branch2}:${comparison.filePath}`;
      default:
        return `unknown:${JSON.stringify(comparison)}`;
    }
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}
