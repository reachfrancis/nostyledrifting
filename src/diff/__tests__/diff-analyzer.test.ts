import { DiffAnalyzer } from '../diff-analyzer';
import { DiffOptions, DEFAULT_DIFF_OPTIONS } from '../types';
import { DiffAnalysisError } from '../errors';

describe('DiffAnalyzer', () => {
  let analyzer: DiffAnalyzer;

  beforeEach(() => {
    analyzer = new DiffAnalyzer();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const defaultAnalyzer = new DiffAnalyzer();
      expect(defaultAnalyzer).toBeDefined();
    });

    it('should merge custom options with defaults', () => {
      const customOptions: Partial<DiffOptions> = {
        contextLines: 5,
        viewMode: 'split'
      };
      const customAnalyzer = new DiffAnalyzer(customOptions);
      expect(customAnalyzer).toBeDefined();
    });
  });
  describe('analyzeContent', () => {
    it('should analyze simple content differences', async () => {
      const content1 = 'line1\nline2\nline3';
      const content2 = 'line1\nmodified line2\nline3';

      const result = await analyzer.analyzeContent(content1, content2, 'test.scss');

      expect(result.filePath).toBe('test.scss');
      expect(result.changeType).toBe('modified');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.linesAdded).toBeGreaterThan(0);
      expect(result.summary.linesRemoved).toBeGreaterThan(0);
    });

    it('should handle content with only additions', async () => {
      const content1 = 'line1\nline2';
      const content2 = 'line1\nline2\nline3\nline4';

      const result = await analyzer.analyzeContent(content1, content2, 'test.scss');

      expect(result.changeType).toBe('modified'); // Will be modified due to how diff works
      expect(result.summary.linesAdded).toBeGreaterThan(0);
    });

    it('should handle content with only removals', async () => {
      const content1 = 'line1\nline2\nline3\nline4';
      const content2 = 'line1\nline2';

      const result = await analyzer.analyzeContent(content1, content2, 'test.scss');

      expect(result.changeType).toBe('modified'); // Will be modified due to how diff works
      expect(result.summary.linesRemoved).toBeGreaterThan(0);
    });

    it('should handle identical content', async () => {
      const content = 'line1\nline2\nline3';

      const result = await analyzer.analyzeContent(content, content, 'test.scss');

      expect(result.chunks).toHaveLength(0);
      expect(result.summary.linesAdded).toBe(0);
      expect(result.summary.linesRemoved).toBe(0);
    });
  });describe('analyzeFile', () => {
    it('should delegate to analyzeContent with merged options', async () => {
      const content1 = '.test { color: red; }';
      const content2 = '.test { color: blue; }';
      const customOptions: DiffOptions = {
        ...DEFAULT_DIFF_OPTIONS,
        contextLines: 5
      };

      const result = await analyzer.analyzeFile(content1, content2, 'test.scss', customOptions);

      expect(result.filePath).toBe('test.scss');
      expect(result.changeType).toBe('modified');
    });
  });
  describe('createDiffChunks', () => {
    it('should create chunks from line arrays', () => {
      const oldLines = ['line1', 'line2', 'old line3'];
      const newLines = ['line1', 'line2', 'new line3'];

      const chunks = analyzer.createDiffChunks(oldLines, newLines, 2);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].changes).toHaveLength(1);
      expect(chunks[0].context.surroundingLines).toBe(2);
    });

    it('should handle additions and removals', () => {
      const oldLines = ['line1', 'line2'];
      const newLines = ['line1', 'line2', 'line3'];

      const chunks = analyzer.createDiffChunks(oldLines, newLines, 1);

      expect(chunks.length).toBeGreaterThan(0);
      // Check that we have some kind of change
      const hasAddedChange = chunks.some(chunk => 
        chunk.changes.some(change => change.type === 'added')
      );
      expect(hasAddedChange).toBe(true);
    });

    it('should throw DiffAnalysisError on processing failure', () => {
      // Simulate an error by passing invalid input
      expect(() => {
        analyzer.createDiffChunks(null as any, [], 1);
      }).toThrow(DiffAnalysisError);
    });
  });

  describe('analyzeCssProperties', () => {
    it('should return the change as-is for now', () => {
      const change = {
        type: 'added' as const,
        lineNumber: 1,
        content: 'color: red;'
      };

      const result = analyzer.analyzeCssProperties(change);

      expect(result).toEqual(change);
    });

    it('should handle analysis errors gracefully', () => {
      const change = {
        type: 'added' as const,
        lineNumber: 1,
        content: 'color: red;'
      };

      expect(() => {
        analyzer.analyzeCssProperties(change);
      }).not.toThrow();
    });
  });

  describe('content normalization', () => {
    it('should normalize line endings and tabs', async () => {
      const content1 = 'line1\r\nline2\tindented';
      const content2 = 'line1\nline2  indented';

      const result = await analyzer.analyzeContent(content1, content2, 'test.scss');

      // Should have minimal differences due to normalization
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe('change complexity determination', () => {
    it('should determine low complexity for small changes', async () => {
      const content1 = 'line1\nline2';
      const content2 = 'line1\nmodified line2';

      const result = await analyzer.analyzeContent(content1, content2, 'test.scss');

      expect(result.summary.changeComplexity).toBe('low');
    });

    it('should determine high complexity for large changes', async () => {
      const content1 = Array(60).fill('line').join('\n');
      const content2 = Array(60).fill('modified line').join('\n');

      const result = await analyzer.analyzeContent(content1, content2, 'test.scss');

      expect(result.summary.changeComplexity).toBe('high');
    });
  });

  describe('performance optimization', () => {
    it('should handle large content efficiently', async () => {
      const largeContent1 = Array(1000).fill('line content').join('\n');
      const largeContent2 = Array(1000).fill('modified line content').join('\n');

      const startTime = Date.now();
      const result = await analyzer.analyzeContent(largeContent1, largeContent2, 'large.scss');
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('error handling', () => {
    it('should handle empty content gracefully', async () => {
      const result = await analyzer.analyzeContent('', '', 'empty.scss');

      expect(result.chunks).toHaveLength(0);
      expect(result.summary.linesAdded).toBe(0);
      expect(result.summary.linesRemoved).toBe(0);
    });

    it('should handle malformed content gracefully', async () => {
      const malformedContent = '\x00\x01\x02invalid content';
      
      const result = await analyzer.analyzeContent(malformedContent, 'valid content', 'test.scss');

      expect(result).toBeDefined();
      expect(result.changeType).toBe('modified');
    });
  });
});
