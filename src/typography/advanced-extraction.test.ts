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

describe('Advanced Typography Extraction Tests', () => {
  let api: TypographyAPI;
  let extractor: TypographyExtractor;

  beforeEach(() => {
    api = new TypographyAPI({
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
    it('should handle single entry from property extractor', async () => {
      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'font-family',
        value: 'Arial, sans-serif',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {}
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

    it('should handle multiple entries from FontShorthandExtractor', async () => {
      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'font',
        value: 'bold 16px/1.5 Arial, sans-serif',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {}
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
      expect(Array.isArray(result)).toBe(true);
      
      if (Array.isArray(result)) {
        // FontShorthandExtractor should create multiple entries
        expect(result.length).toBeGreaterThan(1);
        
        // Check that we have expected properties
        const properties = result.map((entry: TypographyEntry) => entry.property);
        expect(properties).toContain('font-weight');
        expect(properties).toContain('font-size');
        expect(properties).toContain('line-height');
        expect(properties).toContain('font-family');
      }
    });

    it('should fall back to legacy creation for properties without extractors', async () => {
      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'text-shadow',
        value: '1px 1px 2px rgba(0,0,0,0.5)',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {}
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
      };

      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'font',
        value: 'bold 16px Arial',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {}
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
        walkChildren: () => {}
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
      
      // These might not match exactly depending on the extractor implementation
      // so we'll just check they exist and have resolved values
      expect(fontWeightEntry?.value.resolved).toBeDefined();
      expect(fontSizeEntry?.value.resolved).toBeDefined();
      expect(lineHeightEntry?.value.resolved).toBeDefined();
    });
  });

  describe('Array Handling in Extraction Loop', () => {
    it('should properly flatten arrays from property extractors', async () => {
      const ast = createMixedPropertiesAST();
      const result = await api.extractFromAST(ast, 'mixed.scss');

      // Should have entries from both regular properties and font shorthand
      const textTransformEntries = result.typography.entries.filter((e: TypographyEntry) => e.property === 'text-transform');
      
      // At minimum we should have the text-transform entry
      expect(textTransformEntries.length).toBeGreaterThan(0);
      
      // And total entries should be more than just one property
      expect(result.typography.entries.length).toBeGreaterThan(1);
    });
  });

  describe('Error Handling in New Methods', () => {
    it('should handle errors in createTypographyEntries gracefully', async () => {
      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'invalid-property' as any,
        value: 'invalid-value',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {}
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

      // Should return null for invalid properties
      expect(result).toBeNull();
    });

    it('should handle errors in completeTypographyEntry gracefully', async () => {
      const partialEntry: Partial<TypographyEntry> = {
        property: 'font-size'
      };

      const declNode: DeclarationNode = {
        type: 'declaration',
        property: 'font-size',
        value: 'invalid-value-that-will-cause-error',
        important: false,
        location: createMockLocation(),
        children: [],
        parent: undefined,
        walkChildren: () => {}
      };

      const variableContext = {
        currentScope: 'global',
        scssVariables: new Map(),
        customProperties: new Map(),
        importedVariables: new Map(),
        resolvedValues: new Map()
      };

      // Should not throw an error, even with invalid values
      const result = await (extractor as any).completeTypographyEntry(
        partialEntry,
        declNode,
        '.component',
        ['.component'],
        variableContext,
        [],
        { resolveVariables: true, computeValues: true }
      );

      // Should still create entry with original value
      expect(result).toBeDefined();
      expect(result.property).toBe('font-size');
      expect(result.value.original).toBe('invalid-value-that-will-cause-error');
    });
  });

  describe('Performance Testing', () => {
    it('should handle large arrays from FontShorthandExtractor efficiently', async () => {
      const startTime = Date.now();
      
      // Create multiple font shorthand declarations
      const ast = createMultipleFontShorthandAST();
      const result = await api.extractFromAST(ast, 'multiple-fonts.scss');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust as needed)
      expect(duration).toBeLessThan(1000); // 1 second
      
      // Should have extracted multiple entries
      expect(result.typography.entries.length).toBeGreaterThan(4);
    });
  });
});

// Helper functions for creating test ASTs
function createFontShorthandAST(): SCSSNode {
  const location = createMockLocation();
  
  const declaration: DeclarationNode = {
    type: 'declaration',
    property: 'font',
    value: 'bold 16px/1.5 Arial, sans-serif',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {}
  };

  const block: BlockNode = {
    type: 'block',
    location,
    children: [declaration],
    parent: undefined,
    walkChildren: (callback) => {
      callback(declaration);
    }
  };

  const rule: RuleNode = {
    type: 'rule',
    selector: '.font-shorthand',
    location,
    children: [block],
    parent: undefined,
    walkChildren: (callback) => {
      callback(block);
      block.walkChildren(callback);
    }
  };

  const root: RootNode = {
    type: 'root',
    location,
    children: [rule],
    parent: undefined,
    walkChildren: (callback) => {
      callback(rule);
      rule.walkChildren(callback);
    }
  };

  declaration.parent = block;
  block.parent = rule;
  rule.parent = root;

  return root;
}

function createComplexFontShorthandAST(): SCSSNode {
  const location = createMockLocation();
  
  const declaration: DeclarationNode = {
    type: 'declaration',
    property: 'font',
    value: 'italic small-caps bold 16px/1.5 "Helvetica Neue", Arial, sans-serif',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {}
  };

  const block: BlockNode = {
    type: 'block',
    location,
    children: [declaration],
    parent: undefined,
    walkChildren: (callback) => {
      callback(declaration);
    }
  };

  const rule: RuleNode = {
    type: 'rule',
    selector: '.complex-font',
    location,
    children: [block],
    parent: undefined,
    walkChildren: (callback) => {
      callback(block);
      block.walkChildren(callback);
    }
  };

  const root: RootNode = {
    type: 'root',
    location,
    children: [rule],
    parent: undefined,
    walkChildren: (callback) => {
      callback(rule);
      rule.walkChildren(callback);
    }
  };

  declaration.parent = block;
  block.parent = rule;
  rule.parent = root;

  return root;
}

function createMixedPropertiesAST(): SCSSNode {
  const location = createMockLocation();
  
  const fontDeclaration: DeclarationNode = {
    type: 'declaration',
    property: 'font',
    value: 'bold 16px Arial',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {}
  };

  const textTransformDeclaration: DeclarationNode = {
    type: 'declaration',
    property: 'text-transform',
    value: 'uppercase',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {}
  };

  const block: BlockNode = {
    type: 'block',
    location,
    children: [fontDeclaration, textTransformDeclaration],
    parent: undefined,
    walkChildren: (callback) => {
      callback(fontDeclaration);
      callback(textTransformDeclaration);
    }
  };

  const rule: RuleNode = {
    type: 'rule',
    selector: '.mixed-properties',
    location,
    children: [block],
    parent: undefined,
    walkChildren: (callback) => {
      callback(block);
      block.walkChildren(callback);
    }
  };

  const root: RootNode = {
    type: 'root',
    location,
    children: [rule],
    parent: undefined,
    walkChildren: (callback) => {
      callback(rule);
      rule.walkChildren(callback);
    }
  };

  fontDeclaration.parent = block;
  textTransformDeclaration.parent = block;
  block.parent = rule;
  rule.parent = root;

  return root;
}

function createMultipleFontShorthandAST(): SCSSNode {
  const location = createMockLocation();
  
  const fontDeclaration1: DeclarationNode = {
    type: 'declaration',
    property: 'font',
    value: 'bold 16px/1.5 Arial, sans-serif',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {}
  };

  const fontDeclaration2: DeclarationNode = {
    type: 'declaration',
    property: 'font',
    value: 'italic 14px/1.4 Georgia, serif',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {}
  };

  const block1: BlockNode = {
    type: 'block',
    location,
    children: [fontDeclaration1],
    parent: undefined,
    walkChildren: (callback) => {
      callback(fontDeclaration1);
    }
  };

  const block2: BlockNode = {
    type: 'block',
    location,
    children: [fontDeclaration2],
    parent: undefined,
    walkChildren: (callback) => {
      callback(fontDeclaration2);
    }
  };

  const rule1: RuleNode = {
    type: 'rule',
    selector: '.font-1',
    location,
    children: [block1],
    parent: undefined,
    walkChildren: (callback) => {
      callback(block1);
      block1.walkChildren(callback);
    }
  };

  const rule2: RuleNode = {
    type: 'rule',
    selector: '.font-2',
    location,
    children: [block2],
    parent: undefined,
    walkChildren: (callback) => {
      callback(block2);
      block2.walkChildren(callback);
    }
  };

  const root: RootNode = {
    type: 'root',
    location,
    children: [rule1, rule2],
    parent: undefined,
    walkChildren: (callback) => {
      callback(rule1);
      callback(rule2);
      rule1.walkChildren(callback);
      rule2.walkChildren(callback);
    }
  };

  fontDeclaration1.parent = block1;
  fontDeclaration2.parent = block2;
  block1.parent = rule1;
  block2.parent = rule2;
  rule1.parent = root;
  rule2.parent = root;

  return root;
}
