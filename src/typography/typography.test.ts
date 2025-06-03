
import { TypographyAPI } from './index';
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
