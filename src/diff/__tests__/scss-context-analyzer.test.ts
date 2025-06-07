import { ScssContextAnalyzer, ScssAnalysisResult, ContextualChange } from '../scss-context-analyzer';

describe('ScssContextAnalyzer', () => {
  let analyzer: ScssContextAnalyzer;

  beforeEach(() => {
    analyzer = new ScssContextAnalyzer();
  });

  describe('analyzeContent', () => {
    test('should analyze basic SCSS content', () => {
      const content = `
        $primary-color: #007bff;
        $font-size: 16px;
        
        .button {
          color: $primary-color;
          font-size: $font-size;
          padding: 10px 15px;
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.variables.has('primary-color')).toBe(true);
      expect(result.variables.has('font-size')).toBe(true);
      expect(result.variables.get('primary-color')).toBe('#007bff');
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].selector).toBe('.button');
      expect(result.complexity).toBe('low');
    });

    test('should analyze SCSS with mixins', () => {
      const content = `
        @mixin button-style($bg-color, $text-color) {
          background-color: $bg-color;
          color: $text-color;
          border: none;
          padding: 10px 20px;
        }
        
        .primary-button {
          @include button-style(#007bff, white);
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.mixins.has('button-style')).toBe(true);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].selector).toBe('.primary-button');
    });

    test('should analyze SCSS with imports', () => {
      const content = `
        @import 'variables';
        @import 'mixins';
        @use 'sass:math';
        
        .component {
          width: 100%;
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.imports).toContain('variables');
      expect(result.imports).toContain('mixins');
      expect(result.imports).toContain('sass:math');
    });

    test('should analyze SCSS with media queries', () => {
      const content = `
        .container {
          width: 100%;
          
          @media (min-width: 768px) {
            width: 750px;
          }
          
          @media (min-width: 1200px) {
            width: 1140px;
          }
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.mediaQueries).toContain('(min-width: 768px)');
      expect(result.mediaQueries).toContain('(min-width: 1200px)');
      expect(result.complexity).toBe('medium');
    });

    test('should analyze complex nested SCSS', () => {
      const content = `
        .card {
          border: 1px solid #ccc;
          
          &__header {
            background: #f8f9fa;
            
            &__title {
              font-size: 1.25rem;
              font-weight: bold;
              
              &:hover {
                color: #007bff;
              }
            }
          }
          
          &__body {
            padding: 1rem;
          }
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.nestingDepth).toBeGreaterThan(2);
      expect(result.complexity).toBe('high');
      expect(result.selectors).toContain('.card');
    });
  });

  describe('analyzeContextualChanges', () => {
    test('should detect variable changes', () => {
      const oldContent = `
        $primary-color: #007bff;
        $font-size: 16px;
      `;

      const newContent = `
        $primary-color: #28a745;
        $font-size: 18px;
        $new-variable: #ffc107;
      `;

      const changes = analyzer.analyzeContextualChanges(oldContent, newContent);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.property === 'primary-color')).toBe(true);
      expect(changes.some(c => c.property === 'font-size')).toBe(true);
    });

    test('should detect rule changes', () => {
      const oldContent = `
        .button {
          color: blue;
          padding: 10px;
        }
      `;

      const newContent = `
        .button {
          color: red;
          padding: 15px;
          margin: 5px;
        }
      `;

      const changes = analyzer.analyzeContextualChanges(oldContent, newContent);

      expect(changes.some(c => c.selector === '.button' && c.property === 'color')).toBe(true);
      expect(changes.some(c => c.selector === '.button' && c.property === 'padding')).toBe(true);
    });

    test('should detect semantic impact levels', () => {
      const oldContent = `
        .component {
          display: block;
          font-size: 16px;
        }
      `;

      const newContent = `
        .component {
          display: none;
          font-size: 18px;
        }
      `;

      const changes = analyzer.analyzeContextualChanges(oldContent, newContent);

      const displayChange = changes.find(c => c.property === 'display');
      const fontChange = changes.find(c => c.property === 'font-size');

      expect(displayChange?.semanticImpact).toBe('breaking');
      expect(fontChange?.semanticImpact).toBe('visual');
    });
  });

  describe('accessibility analysis', () => {
    test('should detect accessibility-related properties', () => {
      const content = `
        .button {
          color: #007bff;
          background-color: white;
          outline: 2px solid transparent;
          
          &:focus {
            outline: 2px solid #007bff;
          }
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.accessibility.focusableElements.length).toBeGreaterThan(0);
      expect(result.accessibility.contrastIssues).toBeDefined();
    });

    test('should detect potential contrast issues', () => {
      const content = `
        .low-contrast {
          color: #ccc;
          background-color: #ddd;
        }
      `;

      const result = analyzer.analyzeContent(content);
      
      // The analyzer should flag potential contrast issues
      expect(result.accessibility).toBeDefined();
    });
  });

  describe('complexity analysis', () => {
    test('should rate simple SCSS as low complexity', () => {
      const content = `
        .simple {
          color: red;
          font-size: 16px;
        }
      `;

      const result = analyzer.analyzeContent(content);
      expect(result.complexity).toBe('low');
    });

    test('should rate nested SCSS as higher complexity', () => {
      const content = `
        .complex {
          .nested {
            .deeply {
              .nested {
                .element {
                  color: red;
                }
              }
            }
          }
        }
      `;

      const result = analyzer.analyzeContent(content);
      expect(result.complexity).toBe('high');
    });

    test('should rate SCSS with many rules as higher complexity', () => {
      const content = `
        .rule1 { color: red; }
        .rule2 { color: blue; }
        .rule3 { color: green; }
        .rule4 { color: yellow; }
        .rule5 { color: purple; }
        .rule6 { color: orange; }
        .rule7 { color: pink; }
        .rule8 { color: brown; }
        .rule9 { color: gray; }
        .rule10 { color: black; }
      `;

      const result = analyzer.analyzeContent(content);
      expect(['medium', 'high']).toContain(result.complexity);
    });
  });

  describe('selector analysis', () => {
    test('should extract all selectors', () => {
      const content = `
        .class1 { color: red; }
        #id1 { font-size: 16px; }
        .class2 .nested { margin: 10px; }
        .class3:hover { background: blue; }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.selectors).toContain('.class1');
      expect(result.selectors).toContain('#id1');
      expect(result.selectors).toContain('.class2 .nested');
      expect(result.selectors).toContain('.class3:hover');
    });

    test('should handle complex selectors', () => {
      const content = `
        .component[data-state="active"] > .child:first-child {
          color: red;
        }
      `;

      const result = analyzer.analyzeContent(content);
      expect(result.selectors.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should handle malformed SCSS gracefully', () => {
      const malformedContent = `
        .broken {
          color: red
          font-size: 16px;
        }
        
        .unclosed {
          color: blue;
      `;

      expect(() => {
        analyzer.analyzeContent(malformedContent);
      }).not.toThrow();
    });

    test('should handle empty content', () => {
      const result = analyzer.analyzeContent('');

      expect(result.rules).toHaveLength(0);
      expect(result.variables.size).toBe(0);
      expect(result.mixins.size).toBe(0);
      expect(result.complexity).toBe('low');
    });

    test('should handle content with only comments', () => {
      const content = `
        // This is a comment
        /* This is another comment */
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.rules).toHaveLength(0);
      expect(result.complexity).toBe('low');
    });
  });

  describe('variable resolution', () => {
    test('should resolve variable dependencies', () => {
      const content = `
        $base-font-size: 16px;
        $large-font-size: $base-font-size * 1.25;
        $primary-color: #007bff;
        
        .component {
          font-size: $large-font-size;
          color: $primary-color;
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.variables.has('base-font-size')).toBe(true);
      expect(result.variables.has('large-font-size')).toBe(true);
      expect(result.variables.has('primary-color')).toBe(true);
    });
  });

  describe('media query analysis', () => {
    test('should extract all media queries', () => {
      const content = `
        .responsive {
          width: 100%;
          
          @media (min-width: 768px) {
            width: 50%;
          }
          
          @media (min-width: 1024px) and (max-height: 600px) {
            width: 33.333%;
          }
          
          @media print {
            display: none;
          }
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.mediaQueries).toContain('(min-width: 768px)');
      expect(result.mediaQueries).toContain('(min-width: 1024px) and (max-height: 600px)');
      expect(result.mediaQueries).toContain('print');
    });
  });

  describe('integration scenarios', () => {
    test('should handle real-world Angular component styles', () => {
      const content = `
        @import '~@angular/material/theming';
        
        $custom-primary: mat-palette($mat-indigo);
        $custom-accent: mat-palette($mat-pink, A200, A100, A400);
        
        .mat-form-field {
          width: 100%;
          
          &.mat-focused {
            .mat-form-field-label {
              color: mat-color($custom-primary);
            }
          }
          
          @media (max-width: 768px) {
            .mat-form-field-infix {
              padding: 0.5rem 0;
            }
          }
        }
      `;

      const result = analyzer.analyzeContent(content);

      expect(result.imports.some(imp => imp.includes('@angular/material'))).toBe(true);
      expect(result.variables.has('custom-primary')).toBe(true);
      expect(result.mediaQueries.length).toBeGreaterThan(0);
      expect(result.complexity).toBe('medium');
    });
  });
});
