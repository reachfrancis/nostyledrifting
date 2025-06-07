# Task 9: Integration with Existing Git Comparer and SCSS Discovery

## Overview
Integrate the Style Diff Engine with the existing NoStyleDrifting Git Comparer and SCSS Discovery systems to provide seamless workflow for branch-based SCSS comparison. This task ensures the diff engine works harmoniously with the established codebase infrastructure.

## Implementation Requirements

### 1. Git Comparer Integration

#### Enhanced GitBranchComparer (`src/git-branch-comparer.ts`)

**Extend existing class with diff-specific methods:**

```typescript
import { StyleDiffEngine } from './diff/style-diff-engine';
import { StyleDiffOptions, FilePairResult, BranchDiffResult } from './diff/types';

export class GitBranchComparer {
  // ...existing code...
  
  /**
   * Compare branches with style diff analysis
   */
  async compareWithStyleDiff(
    branch1: string, 
    branch2: string, 
    diffOptions: StyleDiffOptions = {}
  ): Promise<BranchDiffResult> {
    try {
      // Setup branch directories (existing logic)
      const result = await this.compare(branch1, branch2);
      
      // Initialize diff engine
      const diffEngine = new StyleDiffEngine(diffOptions);
      
      // Get SCSS file pairs for comparison
      const filePairs = await this.getScssFilePairs(
        result.branch1.path, 
        result.branch2.path
      );
      
      // Perform diff analysis on each file pair
      const diffResults = await diffEngine.compareBranchFiles(filePairs, {
        branch1Name: branch1,
        branch2Name: branch2,
        branch1Path: result.branch1.path,
        branch2Path: result.branch2.path
      });
      
      return {
        branches: {
          branch1: { name: branch1, commit: result.branch1.commit, path: result.branch1.path },
          branch2: { name: branch2, commit: result.branch2.commit, path: result.branch2.path }
        },
        diffResults,
        summary: this.generateDiffSummary(diffResults),
        metadata: {
          comparisonTimestamp: new Date().toISOString(),
          diffEngineVersion: diffEngine.getVersion(),
          totalFilesCompared: filePairs.length,
          temporaryPaths: {
            branch1: result.branch1.path,
            branch2: result.branch2.path
          }
        }
      };
      
    } catch (error) {
      throw new DiffIntegrationError(`Failed to compare branches with style diff: ${error.message}`, {
        branch1,
        branch2,
        originalError: error
      });
    }
  }
  
  /**
   * Get SCSS file pairs for diff comparison
   */
  private async getScssFilePairs(
    branch1Path: string, 
    branch2Path: string
  ): Promise<FilePairResult[]> {
    const scssService = new ScssDiscoveryService();
    
    // Discover SCSS files in both branches
    const [branch1Files, branch2Files] = await Promise.all([
      scssService.discoverScssFiles(branch1Path),
      scssService.discoverScssFiles(branch2Path)
    ]);
    
    // Create file pair mapping
    const filePairs: FilePairResult[] = [];
    const branch1FileMap = new Map(
      branch1Files.files.map(f => [f.relativePath, f])
    );
    const branch2FileMap = new Map(
      branch2Files.files.map(f => [f.relativePath, f])
    );
    
    // Find matching files
    const allPaths = new Set([
      ...branch1FileMap.keys(),
      ...branch2FileMap.keys()
    ]);
    
    for (const relativePath of allPaths) {
      const file1 = branch1FileMap.get(relativePath);
      const file2 = branch2FileMap.get(relativePath);
      
      filePairs.push({
        relativePath,
        branch1File: file1 ? {
          absolutePath: path.join(branch1Path, relativePath),
          relativePath,
          exists: true,
          metadata: file1
        } : {
          absolutePath: path.join(branch1Path, relativePath),
          relativePath,
          exists: false,
          metadata: null
        },
        branch2File: file2 ? {
          absolutePath: path.join(branch2Path, relativePath),
          relativePath,
          exists: true,
          metadata: file2
        } : {
          absolutePath: path.join(branch2Path, relativePath),
          relativePath,
          exists: false,
          metadata: null
        },
        changeType: this.determineChangeType(!!file1, !!file2),
        priority: this.calculateFilePriority(file1, file2)
      });
    }
    
    // Sort by priority (component styles first, then global, etc.)
    return filePairs.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Determine change type for file pair
   */
  private determineChangeType(
    existsInBranch1: boolean, 
    existsInBranch2: boolean
  ): 'added' | 'removed' | 'modified' | 'unchanged' {
    if (!existsInBranch1 && existsInBranch2) return 'added';
    if (existsInBranch1 && !existsInBranch2) return 'removed';
    if (existsInBranch1 && existsInBranch2) return 'modified'; // Will be refined by diff engine
    return 'unchanged';
  }
  
  /**
   * Calculate file comparison priority
   */
  private calculateFilePriority(file1: any, file2: any): number {
    const file = file1 || file2;
    if (!file) return 0;
    
    // Prioritize component styles, then global styles, then partials
    switch (file.type) {
      case 'component': return 100;
      case 'global': return 80;
      case 'theme': return 60;
      case 'variables': return 40;
      case 'partial': return 20;
      default: return 10;
    }
  }
  
  /**
   * Generate diff summary statistics
   */
  private generateDiffSummary(diffResults: any[]): DiffSummary {
    const summary = {
      totalFiles: diffResults.length,
      filesChanged: 0,
      filesAdded: 0,
      filesRemoved: 0,
      totalLines: 0,
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      propertyChanges: 0,
      variableChanges: 0,
      selectorChanges: 0,
      importChanges: 0,
      categories: {
        typography: 0,
        layout: 0,
        colors: 0,
        animation: 0,
        responsive: 0,
        other: 0
      },
      impact: {
        high: 0,
        medium: 0,
        low: 0
      }
    };
    
    diffResults.forEach(result => {
      if (result.changeType === 'added') summary.filesAdded++;
      else if (result.changeType === 'removed') summary.filesRemoved++;
      else if (result.changeType === 'modified') summary.filesChanged++;
      
      // Aggregate statistics from diff results
      if (result.statistics) {
        summary.linesAdded += result.statistics.linesAdded || 0;
        summary.linesRemoved += result.statistics.linesRemoved || 0;
        summary.linesModified += result.statistics.linesModified || 0;
        summary.propertyChanges += result.statistics.propertyChanges || 0;
        summary.variableChanges += result.statistics.variableChanges || 0;
        summary.selectorChanges += result.statistics.selectorChanges || 0;
        summary.importChanges += result.statistics.importChanges || 0;
        
        // Aggregate category changes
        Object.keys(summary.categories).forEach(category => {
          summary.categories[category] += result.statistics.categories?.[category] || 0;
        });
        
        // Aggregate impact levels
        Object.keys(summary.impact).forEach(impact => {
          summary.impact[impact] += result.statistics.impact?.[impact] || 0;
        });
      }
    });
    
    summary.totalLines = summary.linesAdded + summary.linesRemoved + summary.linesModified;
    
    return summary;
  }
}
```

