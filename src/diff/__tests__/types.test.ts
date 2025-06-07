import {
  DiffOptions,
  StyleDiffResult,
  FileDiffResult,
  DiffChunk,
  DiffChange,
  CssPropertyChange,
  DiffGroup,
  DiffSummary,
  FileDiffSummary,
  DiffMetadata,
  ChunkContext,
  ScssContext,
  DEFAULT_DIFF_OPTIONS,
  isDiffOptions,
  isStyleDiffResult
} from '../types';

describe('DiffOptions', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_DIFF_OPTIONS.viewMode).toBe('unified');
    expect(DEFAULT_DIFF_OPTIONS.contextLines).toBe(3);
    expect(DEFAULT_DIFF_OPTIONS.groupRelatedChanges).toBe(true);
    expect(DEFAULT_DIFF_OPTIONS.resolveVariables).toBe(true);
    expect(DEFAULT_DIFF_OPTIONS.showOnlyChanges).toBe(false);
    expect(DEFAULT_DIFF_OPTIONS.format).toBe('terminal');
  });

  it('should validate valid DiffOptions with type guard', () => {
    const validOptions: DiffOptions = {
      viewMode: 'split',
      contextLines: 5,
      groupRelatedChanges: false,
      resolveVariables: false,
      showOnlyChanges: true,
      format: 'json'
    };

    expect(isDiffOptions(validOptions)).toBe(true);
  });

  it('should reject invalid DiffOptions with type guard', () => {
    const invalidOptions = {
      viewMode: 'invalid',
      contextLines: 'not-a-number',
      groupRelatedChanges: 'not-a-boolean',
      resolveVariables: true,
      showOnlyChanges: false,
      format: 'terminal'
    };

    expect(isDiffOptions(invalidOptions)).toBe(false);
  });

  it('should reject null or undefined values', () => {
    expect(isDiffOptions(null)).toBe(false);
    expect(isDiffOptions(undefined)).toBe(false);
    expect(isDiffOptions({})).toBe(false);
  });
});

describe('StyleDiffResult', () => {
  const mockStyleDiffResult: StyleDiffResult = {
    branch1: 'main',
    branch2: 'feature-branch',
    fileDiffs: [],    summary: {
      filesChanged: 0,
      totalChanges: 0,
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      propertiesChanged: 0,
      highImpactChanges: 0,
      mediumImpactChanges: 0,
      lowImpactChanges: 0,
      addedLines: 0,
      removedLines: 0,
      modifiedLines: 0
    },
    metadata: {
      comparisonTime: new Date(),
      processingTimeMs: 100,
      diffAlgorithm: 'myers',
      version: '1.0.0',
      options: DEFAULT_DIFF_OPTIONS
    }
  };

  it('should validate valid StyleDiffResult with type guard', () => {
    expect(isStyleDiffResult(mockStyleDiffResult)).toBe(true);
  });

  it('should reject invalid StyleDiffResult with type guard', () => {
    const invalidResult = {
      branch1: 'main',
      // missing required properties
    };

    expect(isStyleDiffResult(invalidResult)).toBe(false);
  });

  it('should have correct structure for all required properties', () => {
    expect(mockStyleDiffResult).toHaveProperty('branch1');
    expect(mockStyleDiffResult).toHaveProperty('branch2');
    expect(mockStyleDiffResult).toHaveProperty('fileDiffs');
    expect(mockStyleDiffResult).toHaveProperty('summary');
    expect(mockStyleDiffResult).toHaveProperty('metadata');
  });
});

describe('CssPropertyChange', () => {
  it('should support all required properties', () => {
    const propertyChange: CssPropertyChange = {
      property: 'font-size',
      oldValue: '14px',
      newValue: '16px',
      category: 'typography',
      impact: 'medium'
    };

    expect(propertyChange.property).toBe('font-size');
    expect(propertyChange.oldValue).toBe('14px');
    expect(propertyChange.newValue).toBe('16px');
    expect(propertyChange.category).toBe('typography');
    expect(propertyChange.impact).toBe('medium');
  });

  it('should support all category types', () => {
    const categories: CssPropertyChange['category'][] = [
      'typography', 'layout', 'color', 'animation', 'other'
    ];

    categories.forEach(category => {
      const change: CssPropertyChange = {
        property: 'test',
        category,
        impact: 'low'
      };
      expect(change.category).toBe(category);
    });
  });

  it('should support all impact levels', () => {
    const impacts: CssPropertyChange['impact'][] = ['high', 'medium', 'low'];

    impacts.forEach(impact => {
      const change: CssPropertyChange = {
        property: 'test',
        category: 'other',
        impact
      };
      expect(change.impact).toBe(impact);
    });
  });
});

describe('ScssContext', () => {
  it('should properly handle Map type for variables', () => {
    const context: ScssContext = {
      variables: new Map([['$primary-color', '#007bff']]),
      mixins: ['button-mixin'],
      imports: ['variables', 'mixins'],
      nestingPath: ['.component', '.header']
    };

    expect(context.variables.get('$primary-color')).toBe('#007bff');
    expect(context.mixins).toContain('button-mixin');
    expect(context.imports).toHaveLength(2);
    expect(context.nestingPath).toHaveLength(2);
  });
});

describe('DiffChange types', () => {
  it('should support all change types', () => {
    const changeTypes: DiffChange['type'][] = ['added', 'removed', 'modified', 'context'];

    changeTypes.forEach(type => {
      const change: DiffChange = {
        type,
        lineNumber: 1,
        content: 'test content'
      };
      expect(change.type).toBe(type);
    });
  });
});

describe('FileDiffResult changeType', () => {
  it('should support all file change types', () => {
    const changeTypes: FileDiffResult['changeType'][] = ['added', 'removed', 'modified', 'unchanged'];

    changeTypes.forEach(changeType => {
      const fileDiff: FileDiffResult = {
        filePath: 'test.scss',
        changeType,
        chunks: [],
        summary: {
          linesAdded: 0,
          linesRemoved: 0,
          linesModified: 0,
          propertiesChanged: 0,
          changeComplexity: 'low'
        }
      };
      expect(fileDiff.changeType).toBe(changeType);
    });
  });
});
