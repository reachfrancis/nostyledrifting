# Examples - Future Integration

This file shows how the Git branch comparison tool (Story 0.1) can be extended for future stories.

## Example: SCSS File Discovery (Story 1.1)

Here's how the next story could build on our foundation:

```typescript
// Future implementation example - NOT YET IMPLEMENTED
import { GitBranchComparer } from './git-branch-comparer';
import * as fs from 'fs-extra';
import * as path from 'path';

interface ScssFile {
  relativePath: string;
  absolutePath: string;
  type: 'component' | 'global' | 'theme' | 'partial';
}

class ScssAnalyzer {
  async analyzeStyleChanges(branch1: string, branch2: string) {
    // Use our implemented Git branch comparer
    const comparer = new GitBranchComparer({ verbose: true });
    const result = await comparer.compare(branch1, branch2);
    
    console.log(`🔍 Analyzing SCSS files between ${branch1} and ${branch2}`);
    
    // Discover SCSS files in both branches
    const scssFiles1 = await this.discoverScssFiles(result.branch1.path);
    const scssFiles2 = await this.discoverScssFiles(result.branch2.path);
    
    console.log(`📁 Found ${scssFiles1.length} SCSS files in ${branch1}`);
    console.log(`📁 Found ${scssFiles2.length} SCSS files in ${branch2}`);
    
    // Compare the file lists
    const { added, removed, modified } = this.compareFileLists(scssFiles1, scssFiles2);
    
    console.log(`✅ Added: ${added.length} files`);
    console.log(`❌ Removed: ${removed.length} files`);
    console.log(`📝 Modified: ${modified.length} files`);
    
    return {
      branch1: { path: result.branch1.path, files: scssFiles1 },
      branch2: { path: result.branch2.path, files: scssFiles2 },
      changes: { added, removed, modified }
    };
  }
  
  private async discoverScssFiles(projectPath: string): Promise<ScssFile[]> {
    const scssFiles: ScssFile[] = [];
    
    await this.scanDirectory(projectPath, projectPath, scssFiles);
    
    return scssFiles;
  }
  
  private async scanDirectory(
    currentDir: string, 
    projectRoot: string, 
    scssFiles: ScssFile[]
  ): Promise<void> {
    const items = await fs.readdir(currentDir);
    
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!['node_modules', '.git', 'dist', '.angular'].includes(item)) {
          await this.scanDirectory(itemPath, projectRoot, scssFiles);
        }
      } else if (item.endsWith('.scss')) {
        const relativePath = path.relative(projectRoot, itemPath);
        
        scssFiles.push({
          relativePath,
          absolutePath: itemPath,
          type: this.categorizeScssFile(relativePath)
        });
      }
    }
  }
  
  private categorizeScssFile(relativePath: string): ScssFile['type'] {
    const fileName = path.basename(relativePath);
    
    if (fileName.startsWith('_')) {
      return 'partial';
    } else if (fileName.includes('.component.scss')) {
      return 'component';
    } else if (fileName.includes('theme') || fileName.includes('Theme')) {
      return 'theme';
    } else {
      return 'global';
    }
  }
  
  private compareFileLists(files1: ScssFile[], files2: ScssFile[]) {
    const map1 = new Map(files1.map(f => [f.relativePath, f]));
    const map2 = new Map(files2.map(f => [f.relativePath, f]));
    
    const added = files2.filter(f => !map1.has(f.relativePath));
    const removed = files1.filter(f => !map2.has(f.relativePath));
    
    // For modified, we'd need to compare file contents
    const modified = files2.filter(f => 
      map1.has(f.relativePath) && 
      this.hasFileChanged(map1.get(f.relativePath)!, f)
    );
    
    return { added, removed, modified };
  }
  
  private hasFileChanged(file1: ScssFile, file2: ScssFile): boolean {
    // This would implement actual file content comparison
    // For now, just return false as a placeholder
    return false;
  }
}

// Usage example
async function exampleUsage() {
  const analyzer = new ScssAnalyzer();
  
  try {
    const result = await analyzer.analyzeStyleChanges('main', 'feature/new-ui');
    
    console.log('\n📊 Analysis Results:');
    console.log('Branch 1 temp dir:', result.branch1.path);
    console.log('Branch 2 temp dir:', result.branch2.path);
    console.log('Changes:', result.changes);
    
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}
```