### 2. SCSS Discovery Integration

#### Enhanced ScssDiscoveryService (`src/scss-discovery.ts`)

**Add diff-specific discovery methods:**

```typescript
export class ScssDiscoveryService {
  // ...existing code...
  
  /**
   * Discover SCSS files with diff-specific metadata
   */
  async discoverForDiff(
    projectPath: string, 
    branchName: string
  ): Promise<DiffScssDiscoveryResult> {
    const standardResult = await this.discoverScssFiles(projectPath);
    
    // Enhance with diff-specific metadata
    const enhancedFiles = await Promise.all(
      standardResult.files.map(async (file) => ({
        ...file,
        diffMetadata: await this.extractDiffMetadata(file, projectPath),
        contentHash: await this.generateContentHash(file.absolutePath),
        lastModified: await this.getLastModified(file.absolutePath),
        complexity: await this.assessComplexity(file.absolutePath)
      }))
    );
    
    return {
      ...standardResult,
      branchName,
      files: enhancedFiles,
      diffReadiness: await this.assessDiffReadiness(enhancedFiles)
    };
  }
  
  /**
   * Compare SCSS discovery results between branches
   */
  async compareDiscoveryResults(
    branch1Result: DiffScssDiscoveryResult,
    branch2Result: DiffScssDiscoveryResult
  ): Promise<DiscoveryComparisonResult> {
    const fileMapping = this.createFileMapping(
      branch1Result.files,
      branch2Result.files
    );
    
    const changes = {
      added: fileMapping.filter(m => !m.branch1File && m.branch2File),
      removed: fileMapping.filter(m => m.branch1File && !m.branch2File),
      modified: fileMapping.filter(m => 
        m.branch1File && 
        m.branch2File && 
        m.branch1File.contentHash !== m.branch2File.contentHash
      ),
      unchanged: fileMapping.filter(m => 
        m.branch1File && 
        m.branch2File && 
        m.branch1File.contentHash === m.branch2File.contentHash
      )
    };
    
    return {
      branch1: branch1Result,
      branch2: branch2Result,
      changes,
      summary: {
        totalFiles: fileMapping.length,
        addedFiles: changes.added.length,
        removedFiles: changes.removed.length,
        modifiedFiles: changes.modified.length,
        unchangedFiles: changes.unchanged.length,
        complexityChange: this.calculateComplexityChange(changes),
        riskAssessment: this.assessChangeRisk(changes)
      },
      recommendations: this.generateDiffRecommendations(changes)
    };
  }
  
  /**
   * Extract diff-specific metadata from SCSS file
   */
  private async extractDiffMetadata(
    file: ScssFile, 
    projectPath: string
  ): Promise<DiffMetadata> {
    const content = await fs.readFile(file.absolutePath, 'utf8');
    
    return {
      variableCount: this.countVariables(content),
      mixinCount: this.countMixins(content),
      selectorCount: this.countSelectors(content),
      importCount: file.imports.length,
      mediaQueryCount: this.countMediaQueries(content),
      commentLines: this.countCommentLines(content),
      totalLines: content.split('\n').length,
      estimatedParseTime: this.estimateParseTime(content),
      diffPriority: this.calculateDiffPriority(file)
    };
  }
  
  /**
   * Generate content hash for change detection
   */
  private async generateContentHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf8');
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
  
  /**
   * Assess file complexity for diff processing
   */
  private async assessComplexity(filePath: string): Promise<FileComplexity> {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').length;
    const nesting = this.calculateMaxNesting(content);
    const variables = this.countVariables(content);
    
    const score = (lines * 0.1) + (nesting * 5) + (variables * 2);
    
    return {
      score,
      level: score < 20 ? 'low' : score < 50 ? 'medium' : 'high',
      factors: {
        lineCount: lines,
        maxNesting: nesting,
        variableCount: variables,
        complexity: score
      }
    };
  }
  
  /**
   * Assess diff readiness of discovered files
   */
  private async assessDiffReadiness(
    files: EnhancedScssFile[]
  ): Promise<DiffReadinessAssessment> {
    const assessments = files.map(file => ({
      file: file.relativePath,
      ready: file.complexity.level !== 'high',
      warnings: this.generateReadinessWarnings(file),
      recommendations: this.generateReadinessRecommendations(file)
    }));
    
    const readyFiles = assessments.filter(a => a.ready).length;
    const totalFiles = assessments.length;
    
    return {
      overall: readyFiles / totalFiles,
      fileAssessments: assessments,
      summary: {
        readyFiles,
        totalFiles,
        readinessPercentage: (readyFiles / totalFiles) * 100,
        potentialIssues: assessments.filter(a => !a.ready).length
      }
    };
  }
}
```

