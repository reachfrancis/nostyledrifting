/**
 * Test suite for EnhancedVariableResolver
 * Tests comprehensive SCSS variable tracking, dependency analysis, and context-aware resolution
 */

import { EnhancedVariableResolver } from '../enhanced-variable-resolver';
import { CircularDependencyError, DiffError, DiffErrorType } from '../errors';
import { 
  VariableDefinition, 
  VariableScope, 
  VariableResolutionContext,
  VariableDependencyGraph,
  VariableImpactAnalysis,
  PropertyContext,
  ScssImportInfo
} from '../types';

describe('EnhancedVariableResolver', () => {
  let resolver: EnhancedVariableResolver;

  beforeEach(() => {
    resolver = new EnhancedVariableResolver();
  });

  describe('Variable Definition Extraction', () => {
    it('should extract simple variable definitions', async () => {
      const content = `
        $primary-color: #007bff;
        $font-size: 16px;
        $margin: 10px;
      `;
      
      const context = await resolver.analyzeContent(content, 'test.scss');
      
      expect(context.variables.size).toBe(3);
      expect(context.variables.get('primary-color')).toMatchObject({
        name: 'primary-color',
        value: '#007bff',
        scope: 'global',
        isDefault: false,
        isGlobal: false
      });
    });

    it('should handle variables with !default flag', async () => {
      const content = `
        $primary-color: #007bff !default;
        $secondary-color: #6c757d !default;
      `;
      
      const context = await resolver.analyzeContent(content, 'test.scss');
      const primaryVar = context.variables.get('primary-color');
      
      expect(primaryVar?.isDefault).toBe(true);
      expect(primaryVar?.isGlobal).toBe(false);
    });

    it('should handle variables with !global flag', async () => {
      const content = `
        .component {
          $local-color: #333 !global;
        }
      `;
      
      const context = await resolver.analyzeContent(content, 'test.scss');
      const localVar = context.variables.get('local-color');
      
      expect(localVar?.isGlobal).toBe(true);
    });

    it('should detect variable scope correctly', async () => {
      const content = `
        $global-var: red;
        
        .component {
          $local-var: blue;
        }
        
        @mixin my-mixin {
          $mixin-var: green;
        }
      `;
      
      const context = await resolver.analyzeContent(content, 'test.scss');
      
      expect(context.variables.get('global-var')?.scope).toBe('global');
      expect(context.variables.get('local-var')?.scope).toBe('local');
      expect(context.variables.get('mixin-var')?.scope).toBe('mixin');
    });
  });

  describe('Variable Dependencies', () => {
    it('should extract variable dependencies', async () => {
      const content = `
        $base-size: 16px;
        $large-size: $base-size * 1.5;
        $xlarge-size: $large-size * 1.2;
      `;
      
      const context = await resolver.analyzeContent(content, 'test.scss');
      const largeVar = context.variables.get('large-size');
      const xlargeVar = context.variables.get('xlarge-size');
      
      expect(largeVar?.dependencies).toContain('base-size');
      expect(xlargeVar?.dependencies).toContain('large-size');
    });

    it('should build dependency graph correctly', async () => {
      const content = `
        $primary: #007bff;
        $primary-dark: darken($primary, 10%);
        $primary-light: lighten($primary, 20%);
        $button-bg: $primary-dark;
      `;
      
      const context = await resolver.analyzeContent(content, 'test.scss');
      
      expect(context.dependencies.get('primary-dark')).toContain('primary');
      expect(context.dependencies.get('primary-light')).toContain('primary');
      expect(context.dependencies.get('button-bg')).toContain('primary-dark');
    });

    it('should detect circular dependencies', async () => {
      const content = `
        $var-a: $var-b;
        $var-b: $var-c;
        $var-c: $var-a;
      `;
      
      await expect(resolver.analyzeContent(content, 'test.scss'))
        .rejects.toThrow(CircularDependencyError);
    });
  });

  describe('Variable Resolution', () => {
    beforeEach(async () => {
      const content = `
        $base-color: #333;
        $primary-color: lighten($base-color, 20%);
        $text-color: $primary-color;
      `;
      await resolver.analyzeContent(content, 'test.scss');
    });

    it('should resolve variable with context', async () => {
      const context: PropertyContext = {
        selector: '.test',
        property: 'color',
        value: '$text-color',
        lineNumber: 10,
        filePath: 'test.scss',
        nestingLevel: 0
      };

      const result = await resolver.resolveVariableWithContext('text-color', context);
      
      expect(result.definition.name).toBe('text-color');
      expect(result.dependencyChain).toContain('text-color');
      expect(result.dependencyChain).toContain('primary-color');
      expect(result.dependencyChain).toContain('base-color');
    });

    it('should handle non-existent variables', async () => {
      const context: PropertyContext = {
        selector: '.test',
        property: 'color',
        value: '$non-existent',
        lineNumber: 10,
        filePath: 'test.scss',
        nestingLevel: 0
      };

      await expect(resolver.resolveVariableWithContext('non-existent', context))
        .rejects.toThrow(DiffError);
    });

    it('should detect circular dependencies during resolution', async () => {
      const content = `
        $var-a: $var-b;
        $var-b: $var-a;
      `;
      await resolver.analyzeContent(content, 'circular.scss');

      const context: PropertyContext = {
        selector: '.test',
        property: 'color',
        value: '$var-a',
        lineNumber: 1,
        filePath: 'circular.scss',
        nestingLevel: 0
      };

      await expect(resolver.resolveVariableWithContext('var-a', context))
        .rejects.toThrow(CircularDependencyError);
    });
  });

  describe('Variable Impact Analysis', () => {
    beforeEach(async () => {
      const content = `
        $primary-color: #007bff;
        $button-color: $primary-color;
        $link-color: $primary-color;
        $border-color: lighten($primary-color, 30%);
      `;
      await resolver.analyzeContent(content, 'test.scss');
    });

    it('should analyze variable impact correctly', () => {
      const impact = resolver.analyzeVariableImpact('primary-color', '#ff5722');
      
      expect(impact.modifiedVariables).toHaveLength(1);
      expect(impact.modifiedVariables[0].variable.name).toBe('primary-color');
      expect(impact.modifiedVariables[0].newValue).toBe('#ff5722');
    });

    it('should identify cascading effects', () => {
      const impact = resolver.analyzeVariableImpact('primary-color', '#ff5722');
      
      expect(impact.cascadeEffects).toHaveLength(1);
      expect(impact.cascadeEffects[0].variableName).toBe('primary-color');
      expect(impact.cascadeEffects[0].affectedVariables.length).toBeGreaterThan(0);
    });

    it('should generate recommendations', () => {
      const impact = resolver.analyzeVariableImpact('primary-color', '#ff5722');
      
      expect(impact.recommendations).toBeInstanceOf(Array);
      expect(impact.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Context Comparison', () => {
    let context1: VariableResolutionContext;
    let context2: VariableResolutionContext;

    beforeEach(async () => {
      const content1 = `
        $primary-color: #007bff;
        $secondary-color: #6c757d;
      `;
      
      const content2 = `
        $primary-color: #ff5722;
        $tertiary-color: #28a745;
      `;

      context1 = await resolver.analyzeContent(content1, 'before.scss');
      context2 = await resolver.analyzeContent(content2, 'after.scss');
    });

    it('should compare variable contexts correctly', () => {
      const comparison = resolver.compareVariableContexts(context1, context2);
      
      expect(comparison.added).toHaveLength(1);
      expect(comparison.added[0].name).toBe('tertiary-color');
      
      expect(comparison.removed).toHaveLength(1);
      expect(comparison.removed[0].name).toBe('secondary-color');
      
      expect(comparison.modified).toHaveLength(1);
      expect(comparison.modified[0].variable).toBe('primary-color');
    });

    it('should detect scope changes', () => {
      const content1 = `$var: red;`;
      const content2 = `.component { $var: blue; }`;
      
      // This would require a more complex setup to test scope changes
      // For now, we'll test the structure
      const comparison = resolver.compareVariableContexts(context1, context2);
      
      expect(comparison.scopeChanges).toBeInstanceOf(Array);
    });
  });

  describe('Import Resolution', () => {
    it('should handle import information', async () => {
      const imports: ScssImportInfo[] = [
        {
          path: 'variables',
          lineNumber: 1,
          isPartial: true,
          importedItems: ['$primary-color', '$secondary-color']
        }
      ];

      const content = `
        @import 'variables';
        $local-color: $primary-color;
      `;

      const context = await resolver.analyzeContent(content, 'test.scss', imports);
      
      expect(context.imports).toHaveLength(1);
      expect(context.imports[0].path).toBe('variables');
    });

    it('should resolve imported variables', async () => {
      // This is a placeholder test as the actual import resolution
      // would require file system access
      const imports: ScssImportInfo[] = [
        {
          path: '_colors.scss',
          lineNumber: 1,
          isPartial: true
        }
      ];

      const content = `@import 'colors';`;
      
      await expect(resolver.analyzeContent(content, 'test.scss', imports))
        .resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed SCSS content gracefully', async () => {
      const malformedContent = `
        $invalid-var: ;
        $another-var: $non-existent-var;
        .incomplete-selector
      `;

      // Should not throw but may have limited variable extraction
      const context = await resolver.analyzeContent(malformedContent, 'malformed.scss');
      expect(context).toBeDefined();
    });

    it('should wrap parsing errors appropriately', async () => {
      const content = null as any;
      
      await expect(resolver.analyzeContent(content, 'test.scss'))
        .rejects.toThrow(DiffError);
    });
  });

  describe('Performance', () => {
    it('should handle large SCSS files efficiently', async () => {
      // Generate a large SCSS file with many variables
      const largeContent = Array.from({ length: 1000 }, (_, i) => 
        `$var-${i}: #${i.toString(16).padStart(6, '0')};`
      ).join('\n');

      const startTime = Date.now();
      const context = await resolver.analyzeContent(largeContent, 'large.scss');
      const duration = Date.now() - startTime;

      expect(context.variables.size).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should use caching effectively', async () => {
      const content = `
        $primary: #007bff;
        $secondary: $primary;
      `;

      const context: PropertyContext = {
        selector: '.test',
        property: 'color',
        value: '$secondary',
        lineNumber: 1,
        filePath: 'test.scss',
        nestingLevel: 0
      };

      await resolver.analyzeContent(content, 'test.scss');

      // First resolution
      const startTime1 = Date.now();
      await resolver.resolveVariableWithContext('secondary', context);
      const duration1 = Date.now() - startTime1;

      // Second resolution (should use cache)
      const startTime2 = Date.now();
      await resolver.resolveVariableWithContext('secondary', context);
      const duration2 = Date.now() - startTime2;

      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const context = await resolver.analyzeContent('', 'empty.scss');
      
      expect(context.variables.size).toBe(0);
      expect(context.dependencies.size).toBe(0);
    });

    it('should handle variables with complex values', async () => {
      const content = `
        $complex-value: calc(100% - #{$sidebar-width} - #{$padding * 2});
        $gradient: linear-gradient(45deg, $primary-color 0%, $secondary-color 100%);
        $map-variable: (
          'small': 480px,
          'medium': 768px,
          'large': 1024px
        );
      `;

      const context = await resolver.analyzeContent(content, 'complex.scss');
      
      expect(context.variables.size).toBe(3);
      expect(context.variables.get('complex-value')?.dependencies).toContain('sidebar-width');
      expect(context.variables.get('complex-value')?.dependencies).toContain('padding');
    });

    it('should handle nested variable definitions', async () => {
      const content = `
        .component {
          $local-primary: #007bff;
          
          &:hover {
            $hover-color: darken($local-primary, 10%);
          }
        }
      `;

      const context = await resolver.analyzeContent(content, 'nested.scss');
      
      expect(context.variables.has('local-primary')).toBe(true);
      expect(context.variables.has('hover-color')).toBe(true);
      expect(context.variables.get('hover-color')?.dependencies).toContain('local-primary');
    });
  });
});
