import { TypographyAPI, TypographyExtractor } from './index';
import { 
  RootNode, 
  RuleNode, 
  AtRuleNode, 
  BlockNode, 
  DeclarationNode, 
  VariableNode,
  TextNode,
  SourceLocation,
  ASTNode,
  ASTNodeType,
  SCSSNode
} from '../parser/ast-nodes';
import { TypographyEntry, ExtractionOptions } from './types';

// Helper function to create mock source location
function createMockLocation(file: string = 'test.scss', line: number = 1, column: number = 1): SourceLocation {
  return {
    file,
    line,
    column,
    offset: 0,
    length: 10,
    context: []
  };
}

// Helper function to create mock declaration node
function createMockDeclarationNode(property: string, value: string): DeclarationNode {
  return {
    type: 'declaration',
    property,
    value,
    important: false,
    location: createMockLocation(),
    children: [],
    parent: undefined,
    walkChildren: () => {},
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };
}

// Helper function to create mock block node
function createMockBlockNode(children: DeclarationNode[] = []): BlockNode {
  return {
    type: 'block',
    location: createMockLocation(),
    children,
    parent: undefined,
    walkChildren: (callback) => {
      children.forEach(callback);
    },
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };
}

// Helper function to create mock rule node
function createMockRuleNode(selector: string, children: BlockNode[] = []): RuleNode {
  return {
    type: 'rule',
    selector,
    location: createMockLocation(),
    children,
    parent: undefined,
    walkChildren: (callback) => {
      children.forEach(child => {
        callback(child);
        child.walkChildren(callback);
      });
    },
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };
}

