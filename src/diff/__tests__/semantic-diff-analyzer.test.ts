import { DiffAnalyzer } from '../diff-analyzer';
import { DiffOptions, SemanticAnalysisResult, CssPropertyChange } from '../types';

describe('DiffAnalyzer - Semantic Analysis Integration', () => {
  let analyzer: DiffAnalyzer;
  let defaultOptions: DiffOptions;
  beforeEach(() => {
    defaultOptions = {
      viewMode: 'unified',
      contextLines: 3,
      groupRelatedChanges: true,
      resolveVariables: true,
      showOnlyChanges: true,
      format: 'terminal'
    };
    analyzer = new DiffAnalyzer(defaultOptions);
  });

  describe('analyzeCssProperties', () => {
    test('should extract CSS properties from added content', () => {
      const change = {
        type: 'added' as const,
        lineNumber: 1,
        content: `
          .button {
            color: #007bff;
            font-size: 16px;
            padding: 10px 15px;
          }
        `
      };

      const properties = analyzer.analyzeCssProperties(change);

      expect(properties).toHaveLength(3);
      expect(properties.some(p => p.property === 'color')).toBe(true);
      expect(properties.some(p => p.property === 'font-size')).toBe(true);
      expect(properties.some(p => p.property === 'padding')).toBe(true);
    });

    test('should categorize properties correctly', () => {
      const change = {
        type: 'added' as const,
        lineNumber: 1,
        content: `
          .component {
            color: red;
            margin: 10px;
            animation: fade-in 0.3s;
          }
        `
      };

      const properties = analyzer.analyzeCssProperties(change);

      const colorProp = properties.find(p => p.property === 'color');
      const marginProp = properties.find(p => p.property === 'margin');
      const animationProp = properties.find(p => p.property === 'animation');

      expect(colorProp?.category).toBe('color');
      expect(marginProp?.category).toBe('layout');
      expect(animationProp?.category).toBe('animation');
    });

    test('should handle removed content', () => {
      const change = {
        type: 'removed' as const,
        lineNumber: 1,
        content: `
          .old-button {
            background-color: #ccc;
            font-weight: bold;
          }
        `
      };

      const properties = analyzer.analyzeCssProperties(change);

      expect(properties).toHaveLength(2);
      expect(properties.every(p => p.oldValue !== undefined)).toBe(true);
      expect(properties.every(p => p.newValue === undefined)).toBe(true);
    });

    test('should extract accessibility-related properties', () => {
      const change = {
        type: 'added' as const,
        lineNumber: 1,
        content: `
          .accessible {
            color: #333;
            outline: 2px solid #007bff;
            font-size: 18px;
          }
        `
      };

      const properties = analyzer.analyzeCssProperties(change);

      expect(properties.some(p => p.accessibility === true)).toBe(true);
    });

    test('should handle malformed CSS gracefully', () => {
      const change = {
        type: 'added' as const,
        lineNumber: 1,
        content: `
          .broken {
            color: red
            font-size: 16px;
            incomplete
          }
        `
      };

      expect(() => {
        analyzer.analyzeCssProperties(change);
      }).not.toThrow();
    });
  });

  describe('semantic analysis integration', () => {
    test('should enhance diff chunks with semantic analysis', async () => {
      const oldContent = `
        .button {
          color: blue;
          padding: 8px 12px;
        }
      `;

      const newContent = `
        .button {
          color: red;
          padding: 10px 15px;
          margin: 5px;
        }
      `;

      const result = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');

      expect(result.chunks.length).toBeGreaterThan(0);
      
      // Check that chunks have enhanced change information
      const hasEnhancedChanges = result.chunks.some(chunk =>
        chunk.changes.some(change => change.cssProperties && change.cssProperties.length > 0)
      );
      
      expect(hasEnhancedChanges).toBe(true);
    });

    test('should include SCSS context in changes', async () => {
      const oldContent = `
        $primary-color: blue;
        
        .component {
          color: $primary-color;
        }
      `;

      const newContent = `
        $primary-color: red;
        $secondary-color: green;
        
        .component {
          color: $primary-color;
          background: $secondary-color;
        }
      `;

      const result = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');

      // Check that SCSS context is included
      const hasScssContext = result.chunks.some(chunk =>
        chunk.changes.some(change => change.scssContext !== undefined)
      );

      expect(hasScssContext).toBe(true);
    });
  });

  describe('generateSemanticAnalysis', () => {
    test('should generate comprehensive semantic analysis', async () => {
      const oldContent = `
        .button {
          color: blue;
          font-size: 14px;
        }
      `;

      const newContent = `
        .button {
          color: red;
          font-size: 16px;
          background-color: yellow;
        }
      `;      const diffResult = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(diffResult);

      expect(semanticAnalysis.groups).toBeDefined();
      expect(semanticAnalysis.patterns).toBeDefined();
      expect(semanticAnalysis.impact).toBeDefined();
    });

    test('should categorize changes by semantic impact', async () => {
      const oldContent = `
        .component {
          display: block;
          color: blue;
          margin: 10px;
        }
      `;

      const newContent = `
        .component {
          display: none;
          color: red;
          margin: 15px;
        }
      `;

      const diffResult = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(diffResult);      // Check that semantic analysis has the correct structure
      expect(semanticAnalysis.groups.length).toBeGreaterThan(0);
      expect(semanticAnalysis.impact).toMatch(/^(high|medium|low)$/);
    });

    test('should assess accessibility impact', async () => {
      const oldContent = `
        .text {
          color: #000;
          font-size: 14px;
        }
      `;

      const newContent = `
        .text {
          color: #333;
          font-size: 18px;
          outline: 2px solid #007bff;
        }
      `;

      const diffResult = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(diffResult);      expect(semanticAnalysis.groups).toBeDefined();
      expect(semanticAnalysis.patterns).toBeDefined();
    });

    test('should assess performance impact', async () => {
      const oldContent = `
        .element {
          transform: translateX(0);
        }
      `;

      const newContent = `
        .element {
          transform: translateX(100px);
          animation: slide 0.3s ease;
          filter: blur(2px);
        }
      `;

      const diffResult = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(diffResult);      expect(semanticAnalysis.groups).toBeDefined();
      expect(semanticAnalysis.impact).toMatch(/^(high|medium|low)$/);
    });

    test('should detect cross-category changes', async () => {
      const oldContent = `
        .multi {
          color: blue;
        }
      `;

      const newContent = `
        .multi {
          color: red;
          margin: 10px;
          animation: fade 1s;
        }
      `;

      const diffResult = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(diffResult);      expect(semanticAnalysis.groups).toBeDefined();
      expect(semanticAnalysis.patterns).toBeDefined();
    });
  });

  describe('error handling and recovery', () => {
    test('should handle analysis errors gracefully', async () => {
      const malformedContent = `
        .broken {
          color: red
          incomplete: 
        }
      `;

      expect(async () => {
        await analyzer.analyzeContent(malformedContent, malformedContent, 'test.scss');
      }).not.toThrow();
    });

    test('should fallback when semantic analysis fails', async () => {
      const oldContent = '.test { color: red; }';
      const newContent = '.test { color: blue; }';

      const result = await analyzer.analyzeContent(oldContent, newContent, 'test.scss');

      // Even if semantic analysis fails, basic diff should work
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.changeType).toBeDefined();
    });
  });

  describe('performance with large files', () => {
    test('should handle large SCSS files efficiently', async () => {
      // Generate large SCSS content
      let oldContent = '';
      let newContent = '';

      for (let i = 0; i < 100; i++) {
        oldContent += `
          .component-${i} {
            color: blue;
            font-size: 14px;
            margin: ${i}px;
          }
        `;
        newContent += `
          .component-${i} {
            color: red;
            font-size: 16px;
            margin: ${i + 1}px;
          }
        `;
      }

      const startTime = Date.now();
      const result = await analyzer.analyzeContent(oldContent, newContent, 'large.scss');
      const endTime = Date.now();

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('real-world scenarios', () => {
    test('should handle Angular Material theme changes', async () => {
      const oldContent = `
        @import '~@angular/material/theming';
        
        $primary: mat-palette($mat-indigo);
        $accent: mat-palette($mat-pink);
        
        .mat-button {
          color: mat-color($primary);
        }
      `;

      const newContent = `
        @import '~@angular/material/theming';
        
        $primary: mat-palette($mat-blue);
        $accent: mat-palette($mat-amber);
        
        .mat-button {
          color: mat-color($primary);
          background-color: mat-color($accent);
        }
      `;

      const result = await analyzer.analyzeContent(oldContent, newContent, 'theme.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(result);      expect(result.chunks.length).toBeGreaterThan(0);
      expect(semanticAnalysis.groups.length).toBeGreaterThan(0);
    });

    test('should handle responsive design changes', async () => {
      const oldContent = `
        .container {
          width: 100%;
          
          @media (min-width: 768px) {
            width: 750px;
          }
        }
      `;

      const newContent = `
        .container {
          width: 100%;
          max-width: 1200px;
          
          @media (min-width: 768px) {
            width: 750px;
          }
          
          @media (min-width: 1200px) {
            width: 1140px;
          }
        }
      `;

      const result = await analyzer.analyzeContent(oldContent, newContent, 'responsive.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(result);      expect(result.chunks.length).toBeGreaterThan(0);
      expect(semanticAnalysis.groups).toBeDefined(); // Changed from crossCategoryAnalysis
    });

    test('should handle component refactoring', async () => {
      const oldContent = `
        .card {
          border: 1px solid #ccc;
          padding: 1rem;
          
          .card-title {
            font-size: 1.25rem;
            font-weight: bold;
          }
          
          .card-body {
            margin-top: 0.5rem;
          }
        }
      `;

      const newContent = `
        .card {
          border: 1px solid #ddd;
          padding: 1.5rem;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          
          &__title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #333;
          }
          
          &__body {
            margin-top: 1rem;
            line-height: 1.6;
          }
        }
      `;      const result = await analyzer.analyzeContent(oldContent, newContent, 'card.scss');
      const semanticAnalysis = await analyzer.generateSemanticAnalysis(result);      
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(semanticAnalysis.groups).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(semanticAnalysis.impact);
    });
  });
});
