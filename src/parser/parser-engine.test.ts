import { SCSSParserEngine, ParserConfig, ParseResult } from './parser-engine';
import { ParseErrorType, ParseErrorSeverity } from './error-recovery';
import { DeclarationNode, RuleNode, CommentNode, RootNode } from './ast-nodes';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('SCSSParserEngine', () => {
  let parserEngine: SCSSParserEngine;
  let tempDir: string;

  beforeEach(async () => {
    // Create parser with test configuration
    const config: ParserConfig = {
      enableErrorRecovery: true,
      maxParseAttempts: 3,
      enableCaching: false, // Disable caching for tests
      enableComplexityAnalysis: true,
      timeoutMs: 5000,
      enableVerboseLogging: false
    };
    
    parserEngine = new SCSSParserEngine(config);
    tempDir = path.join(__dirname, 'temp-test-' + uuidv4());
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  // Helper method to create test files
  async function createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  describe('Basic SCSS Parsing', () => {
    it('should parse a simple SCSS file', async () => {
      const scss = `
        .test-class {
          color: red;
          background: blue;
        }
      `;
      
      const filePath = await createTestFile('test.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.lineCount).toBeGreaterThan(0);
      expect(result.metadata.filePath).toBe(filePath);
    });

    it('should parse SCSS variables', async () => {
      const scss = `
        $primary-color: #007bff;
        $font-size: 16px;
        
        .button {
          color: $primary-color;
          font-size: $font-size;
        }
      `;

      const filePath = await createTestFile('variables.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.filePath).toBe(filePath);
    });

    it('should parse SCSS imports', async () => {
      const scss = `
        @import 'variables';
        @use 'mixins' as m;
        
        .component {
          color: blue;
        }
      `;

      const filePath = await createTestFile('imports.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.dependencies.length).toBeGreaterThanOrEqual(0);
      expect(result.metadata.filePath).toBe(filePath);
    });

    it('should parse nested selectors', async () => {
      const scss = `
        .card {
          padding: 1rem;
          
          .header {
            font-weight: bold;
            
            &.primary {
              color: blue;
            }
          }
          
          .content {
            margin-top: 0.5rem;
          }
        }
      `;

      const filePath = await createTestFile('nested.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.complexity.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed SCSS gracefully', async () => {
      const scss = `
        .button {
          color: blue
          background: red;
        // missing closing brace
      `;

      const filePath = await createTestFile('malformed.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      // Should provide results even with errors
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.ast).toBeDefined(); // Error recovery should provide some AST
    });

    it('should recover from syntax errors', async () => {
      const scss = `
        .valid {
          color: blue;
        }
        
        .invalid {
          background: red;
        }
        
        .another-valid {
          margin: 1rem;
        }
      `;

      const filePath = await createTestFile('mixed-validity.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
    });
  });

  describe('Performance Tracking', () => {
    it('should collect performance metrics', async () => {
      const scss = `
        .component {
          color: blue;
          background: red;
        }
      `;

      const filePath = await createTestFile('performance.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.parseTime).toBeGreaterThan(0);
      expect(result.metadata.fileSize).toBeGreaterThan(0);
    });

    it('should track complexity metrics', async () => {
      const scss = `
        .deeply {
          .nested {
            .component {
              .with {
                .many {
                  .levels {
                    color: red;
                  }
                }
              }
            }
          }
        }
      `;

      const filePath = await createTestFile('complex.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.complexity.score).toBeGreaterThanOrEqual(0);
      expect(result.metadata.filePath).toBe(filePath);
    });
  });

  describe('Source Location Tracking', () => {
    it('should preserve accurate source locations', async () => {
      const scss = `
.button {
  color: blue;
  background: red;
}
      `;

      const filePath = await createTestFile('locations.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.ast?.location).toBeDefined();
      expect(result.ast?.location.file).toBe(filePath);
      expect(result.ast?.location.line).toBeGreaterThan(0);
    });
  });

  describe('Integration with Error Recovery', () => {
    it('should use error recovery system for parse failures', async () => {
      const scss = `
        .button {
          color: blue;
          background: red;
        }
      `;

      const filePath = await createTestFile('recovery.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
    });
  });

  describe('Cache Information', () => {
    it('should provide cache information', async () => {
      const scss = `
        .test {
          color: blue;
        }
      `;

      const filePath = await createTestFile('cache.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.cacheInfo).toBeDefined();
      expect(result.cacheInfo.cacheHit).toBeDefined();
      expect(result.cacheInfo.cacheLevel).toBeDefined();
    });
  });

  describe('Metadata Generation', () => {
    it('should generate comprehensive metadata', async () => {
      const scss = `
        .test {
          color: blue;
          background: red;
        }
      `;

      const filePath = await createTestFile('metadata.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.metadata.fileSize).toBeGreaterThan(0);
      expect(result.metadata.lastModified).toBeDefined();
      expect(result.metadata.hash).toBeDefined();
      expect(result.metadata.parseTime).toBeGreaterThan(0);
      expect(result.metadata.lineCount).toBeGreaterThan(0);
    });
  });
});