// Helper function to create mock root node
function createMockRootNode(children: RuleNode[] = []): RootNode {
  return {
    type: 'root',
    location: createMockLocation(),
    children,
    parent: undefined,
    walkChildren: (callback) => {
      children.forEach(child => {
        callback(child);
        child.walkChildren(callback);
      });
    },
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };
}

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

      // Debug: Log the actual result structure
      console.log('DEBUG: Typography entries:', result.typography.entries.length);
      console.log('DEBUG: Entries:', JSON.stringify(result.typography.entries.map(e => ({
        selector: e.selector,
        property: e.property,
        value: e.value.resolved,
        isResponsive: e.metadata.isResponsive,
        hasMediaQuery: !!e.context.mediaQuery,
        mediaQuery: e.context.mediaQuery?.breakpoint
      })), null, 2));
      console.log('DEBUG: Summary:', JSON.stringify(result.summary, null, 2));
      console.log('DEBUG: ByBreakpoint size:', result.byBreakpoint.size);
      console.log('DEBUG: ByBreakpoint keys:', Array.from(result.byBreakpoint.keys()));

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
      expect(fontFaces[0].sources[0].url).toContain('custom-font.woff2');
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
    });    it('should validate typography entries', () => {
      const invalidEntries: TypographyEntry[] = [
        {
          id: 'test-1',
          selector: '',
          property: 'font-size',
          value: { 
            original: '16px',
            resolved: '16px'
          },
          context: {
            file: 'test.scss',
            location: { 
              file: 'test.scss',
              line: 1, 
              column: 1, 
              offset: 0,
              length: 10,
              context: []
            },
            scope: {
              currentScope: {
                type: 'global',
                variables: new Map(),
              },
              inheritedScopes: []
            },
            specificity: 0,
            parentSelectors: []
          },
          dependencies: {
            variables: [],
            mixins: [],
            imports: [],
            customProperties: []
          },
          metadata: {
            isResponsive: false,
            hasVariables: false,
            hasFunctions: false,
            isInherited: false,
            overrides: []
          }
        }
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

describe('Advanced Typography Extraction', () => {
  let extractor: TypographyExtractor;
  let api: TypographyAPI;

  beforeEach(() => {    api = new TypographyAPI({
      maxCacheSize: 100,
      timeoutMs: 5000,
      enableStreaming: true,
      chunkSize: 50
    });
    extractor = new TypographyExtractor({
      maxCacheSize: 100,
      enableStreaming: true,
      timeoutMs: 5000
    });
  });

  afterEach(() => {
    api.clearCache();
  });

  describe('createTypographyEntries method', () => {
    it('should handle single entry from property extractor', async () => {      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'font-family',
        value: 'Arial, sans-serif',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {},
        addChild: () => {},
        removeChild: () => {},
        findChildrenByType: () => []
      };

      const variableContext = {
        currentScope: 'global',
        scssVariables: new Map(),
        customProperties: new Map(),
        importedVariables: new Map(),
        resolvedValues: new Map()
      };

      // Access the private method through type assertion for testing
      const result = await (extractor as any).createTypographyEntries(
        declNode,
        '.component',
        ['.component'],
        variableContext,
        [],
        { resolveVariables: true, computeValues: true }
      );

      expect(result).toBeDefined();
      if (Array.isArray(result)) {
        expect(result).toHaveLength(1);
        expect(result[0].property).toBe('font-family');
      } else {
        expect(result.property).toBe('font-family');
      }
    });

    it('should handle multiple entries from FontShorthandExtractor', async () => {      const declNode: DeclarationNode = createMockDeclarationNode('font', 'bold 16px/1.5 Arial, sans-serif');

      const variableContext = {
        currentScope: 'global',
        scssVariables: new Map(),
        customProperties: new Map(),
        importedVariables: new Map(),
        resolvedValues: new Map()
      };

      // Access the private method through type assertion for testing
      const result = await (extractor as any).createTypographyEntries(
        declNode,
        '.component',
        ['.component'],
        variableContext,
        [],
        { resolveVariables: true, computeValues: true }
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (Array.isArray(result)) {
        // FontShorthandExtractor should create multiple entries
        expect(result.length).toBeGreaterThan(1);
        
        // Check that we have expected properties
        const properties = result.map(entry => entry.property);
        expect(properties).toContain('font-weight');
        expect(properties).toContain('font-size');
        expect(properties).toContain('line-height');
        expect(properties).toContain('font-family');
      }
    });

    it('should fall back to legacy creation for properties without extractors', async () => {      const declNode: DeclarationNode = createMockDeclarationNode('text-shadow', '1px 1px 2px rgba(0,0,0,0.5)');

      const variableContext = {
        currentScope: 'global',
        scssVariables: new Map(),
        customProperties: new Map(),
        importedVariables: new Map(),
        resolvedValues: new Map()
      };

      // Access the private method through type assertion for testing
      const result = await (extractor as any).createTypographyEntries(
        declNode,
        '.component',
        ['.component'],
        variableContext,
        [],
        { resolveVariables: true, computeValues: true }
      );

      expect(result).toBeDefined();
      if (Array.isArray(result)) {
        expect(result).toHaveLength(1);
        expect(result[0].property).toBe('text-shadow');
      } else {
        expect(result.property).toBe('text-shadow');
      }
    });
  });

  describe('completeTypographyEntry method', () => {
    it('should merge partial entry with full context', async () => {
      const partialEntry: Partial<TypographyEntry> = {
        property: 'font-weight',
        value: {
          original: 'bold',
          resolved: '700'
        }
      };      const declNode: DeclarationNode = createMockDeclarationNode('font', 'bold 16px Arial');

      const variableContext = {
        currentScope: 'global',
        scssVariables: new Map(),
        customProperties: new Map(),
        importedVariables: new Map(),
        resolvedValues: new Map()
      };

      // Access the private method through type assertion for testing
      const result = await (extractor as any).completeTypographyEntry(
        partialEntry,
        declNode,
        '.component',
        ['.component'],
        variableContext,
        [],
        { resolveVariables: true, computeValues: true }
      );

      expect(result).toBeDefined();
      expect(result.property).toBe('font-weight');
      expect(result.value.original).toBe('bold');
      expect(result.value.resolved).toBe('700');
      expect(result.selector).toBe('.component');
      expect(result.context.parentSelectors).toEqual(['.component']);
      expect(result.id).toBeDefined();
    });

    it('should provide defaults for missing fields', async () => {
      const partialEntry: Partial<TypographyEntry> = {
        property: 'font-size'
      };

      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'font',
        value: '16px Arial',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => { },
        addChild: function (child: SCSSNode): void {
          throw new Error('Function not implemented.');
        },
        removeChild: function (child: SCSSNode): void {
          throw new Error('Function not implemented.');
        },
        findChildrenByType: function <T extends SCSSNode>(type: string): T[] {
          throw new Error('Function not implemented.');
        }
      };

      const variableContext = {
        currentScope: 'global',
        scssVariables: new Map(),
        customProperties: new Map(),
        importedVariables: new Map(),
        resolvedValues: new Map()
      };

      // Access the private method through type assertion for testing
      const result = await (extractor as any).completeTypographyEntry(
        partialEntry,
        declNode,
        '.component',
        ['.component'],
        variableContext,
        [],
        { resolveVariables: true, computeValues: true }
      );

      expect(result).toBeDefined();
      expect(result.property).toBe('font-size');
      expect(result.value.original).toBe('16px Arial'); // Should default to declNode.value
      expect(result.value.resolved).toBe('16px Arial');
      expect(result.selector).toBe('.component');
      expect(result.metadata.isResponsive).toBe(false);
      expect(result.metadata.hasVariables).toBe(false);
      expect(result.metadata.hasFunctions).toBe(false);
    });
  });

  describe('FontShorthandExtractor Integration', () => {
    it('should extract multiple properties from font shorthand', async () => {
      const ast = createFontShorthandAST();
      const result = await api.extractFromAST(ast, 'font-shorthand.scss');

      expect(result.typography.entries.length).toBeGreaterThan(1);
      
      const properties = result.typography.entries.map((entry: TypographyEntry) => entry.property);
      expect(properties).toContain('font-weight');
      expect(properties).toContain('font-size');
      expect(properties).toContain('line-height');
      expect(properties).toContain('font-family');
    });

    it('should handle complex font shorthand values', async () => {
      const ast = createComplexFontShorthandAST();
      const result = await api.extractFromAST(ast, 'complex-font.scss');

      const fontWeightEntry = result.typography.entries.find((e: TypographyEntry) => e.property === 'font-weight');
      const fontSizeEntry = result.typography.entries.find((e: TypographyEntry) => e.property === 'font-size');
      const lineHeightEntry = result.typography.entries.find((e: TypographyEntry) => e.property === 'line-height');
      
      expect(fontWeightEntry).toBeDefined();
      expect(fontSizeEntry).toBeDefined();
      expect(lineHeightEntry).toBeDefined();
      
      expect(fontWeightEntry?.value.resolved).toBe('700');
      expect(fontSizeEntry?.value.resolved).toBe('16px');
      expect(lineHeightEntry?.value.resolved).toBe('1.5');
    });
  });

  describe('Array Handling in Extraction Loop', () => {
    it('should properly flatten arrays from property extractors', async () => {
      const ast = createMixedPropertiesAST();
      const result = await api.extractFromAST(ast, 'mixed.scss');

      // Should have entries from both regular properties and font shorthand
      const fontFamilyEntries = result.typography.entries.filter((e: TypographyEntry) => e.property === 'font-family');
      const fontWeightEntries = result.typography.entries.filter((e: TypographyEntry) => e.property === 'font-weight');
      
      expect(fontFamilyEntries.length).toBeGreaterThan(0);
      expect(fontWeightEntries.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions to create test ASTs
function createComponentStyleAST(): ASTNode {
  const location = createMockLocation();
  
  // Create the root stylesheet
  const root = new RootNode(location);
  
  // Create rule node (.component)
  const rule = new RuleNode('.component', location);
  
  // Create declaration block
  const block = new BlockNode(location);
  
  // Create declarations
  const fontFamily = new DeclarationNode('font-family', 'Inter, sans-serif', false, location);
  const fontSize = new DeclarationNode('font-size', '16px', false, location);
  const fontWeight = new DeclarationNode('font-weight', '400', false, location);
  const lineHeight = new DeclarationNode('line-height', '1.5', false, location);
  
  // Add declarations to block
  block.addChild(fontFamily);
  block.addChild(fontSize);
  block.addChild(fontWeight);
  block.addChild(lineHeight);
  
  // Add block to rule
  rule.addChild(block);
  
  // Add rule to root
  root.addChild(rule);
  
  return root;
}

function createVariableAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create variable declaration
  const variable = new VariableNode('$font-size-base', '16px', false, false, location);
  root.addChild(variable);
  
  // Create rule using the variable
  const rule = new RuleNode('.text', location);
  const block = new BlockNode(location);
  const fontSize = new DeclarationNode('font-size', '$font-size-base', false, location);
  
  block.addChild(fontSize);
  rule.addChild(block);
  root.addChild(rule);
  
  return root;
}

function createFunctionAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  const rule = new RuleNode('.text', location);
  const block = new BlockNode(location);
  const lineHeight = new DeclarationNode('line-height', 'calc(1.5 * 1em)', false, location);
  
  block.addChild(lineHeight);
  rule.addChild(block);
  root.addChild(rule);
  
  return root;
}

function createResponsiveAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create media query at-rule
  const mediaRule = new AtRuleNode('media', '(min-width: 768px)', location);
  
  // Create rule inside media query
  const rule = new RuleNode('.responsive-text', location);
  const block = new BlockNode(location);
  const fontSize = new DeclarationNode('font-size', '18px', false, location);
  
  block.addChild(fontSize);
  rule.addChild(block);
  mediaRule.addChild(rule);
  root.addChild(mediaRule);
  
  return root;
}

function createFontFaceAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create @font-face at-rule
  const fontFaceRule = new AtRuleNode('font-face', '', location);
  const block = new BlockNode(location);
  
  // Create declarations
  const fontFamily = new DeclarationNode('font-family', 'CustomFont', false, location);
  const src = new DeclarationNode('src', 'url("custom-font.woff2") format("woff2")', false, location);
  const fontWeight = new DeclarationNode('font-weight', '400', false, location);
  
  block.addChild(fontFamily);
  block.addChild(src);
  block.addChild(fontWeight);
  fontFaceRule.addChild(block);
  root.addChild(fontFaceRule);
  
  return root;
}

function createCustomPropertiesAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create :root rule
  const rootRule = new RuleNode(':root', location);
  const block = new BlockNode(location);
  
  // Create custom property declarations
  const fontSizeBase = new DeclarationNode('--font-size-base', '16px', false, location);
  const lineHeightBase = new DeclarationNode('--line-height-base', '1.5', false, location);
  
  block.addChild(fontSizeBase);
  block.addChild(lineHeightBase);
  rootRule.addChild(block);
  root.addChild(rootRule);
  
  return root;
}

function createLargeAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create 100 rules for testing large AST performance
  for (let i = 0; i < 100; i++) {
    const rule = new RuleNode(`.component-${i}`, location);
    const block = new BlockNode(location);
    const fontSize = new DeclarationNode('font-size', `${14 + i}px`, false, location);
    
    block.addChild(fontSize);
    rule.addChild(block);
    root.addChild(rule);
  }
  
  return root;
}

function createInvalidAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create a rule with intentionally invalid/null selector for error testing
  const rule = new RuleNode('', location); // Empty selector instead of null
  const block = new BlockNode(location);
  
  rule.addChild(block);
  root.addChild(rule);
  
  return root;
}

function createAccessibilityTestAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create rule for small text accessibility testing
  const rule = new RuleNode('.small-text', location);
  const block = new BlockNode(location);
  
  // Create declarations with potentially problematic accessibility values
  const fontSize = new DeclarationNode('font-size', '12px', false, location);
  const lineHeight = new DeclarationNode('line-height', '1.2', false, location);
  
  block.addChild(fontSize);
  block.addChild(lineHeight);
  rule.addChild(block);
  root.addChild(rule);
    return root;
}

function createFontAccessibilityAST(): ASTNode {
  const location = createMockLocation();
  
  const root = new RootNode(location);
  
  // Create rule for system font accessibility testing
  const rule = new RuleNode('.system-font', location);
  const block = new BlockNode(location);
  
  // Create declaration with system font stack
  const fontFamily = new DeclarationNode('font-family', 'system-ui, -apple-system, sans-serif', false, location);
  
  block.addChild(fontFamily);
  rule.addChild(block);
  root.addChild(rule);
  
  return root;
}

// Helper functions for creating test ASTs
function createFontShorthandAST(): SCSSNode {
  const location = createMockLocation();
  
  const declaration = createMockDeclarationNode('font', 'bold 16px/1.5 Arial, sans-serif');
  const block = createMockBlockNode([declaration]);
  const rule = createMockRuleNode('.font-shorthand', [block]);
  const root = createMockRootNode([rule]);

  declaration.parent = block;
  block.parent = rule;
  rule.parent = root;

  return root;
}

function createComplexFontShorthandAST(): SCSSNode {
  const location = createMockLocation();
  
  const declaration = createMockDeclarationNode('font', 'italic small-caps bold 16px/1.5 "Helvetica Neue", Arial, sans-serif');
  const block = createMockBlockNode([declaration]);
  const rule = createMockRuleNode('.complex-font', [block]);
  const root = createMockRootNode([rule]);

  declaration.parent = block;
  block.parent = rule;
  rule.parent = root;

  return root;
}

function createMixedPropertiesAST(): SCSSNode {
  const location = createMockLocation();
  
  const fontDeclaration = createMockDeclarationNode('font', 'bold 16px Arial');
  const colorDeclaration = createMockDeclarationNode('color', '#333');
  const textTransformDeclaration = createMockDeclarationNode('text-transform', 'uppercase');

  const block = createMockBlockNode([fontDeclaration, colorDeclaration, textTransformDeclaration]);
  const rule = createMockRuleNode('.mixed-properties', [block]);
  const root = createMockRootNode([rule]);

  fontDeclaration.parent = block;
  colorDeclaration.parent = block;
  textTransformDeclaration.parent = block;
  block.parent = rule;
  rule.parent = root;

  return root;
}
