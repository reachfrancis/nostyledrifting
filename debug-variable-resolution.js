const { TypographyAPI } = require('./dist/typography/index.js');
const { VariableNode, RootNode, RuleNode, BlockNode, DeclarationNode } = require('./dist/parser/ast-nodes.js');

function createMockLocation() {
  return {
    file: 'test.scss',
    line: 1,
    column: 1,
    offset: 0,
    length: 10,
    context: []
  };
}

function createVariableAST() {
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

async function debugVariableResolution() {
  const api = new TypographyAPI();
  const ast = createVariableAST();
  
  console.log('AST structure:');
  console.log('Root children:', ast.children.map(child => ({ type: child.type, ...(child.name ? { name: child.name } : {}) })));
  
  const variableChild = ast.children.find(child => child.type === 'variable');
  if (variableChild) {
    console.log('Variable node:', { name: variableChild.name, value: variableChild.value });
  }
  
  const result = await api.extractFromAST(ast, 'variables.scss', {
    resolveVariables: true
  });
  
  console.log('Extraction result:');
  console.log('Typography entries:', result.typography.entries.length);
  
  const fontSizeEntry = result.typography.entries.find(
    entry => entry.property === 'font-size'
  );
  
  if (fontSizeEntry) {
    console.log('Font size entry:', {
      property: fontSizeEntry.property,
      originalValue: fontSizeEntry.value.original,
      resolvedValue: fontSizeEntry.value.resolved
    });
  } else {
    console.log('No font-size entry found');
  }
}

debugVariableResolution().catch(console.error);