### 3. Error Handling and Recovery

#### Integration Error Types (`src/diff/integration-errors.ts`)

```typescript
export class DiffIntegrationError extends Error {
  constructor(
    message: string,
    public context: {
      branch1?: string;
      branch2?: string;
      filePath?: string;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'DiffIntegrationError';
  }
}

export class GitDiffIntegrationError extends DiffIntegrationError {
  constructor(message: string, gitContext: any) {
    super(message, gitContext);
    this.name = 'GitDiffIntegrationError';
  }
}

export class DiscoveryIntegrationError extends DiffIntegrationError {
  constructor(message: string, discoveryContext: any) {
    super(message, discoveryContext);
    this.name = 'DiscoveryIntegrationError';
  }
}
```

### 4. Integration Testing

#### Integration Test Suite (`src/diff/integration.test.ts`)

```typescript
import { GitBranchComparer } from '../git-branch-comparer';
import { ScssDiscoveryService } from '../scss-discovery';
import { StyleDiffEngine } from './style-diff-engine';

describe('Diff Engine Integration', () => {
  let gitComparer: GitBranchComparer;
  let scssService: ScssDiscoveryService;
  let diffEngine: StyleDiffEngine;
  
  beforeEach(() => {
    gitComparer = new GitBranchComparer({ verbose: false });
    scssService = new ScssDiscoveryService();
    diffEngine = new StyleDiffEngine();
  });
  
  describe('Git Integration', () => {
    test('should integrate with git branch comparison', async () => {
      // Test git integration workflow
    });
    
    test('should handle missing branches gracefully', async () => {
      // Test error handling
    });
    
    test('should preserve temporary directories when requested', async () => {
      // Test temp directory management
    });
  });
  
  describe('SCSS Discovery Integration', () => {
    test('should integrate with SCSS discovery results', async () => {
      // Test discovery integration
    });
    
    test('should handle file mapping between branches', async () => {
      // Test file mapping logic
    });
    
    test('should prioritize files correctly', async () => {
      // Test priority calculation
    });
  });
  
  describe('End-to-End Workflow', () => {
    test('should perform complete branch diff analysis', async () => {
      // Test complete workflow
    });
    
    test('should generate accurate summary statistics', async () => {
      // Test summary generation
    });
    
    test('should handle large codebases efficiently', async () => {
      // Test performance
    });
  });
});
```

## Key Integration Points

### 1. Data Flow Integration
- GitBranchComparer → File Discovery → Diff Engine → Results
- Maintain existing CLI patterns and error handling
- Preserve temporary directory management

### 2. Configuration Harmony
- Merge diff options with existing comparer options
- Consistent verbose/quiet modes
- Unified error reporting

### 3. Performance Considerations
- Leverage existing caching mechanisms
- Reuse temporary directories efficiently
- Parallel processing where appropriate

### 4. Backward Compatibility
- Preserve existing CLI behavior
- Add diff functionality as enhancement
- Maintain existing test suites

## Implementation Priority

1. **High Priority**: Git integration and file pairing
2. **Medium Priority**: SCSS discovery enhancement
3. **Low Priority**: Advanced metadata and complexity assessment

This integration ensures the Style Diff Engine seamlessly extends NoStyleDrifting's existing capabilities while maintaining architectural consistency and performance standards.
