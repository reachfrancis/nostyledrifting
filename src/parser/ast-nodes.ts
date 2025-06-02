
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  offset: number;
  length: number;
  context?: string[];
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
  source: string;
}

export abstract class SCSSNode {
  abstract readonly type: string;
  public parent?: SCSSNode;
  public children: SCSSNode[] = [];
  public location: SourceLocation;

  constructor(location: SourceLocation) {
    this.location = location;
  }

  public addChild(child: SCSSNode): void {
    child.parent = this;
    this.children.push(child);
  }

  public removeChild(child: SCSSNode): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = undefined;
    }
  }

  public findChildrenByType<T extends SCSSNode>(type: string): T[] {
    return this.children.filter(child => child.type === type) as T[];
  }

  public walkChildren(callback: (node: SCSSNode) => void): void {
    for (const child of this.children) {
      callback(child);
      child.walkChildren(callback);
    }
  }
}

// Container Nodes
export class RootNode extends SCSSNode {
  readonly type = 'root';
  
  constructor(location: SourceLocation) {
    super(location);
  }
}

export class RuleNode extends SCSSNode {
  readonly type = 'rule';
  public selector: string;
  
  constructor(selector: string, location: SourceLocation) {
    super(location);
    this.selector = selector;
  }
}

export class AtRuleNode extends SCSSNode {
  readonly type = 'atrule';
  public name: string;
  public params?: string;
  
  constructor(name: string, params: string | undefined, location: SourceLocation) {
    super(location);
    this.name = name;
    this.params = params;
  }
}

export class BlockNode extends SCSSNode {
  readonly type = 'block';
  
  constructor(location: SourceLocation) {
    super(location);
  }
}

// Leaf Nodes
export class DeclarationNode extends SCSSNode {
  readonly type = 'declaration';
  public property: string;
  public value: string;
  public important: boolean;
  
  constructor(property: string, value: string, important: boolean, location: SourceLocation) {
    super(location);
    this.property = property;
    this.value = value;
    this.important = important;
  }
}

export class CommentNode extends SCSSNode {
  readonly type = 'comment';
  public text: string;
  public inline: boolean;
  
  constructor(text: string, inline: boolean, location: SourceLocation) {
    super(location);
    this.text = text;
    this.inline = inline;
  }
}

export class TextNode extends SCSSNode {
  readonly type = 'text';
  public value: string;
  
  constructor(value: string, location: SourceLocation) {
    super(location);
    this.value = value;
  }
}

// SCSS-Specific Nodes
export class VariableNode extends SCSSNode {
  readonly type = 'variable';
  public name: string;
  public value: string;
  public isDefault: boolean;
  public isGlobal: boolean;
  
  constructor(name: string, value: string, isDefault: boolean, isGlobal: boolean, location: SourceLocation) {
    super(location);
    this.name = name;
    this.value = value;
    this.isDefault = isDefault;
    this.isGlobal = isGlobal;
  }
}

export class MixinNode extends SCSSNode {
  readonly type = 'mixin';
  public name: string;
  public parameters: MixinParameter[];
  
  constructor(name: string, parameters: MixinParameter[], location: SourceLocation) {
    super(location);
    this.name = name;
    this.parameters = parameters;
  }
}

export class IncludeNode extends SCSSNode {
  readonly type = 'include';
  public name: string;
  public arguments: string[];
  
  constructor(name: string, args: string[], location: SourceLocation) {
    super(location);
    this.name = name;
    this.arguments = args;
  }
}

export class ExtendNode extends SCSSNode {
  readonly type = 'extend';
  public selector: string;
  
  constructor(selector: string, location: SourceLocation) {
    super(location);
    this.selector = selector;
  }
}

export class FunctionNode extends SCSSNode {
  readonly type = 'function';
  public name: string;
  public parameters: MixinParameter[];
  
  constructor(name: string, parameters: MixinParameter[], location: SourceLocation) {
    super(location);
    this.name = name;
    this.parameters = parameters;
  }
}

// Import Nodes
export abstract class ImportNode extends SCSSNode {
  public path: string;
  public resolvedPath?: string;
  public namespace?: string;
  
  constructor(path: string, location: SourceLocation) {
    super(location);
    this.path = path;
  }
}

export class ImportStatementNode extends ImportNode {
  readonly type = 'import';
  
  constructor(path: string, location: SourceLocation) {
    super(path, location);
  }
}

export class UseStatementNode extends ImportNode {
  readonly type = 'use';
  public asClause?: string;
  public withClause?: Record<string, string>;
  
  constructor(path: string, asClause: string | undefined, withClause: Record<string, string> | undefined, location: SourceLocation) {
    super(path, location);
    this.asClause = asClause;
    this.withClause = withClause;
  }
}

export class ForwardStatementNode extends ImportNode {
  readonly type = 'forward';
  public showClause?: string[];
  public hideClause?: string[];
  public asClause?: string;
  
  constructor(
    path: string, 
    showClause: string[] | undefined, 
    hideClause: string[] | undefined, 
    asClause: string | undefined, 
    location: SourceLocation
  ) {
    super(path, location);
    this.showClause = showClause;
    this.hideClause = hideClause;
    this.asClause = asClause;
  }
}

// Supporting Types
export interface MixinParameter {
  name: string;
  defaultValue?: string;
  isRequired: boolean;
  type?: 'color' | 'number' | 'string' | 'boolean' | 'list' | 'map' | 'null';
}

export interface ScopeInfo {
  variables: Map<string, VariableNode>;
  mixins: Map<string, MixinNode>;
  functions: Map<string, FunctionNode>;
  parent?: ScopeInfo;
}

export interface ComplexityMetrics {
  nestingDepth: number;
  selectorComplexity: number;
  variableCount: number;
  mixinCount: number;
  importCount: number;
  functionCount: number;
  totalNodes: number;
}
