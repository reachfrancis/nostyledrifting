import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

import {
  SCSSNode,
  RootNode,
  RuleNode,
  DeclarationNode,
  CommentNode,
  AtRuleNode,
  ImportNode,
  ImportStatementNode,
  UseStatementNode,
  SourceLocation
} from './ast-nodes';

import { 
  ErrorRecoverySystem, 
  ParseError, 
  ParseWarning, 
  ParseErrorType,
  ParseErrorSeverity
} from './error-recovery';

import { ParseResult as CacheParseResult } from './cache';
import { ComplexityAnalyzer } from './complexity';

/**
 * Parser configuration options
 */
export interface ParserConfig {
  enableErrorRecovery?: boolean;
  maxParseAttempts?: number;
  enableCaching?: boolean;
  cacheSize?: number;
  enableComplexityAnalysis?: boolean;
  timeoutMs?: number;
  enableVerboseLogging?: boolean;
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  type: string;
  path: string;
  resolvedPath: string;
  line: number;
  column: number;
}

/**
 * Parse result for the parser engine
 */
export interface ParseResult {
  ast: SCSSNode | null;
  metadata: {
    filePath: string;
    fileSize: number;
    lastModified: Date;
    hash: string;
    parseTime: number;
    lineCount: number;
  };
  errors: ParseError[];
  warnings: ParseWarning[];
  dependencies: DependencyInfo[];
  complexity: {
    score: number;
    details: Record<string, number>;
  };
  cacheInfo: {
    cacheHit: boolean;
    cacheLevel: 'none' | 'l1' | 'l2';
  };
}

/**
 * Production-grade SCSS parser engine
 */
export class SCSSParserEngine {
  private postcssProcessor: postcss.Processor;
  private complexityAnalyzer: ComplexityAnalyzer;
  private config: ParserConfig;

  constructor(config: ParserConfig = {}) {
    this.config = {
      enableErrorRecovery: true,
      maxParseAttempts: 3,
      enableCaching: true,
      cacheSize: 1000,
      enableComplexityAnalysis: true,
      timeoutMs: 30000,
      enableVerboseLogging: false,
      ...config
    };    // Initialize PostCSS processor
    this.postcssProcessor = postcss();
    this.complexityAnalyzer = new ComplexityAnalyzer();
  }

  /**
   * Main parsing method
   */
  public async parseFile(filePath: string): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      // Read file content
      const fileContent = await this.readFileContent(filePath);
      
      // Attempt parsing
      const parseResult = await this.attemptParsing(filePath, fileContent);
      
      // Update performance metrics
      const endTime = Date.now();
      parseResult.metadata.parseTime = endTime - startTime;

