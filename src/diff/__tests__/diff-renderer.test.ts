/**
 * Test suite for diff rendering system
 * Tests all renderer formats and the main orchestrator
 */

import { DiffRenderer, createDiffRenderer, quickRender } from '../diff-renderer';
import { TerminalRenderer } from '../renderers/terminal-renderer';
import { JsonRenderer } from '../renderers/json-renderer';
import { HtmlRenderer } from '../renderers/html-renderer';
import { StyleDiffResult, DiffChange, DiffChunk } from '../types';

// Mock data for testing
const createMockDiffResult = (): StyleDiffResult => ({
  branch1: 'main',
  branch2: 'feature-branch',
  summary: {
    filesChanged: 2,
    totalChanges: 5,
    linesAdded: 3,
    linesRemoved: 1,
    linesModified: 1,
    propertiesChanged: 0,
    highImpactChanges: 0,
    mediumImpactChanges: 0,
    lowImpactChanges: 0,
    addedLines: 3,
    removedLines: 1,
    modifiedLines: 1
  },
  metadata: {
    comparisonTime: new Date(),
    processingTimeMs: 150,
    diffAlgorithm: 'myers',
    version: '1.0.0',
    options: {
      viewMode: 'unified',
      contextLines: 3,
      groupRelatedChanges: true,
      resolveVariables: true,
      showOnlyChanges: false,
      format: 'terminal'
    }
  },
  fileDiffs: [
    {      filePath: './src/styles/components.scss',
      changeType: 'modified',
      chunks: [{
          oldStart: 10,
          oldLength: 3,
          oldLines: 3,
          newStart: 10,
          newLength: 4,
          newLines: 4,
          context: { 
            selector: '.button',
            surroundingLines: 3,
            nestingLevel: 1
          },
          changes: [
            {              type: 'added' as const,
              content: '  color: $primary-blue;',
              lineNumber: 11,
              cssProperties: [
                {
                  property: 'color',                  oldValue: undefined,
                  newValue: '$primary-blue',
                  category: 'color',
                  impact: 'medium' as const
                }
              ]
            },
            {              type: 'removed' as const,
              content: '  color: #333;',
              lineNumber: 12,
              cssProperties: [
                {                  property: 'color',
                  oldValue: '#333',
                  newValue: undefined,
                  category: 'color',
                  impact: 'medium' as const
                }
              ]
            }          ]
        }
      ],
      summary: {
        linesAdded: 1,
        linesRemoved: 1,
        linesModified: 0,
        propertiesChanged: 2,
        changeComplexity: 'medium' as const
      }
    }
  ]
});

