
import { TypographyAPI } from './index';
import { ASTNode, ASTNodeType } from '../parser/ast-nodes';
import { TypographyEntry, ExtractionOptions } from './types';

describe('Typography Integration Tests', () => {
  let api: TypographyAPI;

  beforeEach(() => {
    api = new TypographyAPI({
      maxCacheSize: 100,
      timeoutMs: 5000,
      enableStreaming: true,
      chunkSize: 50
    });
  });

  afterEach(() => {
    api.clearCache();
  });

  describe('Basic Typography Extraction', () => {
    it('should extract typography from component styles', async () => {
      const ast = createComponentStyleAST();
      const result = await api.extractFromAST(ast, 'component.scss');

      expect(result.typography.entries).toHaveLength(4);
      expect(result.summary.totalProperties).toBe(4);
      expect(result.fontStacks.length).toBeGreaterThan(0);
    });

    it('should extract typography with variable resolution', async () => {
      const ast = createVariableAST();
      const result = await api.extractFromAST(ast, 'variables.scss', {
        resolveVariables: true
      });

      const fontSizeEntry = result.typography.entries.find(
        entry => entry.property === 'font-size'
      );
      expect(fontSizeEntry?.value.resolved).toBe('16px');
    });

    it('should extract typography with function evaluation', async () => {
      const ast = createFunctionAST();
      const result = await api.extractFromAST(ast, 'functions.scss', {
        evaluateFunctions: true
      });

      const lineHeightEntry = result.typography.entries.find(
        entry => entry.property === 'line-height'
      );
      expect(lineHeightEntry?.value.computed).toBeDefined();
    });

    it('should extract responsive typography', async () => {
      const ast = createResponsiveAST();
      const result = await api.extractFromAST(ast, 'responsive.scss');

      expect(result.summary.responsiveProperties).toBeGreaterThan(0);
      expect(result.byBreakpoint.size).toBeGreaterThan(0);
    });
  });

  describe('Font Face Extraction', () => {
    it('should extract font face declarations', async () => {
      const ast = createFontFaceAST();
      const fontFaces = await api.extractFontFaces(ast, 'fonts.scss');

      expect(fontFaces).toHaveLength(1);
      expect(fontFaces[0].fontFamily).toBe('CustomFont');
      expect(fontFaces[0].src).toContain('custom-font.woff2');
    });

    it('should provide font loading recommendations', async () => {
      const ast = createFontFaceAST();
      const result = await api.extractFromAST(ast, 'fonts.scss');

      expect(result.accessibility.fontAccessibility.webFontFallbacks).toBe(true);
    });
  });

  describe('Custom Properties Extraction', () => {
    it('should extract CSS custom properties', async () => {
      const ast = createCustomPropertiesAST();
      const customProps = await api.extractCustomProperties(ast, 'custom.scss');

      expect(customProps).toHaveLength(2);
      expect(customProps.find(prop => prop.name === '--font-size-base')).toBeDefined();
    });
  });

  describe('Multiple File Processing', () => {
    it('should process multiple ASTs and merge results', async () => {
      const asts = [
        { ast: createComponentStyleAST(), filePath: 'component1.scss' },
        { ast: createComponentStyleAST(), filePath: 'component2.scss' }
      ];

      const result = await api.extractFromMultipleASTs(asts);
      expect(result.typography.entries.length).toBeGreaterThan(4);
    });

    it('should analyze consistency across multiple files', async () => {
      const results = [
        await api.extractFromAST(createComponentStyleAST(), 'comp1.scss'),
        await api.extractFromAST(createComponentStyleAST(), 'comp2.scss')
      ];

      const consistency = await api.analyzeConsistency(results);
      expect(consistency.consistency).toBeDefined();
      expect(consistency.consistency.fontFamilyConsistency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Property Filtering', () => {
    it('should extract only specified properties', async () => {
      const ast = createComponentStyleAST();
      const entries = await api.extractProperties(
        ast, 
        'component.scss',
        ['font-size', 'font-family']
      );

      expect(entries.every(entry => 
        ['font-size', 'font-family'].includes(entry.property)
      )).toBe(true);
    });
  });

  describe('Streaming Extraction', () => {
    it('should stream typography entries for large files', async () => {
      const ast = createLargeAST();
      const entries: TypographyEntry[] = [];

      for await (const entry of api.streamExtractFromAST(ast, 'large.scss')) {
        entries.push(entry);
      }

      expect(entries.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid AST gracefully', async () => {
      const invalidAST = createInvalidAST();
      
      await expect(api.extractFromAST(invalidAST, 'invalid.scss'))
        .resolves.toBeDefined();
    });

    it('should validate typography entries', () => {
      const invalidEntries: TypographyEntry[] = [
        {
          selector: '',
          property: 'font-size',
          value: { original: '16px' },
          context: {
            location: { line: 1, column: 1, index: 0 },
            parentRule: null,
            mediaQuery: null,
            declaration: null
          }
        } as TypographyEntry
      ];

      const errors = api.validateEntries(invalidEntries);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache extraction results', async () => {
      const ast = createComponentStyleAST();
      
      // First extraction
      const result1 = await api.extractFromAST(ast, 'component.scss');
      
      // Second extraction (should use cache)
      const result2 = await api.extractFromAST(ast, 'component.scss');
      
      expect(result1).toEqual(result2);
    });

    it('should provide cache statistics', () => {
      const stats = api.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Accessibility Analysis', () => {
    it('should provide accessibility recommendations', async () => {
      const ast = createAccessibilityTestAST();
      const result = await api.extractFromAST(ast, 'accessibility.scss');

      expect(result.accessibility.readability.minimumFontSize).toBeDefined();
      expect(result.accessibility.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it('should analyze font accessibility', async () => {
      const ast = createFontAccessibilityAST();
      const result = await api.extractFromAST(ast, 'fonts.scss');

      expect(result.accessibility.fontAccessibility.systemFontUsage).toBeDefined();
      expect(result.accessibility.fontAccessibility.webFontFallbacks).toBeDefined();
    });
  });

  describe('Typography Recommendations', () => {
    it('should generate typography recommendations', async () => {
      const ast = createComponentStyleAST();
      const result = await api.extractFromAST(ast, 'component.scss');
      const recommendations = await api.getRecommendations(result);

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});

// Helper functions to create test ASTs
function createComponentStyleAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: '.component',
            children: []
          },
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-family',
                value: 'Inter, sans-serif',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-size',
                value: '16px',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-weight',
                value: '400',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: 'line-height',
                value: '1.5',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

function createVariableAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.VARIABLE_DECLARATION,
        property: '$font-size-base',
        value: '16px',
        children: []
      },
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: '.text',
            children: []
          },
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-size',
                value: '$font-size-base',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

function createFunctionAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: '.text',
            children: []
          },
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: 'line-height',
                value: 'calc(1.5 * 1em)',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

function createResponsiveAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.AT_RULE,
        name: 'media',
        parameters: '(min-width: 768px)',
        children: [
          {
            type: ASTNodeType.RULE,
            children: [
              {
                type: ASTNodeType.SELECTOR,
                value: '.responsive-text',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION_BLOCK,
                children: [
                  {
                    type: ASTNodeType.DECLARATION,
                    property: 'font-size',
                    value: '18px',
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

function createFontFaceAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.AT_RULE,
        name: 'font-face',
        children: [
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-family',
                value: 'CustomFont',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: 'src',
                value: 'url("custom-font.woff2") format("woff2")',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-weight',
                value: '400',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

function createCustomPropertiesAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: ':root',
            children: []
          },
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: '--font-size-base',
                value: '16px',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: '--line-height-base',
                value: '1.5',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

function createLargeAST(): ASTNode {
  const rules = [];
  for (let i = 0; i < 100; i++) {
    rules.push({
      type: ASTNodeType.RULE,
      children: [
        {
          type: ASTNodeType.SELECTOR,
          value: `.component-${i}`,
          children: []
        },
        {
          type: ASTNodeType.DECLARATION_BLOCK,
          children: [
            {
              type: ASTNodeType.DECLARATION,
              property: 'font-size',
              value: `${14 + i}px`,
              children: []
            }
          ]
        }
      ]
    });
  }

  return {
    type: ASTNodeType.STYLESHEET,
    children: rules
  };
}

function createInvalidAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: null as any,
            children: []
          }
        ]
      }
    ]
  };
}

function createAccessibilityTestAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: '.small-text',
            children: []
          },
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-size',
                value: '12px',
                children: []
              },
              {
                type: ASTNodeType.DECLARATION,
                property: 'line-height',
                value: '1.2',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

function createFontAccessibilityAST(): ASTNode {
  return {
    type: ASTNodeType.STYLESHEET,
    children: [
      {
        type: ASTNodeType.RULE,
        children: [
          {
            type: ASTNodeType.SELECTOR,
            value: '.system-font',
            children: []
          },
          {
            type: ASTNodeType.DECLARATION_BLOCK,
            children: [
              {
                type: ASTNodeType.DECLARATION,
                property: 'font-family',
                value: 'system-ui, -apple-system, sans-serif',
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}