      return parseResult;

    } catch (error) {
      return this.createErrorResult(filePath, error, Date.now() - startTime);
    }
  }

  /**
   * Attempt primary parsing with PostCSS
   */
  private async attemptParsing(filePath: string, content: string): Promise<ParseResult> {
    try {
      const postcssResult = await this.postcssProcessor.process(content, {
        from: filePath,
        syntax: postcssScss
      });

      const ast = this.convertPostCSSToAST(postcssResult.root, filePath);
      const dependencies: DependencyInfo[] = [];
      
      // Extract dependencies
      this.extractDependencies(ast, dependencies, filePath);

      // Analyze complexity
      const complexity = this.config.enableComplexityAnalysis
        ? { score: this.calculateComplexityScore(ast), details: {} }
        : { score: 0, details: {} };

      return {
        ast,
        metadata: {
          filePath,
          fileSize: Buffer.byteLength(content, 'utf8'),
          lastModified: new Date(),
          hash: this.generateHash(content),
          parseTime: 0, // Will be set later
          lineCount: content.split('\n').length
        },
        errors: [],
        warnings: [],
        dependencies,
        complexity,
        cacheInfo: {
          cacheHit: false,
          cacheLevel: 'none'
        }
      };
    } catch (error) {
      if (this.config.enableErrorRecovery) {
        return this.attemptErrorRecovery(filePath, content, error);
      }
      throw error;
    }
  }

  /**
   * Convert PostCSS AST to our custom SCSS AST
   */
  private convertPostCSSToAST(postcssNode: postcss.Node, filePath: string): SCSSNode {
    const location = this.createSourceLocation(postcssNode, filePath);

    switch (postcssNode.type) {
      case 'root':
        const root = new RootNode(location);
        if ('nodes' in postcssNode && Array.isArray((postcssNode as any).nodes)) {
          for (const child of (postcssNode as any).nodes) {
            root.addChild(this.convertPostCSSToAST(child, filePath));
          }
        }
        return root;

      case 'rule':
        const rule = new RuleNode((postcssNode as postcss.Rule).selector, location);
        if ('nodes' in postcssNode && Array.isArray((postcssNode as any).nodes)) {
          for (const child of (postcssNode as any).nodes) {
            rule.addChild(this.convertPostCSSToAST(child, filePath));
          }
        }
        return rule;      case 'decl':
        const decl = postcssNode as postcss.Declaration;
        return new DeclarationNode(decl.prop, decl.value, !!decl.important, location);      case 'comment':
        const comment = postcssNode as postcss.Comment;
        return new CommentNode(comment.text, false, location);

      case 'atrule':
        return this.convertAtRule(postcssNode as postcss.AtRule, filePath, location);

      default:
        // Handle unknown node types gracefully
        const unknown = new RootNode(location);
        if ('nodes' in postcssNode && Array.isArray((postcssNode as any).nodes)) {
          for (const child of (postcssNode as any).nodes) {
            unknown.addChild(this.convertPostCSSToAST(child, filePath));
          }
        }
        return unknown;
    }
  }

  /**
   * Convert PostCSS at-rule to appropriate SCSS node
   */
  private convertAtRule(atRule: postcss.AtRule, filePath: string, location: SourceLocation): SCSSNode {
    const name = atRule.name;
    const params = atRule.params;    // For now, treat import-like rules as ImportNode and others as AtRuleNode
    if (['import', 'use', 'forward'].includes(name)) {
      // Create appropriate import node based on type
      if (name === 'import') {
        return new ImportStatementNode(params, location);
      } else if (name === 'use') {
        return new UseStatementNode(params, undefined, undefined, location);
      } else {
        // For 'forward' and other import-like statements, use ImportStatementNode
        return new ImportStatementNode(params, location);
      }
    }

    // Generic at-rule
    const atRuleNode = new AtRuleNode(name, params, location);
    if (atRule.nodes && Array.isArray(atRule.nodes)) {
      for (const child of atRule.nodes) {
        atRuleNode.addChild(this.convertPostCSSToAST(child, filePath));
      }
    }
    return atRuleNode;
  }

  /**
   * Create source location from PostCSS node
   */
  private createSourceLocation(postcssNode: postcss.Node, filePath: string): SourceLocation {
    const start = postcssNode.source?.start || { line: 1, column: 1 };

    return {
      file: filePath,
      line: start.line,
      column: start.column,
      offset: 0, // PostCSS doesn't provide offset
      length: 0  // Would need to calculate
    };
  }

  /**
   * Extract dependencies from AST
   */
  private extractDependencies(
    ast: SCSSNode | null,
    dependencies: DependencyInfo[],
    filePath: string
  ): void {
    if (!ast) return;

    ast.walkChildren((node) => {
      if (node instanceof ImportNode) {
        dependencies.push({
          type: 'import',
          path: node.path,
          resolvedPath: this.resolvePath(node.path, filePath),
          line: node.location.line,
          column: node.location.column
        });
      }
    });
  }

  /**
   * Calculate complexity score for AST
   */
  private calculateComplexityScore(ast: SCSSNode | null): number {
    if (!ast) return 0;
    
    let score = 0;
    ast.walkChildren(() => {
      score++;
    });
    
    return score;
  }

  /**
   * Resolve import path relative to current file
   */
  private resolvePath(importPath: string, fromFile: string): string {
    if (path.isAbsolute(importPath)) {
      return importPath;
    }
    
    const dir = path.dirname(fromFile);
    return path.resolve(dir, importPath);
  }

  /**
   * Generate hash for content
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Read file content with error handling
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Attempt error recovery when primary parsing fails
   */
  private async attemptErrorRecovery(
    filePath: string,
    content: string,
    originalError: any
  ): Promise<ParseResult> {
    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];

    // Create error location
    const location = ErrorRecoverySystem.createLocationFromOffset(content, 0, 0, filePath);    // Add the original parsing error
    errors.push(ErrorRecoverySystem.createError(
      ParseErrorType.SYNTAX_ERROR,
      ParseErrorSeverity.ERROR,
      `Parse error: ${originalError.message}`,
      location,
      filePath,
      'Skip malformed content',
      'Check SCSS syntax',
      { recoverable: true }
    ));

    // Create minimal AST for error recovery
    const ast = new RootNode(location);

    return {
      ast,
      metadata: {
        filePath,
        fileSize: Buffer.byteLength(content, 'utf8'),
        lastModified: new Date(),
        hash: this.generateHash(content),
        parseTime: 0,
        lineCount: content.split('\n').length
      },
      errors,
      warnings,
      dependencies: [],
      complexity: { score: 0, details: {} },
      cacheInfo: {
        cacheHit: false,
        cacheLevel: 'none'
      }
    };
  }

  /**
   * Create error result when all parsing attempts fail
   */
  private createErrorResult(
    filePath: string,
    error: any,
    parseTime: number
  ): ParseResult {
    const location = ErrorRecoverySystem.createLocationFromOffset('', 0, 0, filePath);

    return {
      ast: null,
      metadata: {
        filePath,
        fileSize: 0,
        lastModified: new Date(),
        hash: '',
        parseTime,
        lineCount: 0
      },      errors: [
        ErrorRecoverySystem.createError(
          ParseErrorType.SYNTAX_ERROR,
          ParseErrorSeverity.FATAL,
          `Critical parse error: ${error.message}`,
          location,
          filePath,
          'Unable to recover',
          'Check file syntax',
          { recoverable: false }
        )
      ],
      warnings: [],
      dependencies: [],
      complexity: { score: 0, details: {} },
      cacheInfo: {
        cacheHit: false,
        cacheLevel: 'none'
      }
    };
  }
}

