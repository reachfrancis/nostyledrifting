import { TypographyExtractor } from './typography-extractor';
import { SCSSNode, DeclarationNode, RuleNode } from '../parser/ast-nodes';
import { SourceLocation } from './types';

// Helper function to create mock source location
function createMockLocation(file: string = 'test.scss', line: number = 1, column: number = 1): SourceLocation {
  return {
    file,
    line,
    column,
    offset: 0,
    length: 10
  };
}

// Helper function to create mock AST
function createMockAST(): SCSSNode {
  const location = createMockLocation();
  
  const declaration: DeclarationNode = {
    type: 'declaration',
    property: 'font-size',
    value: '20px',
    important: false,
    location,
    children: [],
    parent: undefined,
    walkChildren: () => {},
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };

  const rule: RuleNode = {
    type: 'rule',
    selector: 'h1',
    location,
    children: [declaration],
    parent: undefined,
    walkChildren: (callback) => {
      callback(declaration);
    },
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };

  return {
    type: 'root',
    location,
    children: [rule],
    parent: undefined,
    walkChildren: (callback) => {
      callback(rule);
      rule.walkChildren(callback);
    },
    addChild: () => {},
    removeChild: () => {},
    findChildrenByType: () => []
  };
}

describe('TypographyExtractor', () => {
  let extractor: TypographyExtractor;

  beforeEach(() => {
    extractor = new TypographyExtractor();
  });

  test('extracts correct typography styles', async () => {
    const ast = createMockAST();
    const result = await extractor.extract(ast);
    
    expect(result.typography.entries).toBeDefined();
    expect(result.typography.entries.length).toBeGreaterThan(0);
    expect(result.typography.entries[0].property).toBe('font-size');
    expect(result.typography.entries[0].value.original).toBe('20px');
  });

  test('returns empty result for empty AST', async () => {
    const emptyAST: SCSSNode = {
      type: 'root',
      location: createMockLocation(),
      children: [],
      parent: undefined,
      walkChildren: () => {},
      addChild: () => {},
      removeChild: () => {},
      findChildrenByType: () => []
    };
    
    const result = await extractor.extract(emptyAST);
    expect(result.typography.entries).toHaveLength(0);
  });
});