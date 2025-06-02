
import { SCSSNode, RuleNode, VariableNode, MixinNode, FunctionNode, ImportNode, ComplexityMetrics } from './ast-nodes';

export class ComplexityAnalyzer {
  public static analyzeAST(ast: SCSSNode): ComplexityMetrics {
    const analyzer = new ComplexityAnalyzer();
    return analyzer.analyze(ast);
  }

  private metrics: ComplexityMetrics = {
    nestingDepth: 0,
    selectorComplexity: 0,
    variableCount: 0,
    mixinCount: 0,
    importCount: 0,
    functionCount: 0,
    totalNodes: 0
  };

  private analyze(node: SCSSNode): ComplexityMetrics {
    this.walkNode(node, 0);
    return this.metrics;
  }

  private walkNode(node: SCSSNode, depth: number): void {
    this.metrics.totalNodes++;
    this.metrics.nestingDepth = Math.max(this.metrics.nestingDepth, depth);

    switch (node.type) {
      case 'rule':
        this.analyzeRule(node as RuleNode);
        break;
      case 'variable':
        this.metrics.variableCount++;
        break;
      case 'mixin':
        this.metrics.mixinCount++;
        break;
      case 'function':
        this.metrics.functionCount++;
        break;
      case 'import':
      case 'use':
      case 'forward':
        this.metrics.importCount++;
        break;
    }

    // Recursively analyze children
    for (const child of node.children) {
      const nextDepth = this.isNestingNode(node) ? depth + 1 : depth;
      this.walkNode(child, nextDepth);
    }
  }

  private analyzeRule(rule: RuleNode): void {
    const complexity = this.calculateSelectorComplexity(rule.selector);
    this.metrics.selectorComplexity = Math.max(this.metrics.selectorComplexity, complexity);
  }

  private calculateSelectorComplexity(selector: string): number {
    if (!selector) return 0;

    let complexity = 0;
    
    // Base complexity for each selector part
    const parts = selector.split(',').map(s => s.trim());
    complexity += parts.length;

    for (const part of parts) {
      // Descendant selectors (spaces)
      const descendants = part.split(/\s+/).length - 1;
      complexity += descendants;

      // Child selectors (>)
      const children = (part.match(/>/g) || []).length;
      complexity += children * 2;

      // Adjacent sibling selectors (+)
      const adjacentSiblings = (part.match(/\+/g) || []).length;
      complexity += adjacentSiblings * 2;

      // General sibling selectors (~)
      const generalSiblings = (part.match(/~/g) || []).length;
      complexity += generalSiblings * 2;

      // Attribute selectors
      const attributes = (part.match(/\[.*?\]/g) || []).length;
      complexity += attributes * 2;

      // Pseudo-classes and pseudo-elements
      const pseudos = (part.match(/:+[\w-]+/g) || []).length;
      complexity += pseudos;

      // ID selectors
      const ids = (part.match(/#[\w-]+/g) || []).length;
      complexity += ids;

      // Class selectors
      const classes = (part.match(/\.[\w-]+/g) || []).length;
      complexity += classes;

      // Universal selector
      if (part.includes('*')) {
        complexity += 1;
      }
    }

    return complexity;
  }

  private isNestingNode(node: SCSSNode): boolean {
    return node.type === 'rule' || node.type === 'atrule' || node.type === 'mixin';
  }
}

export class PerformanceMetrics {
  private startTime: number = 0;
  private endTime: number = 0;
  private memoryStart: number = 0;
  private memoryEnd: number = 0;

  public startMeasurement(): void {
    this.startTime = Date.now();
    if (process.memoryUsage) {
      this.memoryStart = process.memoryUsage().heapUsed;
    }
  }

  public endMeasurement(): void {
    this.endTime = Date.now();
    if (process.memoryUsage) {
      this.memoryEnd = process.memoryUsage().heapUsed;
    }
  }

  public getParseTime(): number {
    return this.endTime - this.startTime;
  }

  public getMemoryUsage(): number {
    return this.memoryEnd - this.memoryStart;
  }

  public getMetrics(): { parseTime: number; memoryUsage: number } {
    return {
      parseTime: this.getParseTime(),
      memoryUsage: this.getMemoryUsage()
    };
  }
}

export interface ParseStatistics {
  parseTime: number;
  memoryUsage: number;
  nodeCount: number;
  errorCount: number;
  warningCount: number;
  cacheHit: boolean;
  fileSize: number;
  complexity: ComplexityMetrics;
}

export class StatisticsCollector {
  private statistics: ParseStatistics;

  constructor() {
    this.statistics = {
      parseTime: 0,
      memoryUsage: 0,
      nodeCount: 0,
      errorCount: 0,
      warningCount: 0,
      cacheHit: false,
      fileSize: 0,
      complexity: {
        nestingDepth: 0,
        selectorComplexity: 0,
        variableCount: 0,
        mixinCount: 0,
        importCount: 0,
        functionCount: 0,
        totalNodes: 0
      }
    };
  }

  public setParseTime(time: number): void {
    this.statistics.parseTime = time;
  }

  public setMemoryUsage(usage: number): void {
    this.statistics.memoryUsage = usage;
  }

  public setNodeCount(count: number): void {
    this.statistics.nodeCount = count;
  }

  public setErrorCount(count: number): void {
    this.statistics.errorCount = count;
  }

  public setWarningCount(count: number): void {
    this.statistics.warningCount = count;
  }

  public setCacheHit(hit: boolean): void {
    this.statistics.cacheHit = hit;
  }

  public setFileSize(size: number): void {
    this.statistics.fileSize = size;
  }

  public setComplexity(complexity: ComplexityMetrics): void {
    this.statistics.complexity = complexity;
  }

  public getStatistics(): ParseStatistics {
    return { ...this.statistics };
  }
}