## Example: Typography Analysis (Story 2.1)

```typescript
// Future implementation example - NOT YET IMPLEMENTED
class TypographyAnalyzer {
  async analyzeTypographyChanges(branch1: string, branch2: string) {
    // Reuse our Git branch comparer
    const comparer = new GitBranchComparer();
    const result = await comparer.compare(branch1, branch2);
    
    // Parse SCSS files for typography properties
    const typography1 = await this.extractTypographyProperties(result.branch1.path);
    const typography2 = await this.extractTypographyProperties(result.branch2.path);
    
    // Compare typography between branches
    const changes = this.compareTypography(typography1, typography2);
    
    return {
      branch1Typography: typography1,
      branch2Typography: typography2,
      changes
    };
  }
  
  private async extractTypographyProperties(projectPath: string) {
    // Would implement SCSS parsing to extract:
    // - font-family declarations
    // - font-size values
    // - line-height ratios
    // - font-weight variations
    // - etc.
    
    return {
      fontFamilies: [],
      fontSizes: [],
      lineHeights: [],
      fontWeights: []
    };
  }
  
  private compareTypography(typography1: any, typography2: any) {
    // Would implement comparison logic for typography properties
    return {
      addedFonts: [],
      removedFonts: [],
      changedSizes: [],
      changedLineHeights: []
    };
  }
}
```

## Example: Accessibility Analysis (Story 3.1)

```typescript
// Future implementation example - NOT YET IMPLEMENTED
class AccessibilityAnalyzer {
  async analyzeAccessibilityChanges(branch1: string, branch2: string) {
    // Reuse our Git branch comparer
    const comparer = new GitBranchComparer();
    const result = await comparer.compare(branch1, branch2);
    
    // Extract accessibility-related properties
    const a11y1 = await this.extractAccessibilityProperties(result.branch1.path);
    const a11y2 = await this.extractAccessibilityProperties(result.branch2.path);
    
    // Calculate contrast ratios and check WCAG compliance
    const contrastIssues = this.checkContrastCompliance(a11y1, a11y2);
    const focusIssues = this.checkFocusIndicators(a11y1, a11y2);
    
    return {
      contrastIssues,
      focusIssues,
      wcagCompliance: this.calculateWcagCompliance(a11y1, a11y2)
    };
  }
  
  private async extractAccessibilityProperties(projectPath: string) {
    // Would implement extraction of:
    // - color and background-color values
    // - focus indicator styles
    // - animation properties
    // - touch target sizes
    
    return {
      colors: [],
      focusStyles: [],
      animations: [],
      touchTargets: []
    };
  }
  
  private checkContrastCompliance(a11y1: any, a11y2: any) {
    // Would implement WCAG contrast ratio calculations
    return [];
  }
  
  private checkFocusIndicators(a11y1: any, a11y2: any) {
    // Would check for focus indicator presence and visibility
    return [];
  }
  
  private calculateWcagCompliance(a11y1: any, a11y2: any) {
    // Would calculate overall WCAG compliance score
    return { score: 0, level: 'AA' };
  }
}
```

## Running the Examples

Once future stories are implemented, you could use them like this:

```bash
# Run basic branch comparison (currently implemented)
ng-style-compare main feature/new-ui

# Future: Run with SCSS analysis
ng-style-compare main feature/new-ui --analyze-scss

# Future: Run with accessibility checks
ng-style-compare main feature/new-ui --check-accessibility

# Future: Generate full report
ng-style-compare main feature/new-ui --full-report --output report.html
```

## Integration Pattern

The key pattern for future stories is:

1. **Use GitBranchComparer** to get temporary directories with branch content
2. **Process files** in those directories for specific analysis
3. **Compare results** between the two branches
4. **Generate reports** based on the comparison

This approach allows each story to focus on its specific domain (SCSS parsing, typography analysis, accessibility checking) while reusing the solid foundation we've built for Git branch management.