describe('Diff Rendering System', () => {
  let mockDiffResult: StyleDiffResult;

  beforeEach(() => {
    mockDiffResult = createMockDiffResult();
  });

  describe('TerminalRenderer', () => {
    let renderer: TerminalRenderer;

    beforeEach(() => {      renderer = new TerminalRenderer({
        useColors: false // Disable colors for testing
      });
    });

    it('should render basic diff output', async () => {
      const result = await renderer.render(mockDiffResult);

      expect(result.format).toBe('terminal');
      expect(result.content).toContain('Style Diff Analysis');
      expect(result.content).toContain('main → feature-branch');
      expect(result.content).toContain('Files changed: 2');
      expect(result.content).toContain('./src/styles/components.scss');
    });

    it('should include line numbers when enabled', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toMatch(/\s+11\s+\+.*color.*primary-blue/);
      expect(result.content).toMatch(/\s+12\s+-.*color.*#333/);
    });

    it('should include property change information', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toContain('MEDIUM COLOR property');
    });

    it('should render metadata when enabled', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toContain('Metadata & Statistics');
      expect(result.content).toContain('Total files: 1');
    });

    it('should handle multiple diff results', async () => {
      const result = await renderer.renderMultiple([mockDiffResult, mockDiffResult]);
      expect(result.format).toBe('terminal');
      expect(result.content).toContain('Style Diff Analysis');
    });
  });

  describe('JsonRenderer', () => {
    let renderer: JsonRenderer;

    beforeEach(() => {
      renderer = new JsonRenderer({
        pretty: true,
        includeContent: true,
        includeContext: true
      });
    });

    it('should render valid JSON output', async () => {
      const result = await renderer.render(mockDiffResult);

      expect(result.format).toBe('json');
      expect(() => JSON.parse(result.content)).not.toThrow();
      
      const parsed = JSON.parse(result.content);
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.comparison.branch1).toBe('main');
      expect(parsed.comparison.branch2).toBe('feature-branch');
    });

    it('should include summary statistics', async () => {
      const result = await renderer.render(mockDiffResult);
      const parsed = JSON.parse(result.content);

      expect(parsed.summary.filesChanged).toBe(2);
      expect(parsed.summary.totalChanges).toBe(5);
      expect(parsed.summary.addedLines).toBe(3);
      expect(parsed.summary.removedLines).toBe(1);
    });

    it('should include file diff data', async () => {
      const result = await renderer.render(mockDiffResult);
      const parsed = JSON.parse(result.content);

      expect(parsed.fileDiffs).toHaveLength(1);
      expect(parsed.fileDiffs[0].filePath).toBe('src/styles/components.scss');
      expect(parsed.fileDiffs[0].chunks).toHaveLength(1);
    });

    it('should validate schema structure', async () => {
      const result = await renderer.render(mockDiffResult);
      const parsed = JSON.parse(result.content);

      expect(renderer.validateSchema(parsed)).toBe(true);
    });

    it('should apply compression when requested', async () => {
      const compressedRenderer = new JsonRenderer({
        compression: 'aggressive',
        pretty: false
      });

      const result = await compressedRenderer.render(mockDiffResult);
      const parsed = JSON.parse(result.content);

      // Compressed format should use shorter keys
      expect(parsed.v).toBeDefined(); // schemaVersion -> v
      expect(parsed.ts).toBeDefined(); // timestamp -> ts
      expect(parsed.cmp).toBeDefined(); // comparison -> cmp
    });
  });

  describe('HtmlRenderer', () => {
    let renderer: HtmlRenderer;

    beforeEach(() => {
      renderer = new HtmlRenderer({
        includeCSS: true,
        standalone: true,
        responsive: true
      });
    });

    it('should render valid HTML output', async () => {
      const result = await renderer.render(mockDiffResult);

      expect(result.format).toBe('html');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('<html lang="en">');
      expect(result.content).toContain('</html>');
    });

    it('should include CSS when enabled', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toContain('<style>');
      expect(result.content).toContain('.diff-container');
    });

    it('should include diff header', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toContain('Style Diff Analysis');
      expect(result.content).toContain('main');
      expect(result.content).toContain('feature-branch');
    });

    it('should include summary section', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toContain('Summary');
      expect(result.content).toContain('Files Changed');
      expect(result.content).toContain('<span class="value">2</span>');
    });

    it('should render file diffs with proper styling', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.content).toContain('src/styles/components.scss');
      expect(result.content).toContain('change-add');
      expect(result.content).toContain('change-remove');
    });

    it('should escape HTML entities', async () => {
      const testDiff = { ...mockDiffResult };
      testDiff.fileDiffs[0].chunks[0].changes[0].content = 'color: <danger>;';

      const result = await renderer.render(testDiff);
      expect(result.content).toContain('&lt;danger&gt;');
      expect(result.content).not.toContain('<danger>');
    });

    it('should support dark mode', async () => {
      const darkRenderer = new HtmlRenderer({
        darkMode: true,
        includeCSS: true
      });

      const result = await darkRenderer.render(mockDiffResult);
      expect(result.content).toContain('class="dark-mode"');
    });
  });

  describe('DiffRenderer (Main Orchestrator)', () => {
    let renderer: DiffRenderer;

    beforeEach(() => {
      renderer = new DiffRenderer({
        format: 'terminal'
      });
    });

    it('should render in default format', async () => {
      const result = await renderer.render(mockDiffResult);
      expect(result.format).toBe('terminal');
    });

    it('should render in specified format', async () => {
      const result = await renderer.render(mockDiffResult, 'json');
      expect(result.format).toBe('json');
      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('should render all formats', async () => {
      const results = await renderer.renderAllFormats(mockDiffResult);

      expect(results.size).toBe(3);
      expect(results.has('terminal')).toBe(true);
      expect(results.has('json')).toBe(true);
      expect(results.has('html')).toBe(true);
    });

    it('should support streaming render', async () => {
      const results: any[] = [];
      
      for await (const result of renderer.streamRender([mockDiffResult, mockDiffResult])) {
        results.push(result);
      }

      expect(results).toHaveLength(2);
      expect(results[0].format).toBe('terminal');
    });

    it('should check format support', () => {
      expect(renderer.isFormatSupported('terminal')).toBe(true);
      expect(renderer.isFormatSupported('json')).toBe(true);
      expect(renderer.isFormatSupported('html')).toBe(true);
      expect(renderer.isFormatSupported('xml' as any)).toBe(false);
    });

    it('should handle format changes', () => {
      expect(renderer.getDefaultFormat()).toBe('terminal');
      
      renderer.setDefaultFormat('json');
      expect(renderer.getDefaultFormat()).toBe('json');
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        renderer.render(mockDiffResult, 'xml' as any)
      ).rejects.toThrow('Unsupported render format: xml');
    });
  });

  describe('Factory Functions', () => {
    it('should create terminal preset renderer', () => {
      const renderer = createDiffRenderer('terminal');
      expect(renderer.getDefaultFormat()).toBe('terminal');
    });

    it('should create json preset renderer', () => {
      const renderer = createDiffRenderer('json');
      expect(renderer.getDefaultFormat()).toBe('json');
    });

    it('should create html preset renderer', () => {
      const renderer = createDiffRenderer('html');
      expect(renderer.getDefaultFormat()).toBe('html');
    });

    it('should use quickRender function', async () => {
      const result = await quickRender(mockDiffResult, 'terminal');
      expect(typeof result).toBe('string');
      expect(result).toContain('Style Diff Analysis');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty diff results', async () => {      const emptyDiff: StyleDiffResult = {
        branch1: 'main',
        branch2: 'feature',
        summary: {
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
        fileDiffs: [],        metadata: {
          comparisonTime: new Date(),
          processingTimeMs: 0,
          diffAlgorithm: 'test',
          version: '1.0.0',
          options: {
            viewMode: 'unified',
            contextLines: 3,
            groupRelatedChanges: true,
            resolveVariables: true,
            showOnlyChanges: false,
            format: 'terminal'
          }
        }
      };

      const renderer = new DiffRenderer();
      const result = await renderer.render(emptyDiff);
      
      expect(result.content).toContain('Style Diff Analysis');
      expect(result.content).toContain('Files changed: 0');
    });

    it('should handle large content gracefully', async () => {
      const largeDiff = { ...mockDiffResult };
      largeDiff.fileDiffs[0].chunks[0].changes[0].content = 'x'.repeat(1000);

      const renderer = new TerminalRenderer({ useColors: true });
      const result = await renderer.render(largeDiff);
      
      expect(result.content).toContain('x'.repeat(117) + '...');
    });

    it('should create performance report', async () => {
      const renderer = new DiffRenderer();
      const report = await renderer.createPerformanceReport(mockDiffResult);

      expect(report.terminal).toBeDefined();
      expect(report.json).toBeDefined();
      expect(report.html).toBeDefined();
      
      expect(report.terminal.success).toBe(true);
      expect(typeof report.terminal.duration).toBe('number');
      expect(typeof report.terminal.outputSize).toBe('number');
    });
  });
});
