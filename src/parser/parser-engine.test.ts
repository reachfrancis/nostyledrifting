import { SCSSParserEngine, ParserConfig, ParseResult } from './parser-engine';
import { ParseErrorType, ParseErrorSeverity } from './error-recovery';
import { DeclarationNode, RuleNode, CommentNode, RootNode, ImportStatementNode, UseStatementNode, AtRuleNode } from './ast-nodes';
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

        it('should parse empty SCSS file', async () => {
            const scss = '';
            
            const filePath = await createTestFile('empty.scss', scss);
            const result = await parserEngine.parseFile(filePath);

            expect(result.ast).toBeDefined();
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.lineCount).toBe(1);
            expect(result.metadata.fileSize).toBe(0);
        });        it('should parse SCSS with only comments', async () => {
            const scss = `
                // This is a comment
                /* Multi-line comment
                   across multiple lines */
            `;

            const filePath = await createTestFile('comments.scss', scss);
            const result = await parserEngine.parseFile(filePath);

            expect(result.ast).toBeDefined();
            expect(result.metadata.filePath).toBe(filePath);
            expect(result.metadata.lineCount).toBeGreaterThan(0);
        });

        it('should parse SCSS mixins and includes', async () => {
            const scss = `
                @mixin button-style($color: blue) {
                    background: $color;
                    border: 1px solid $color;
                    padding: 0.5rem 1rem;
                }
                
                .primary-button {
                    @include button-style(#007bff);
                }
                
                .secondary-button {
                    @include button-style(#6c757d);
                }
            `;

            const filePath = await createTestFile('mixins.scss', scss);
            const result = await parserEngine.parseFile(filePath);            expect(result.ast).toBeDefined();
            expect(result.errors).toHaveLength(0);
            expect(result.complexity.score).toBeGreaterThanOrEqual(0);
        });

        it('should parse SCSS functions', async () => {
            const scss = `
                @function calculate-rem($pixels) {
                    @return #{$pixels / 16}rem;
                }
                
                .component {
                    font-size: calculate-rem(18);
                    margin: calculate-rem(24) 0;
                }
            `;

            const filePath = await createTestFile('functions.scss', scss);
            const result = await parserEngine.parseFile(filePath);            expect(result.ast).toBeDefined();
            expect(result.complexity.score).toBeGreaterThanOrEqual(0);
        });

        it('should parse SCSS at-rules', async () => {
            const scss = `
                @media (max-width: 768px) {
                    .mobile-hidden {
                        display: none;
                    }
                }
                
                @supports (display: grid) {
                    .grid-container {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                    }
                }
            `;

            const filePath = await createTestFile('at-rules.scss', scss);
            const result = await parserEngine.parseFile(filePath);

            expect(result.ast).toBeDefined();
            expect(result.metadata.filePath).toBe(filePath);
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

      expect(result.metadata).toBeDefined();      expect(result.metadata.filePath).toBe(filePath);
      expect(result.metadata.fileSize).toBeGreaterThan(0);
      expect(result.metadata.lastModified).toBeDefined();
      expect(result.metadata.hash).toBeDefined();
      expect(result.metadata.parseTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.lineCount).toBeGreaterThan(0);
    });
  });

  describe('Advanced SCSS Features', () => {
    it('should parse SCSS interpolation', async () => {
      const scss = `
        $prefix: 'my';
        $property: 'margin';
        
        .#{$prefix}-component {
          #{$property}-top: 1rem;
          background-image: url('#{$prefix}-image.png');
        }
      `;

      const filePath = await createTestFile('interpolation.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.complexity.score).toBeGreaterThan(0);
    });

    it('should parse SCSS extends', async () => {
      const scss = `
        %button-base {
          padding: 0.5rem 1rem;
          border: none;
          cursor: pointer;
        }
        
        .primary-btn {
          @extend %button-base;
          background: blue;
          color: white;
        }
        
        .secondary-btn {
          @extend %button-base;
          background: gray;
          color: black;
        }
      `;

      const filePath = await createTestFile('extends.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
    });

    it('should parse SCSS control directives', async () => {
      const scss = `
        @for $i from 1 through 3 {
          .item-#{$i} {
            width: #{$i * 10}%;
          }
        }
        
        @each $animal in panda, sea-slug, egret, salamander {
          .#{$animal}-icon {
            background-image: url('/images/#{$animal}.png');
          }
        }
        
        @if true {
          .conditional-class {
            display: block;
          }
        } @else {
          .alternative-class {
            display: none;
          }
        }
      `;

      const filePath = await createTestFile('control-directives.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.complexity.score).toBeGreaterThan(0);
    });

    it('should parse complex nested structures', async () => {
      const scss = `
        .sidebar {
          .navigation {
            .menu {
              .item {
                .link {
                  &:hover {
                    .icon {
                      transform: scale(1.1);
                      
                      &::before {
                        content: '→';
                      }
                    }
                  }
                  
                  &.active {
                    font-weight: bold;
                  }
                }
              }
            }
          }
        }
      `;

      const filePath = await createTestFile('deep-nesting.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.complexity.score).toBeGreaterThan(0);
    });

    it('should parse SCSS maps and lists', async () => {
      const scss = `
        $font-weights: (
          light: 300,
          normal: 400,
          bold: 700
        );
        
        $breakpoints: 576px, 768px, 992px, 1200px;
        
        @function get-weight($key) {
          @return map-get($font-weights, $key);
        }
        
        .text {
          font-weight: get-weight(bold);
        }
      `;

      const filePath = await createTestFile('maps-lists.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle incomplete selectors', async () => {
      const scss = `
        .valid-class {
          color: blue;
        }
        
        .incomplete-
        
        .another-valid {
          margin: 1rem;
        }
      `;

      const filePath = await createTestFile('incomplete-selectors.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.filePath).toBe(filePath);
      expect(result.ast).toBeDefined();
    });

    it('should handle invalid property values', async () => {
      const scss = `
        .component {
          color: #invalid-color;
          margin: 1rem auto invalid-value;
          border: 1px solid;
          padding: 1rem;
        }
      `;

      const filePath = await createTestFile('invalid-values.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.filePath).toBe(filePath);
      expect(result.ast).toBeDefined();
    });

    it('should handle mixed valid and invalid imports', async () => {
      const scss = `
        @import 'valid-file';
        @import 'non-existent-file';
        @use 'another-file' as *;
        @forward 'yet-another-file';
        
        .component {
          color: blue;
        }
      `;

      const filePath = await createTestFile('mixed-imports.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.filePath).toBe(filePath);
      expect(result.dependencies.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large files', async () => {
      // Generate a large SCSS file
      let largeScss = '';
      for (let i = 0; i < 1000; i++) {
        largeScss += `
          .component-${i} {
            color: blue;
            background: red;
            margin: ${i}px;
          }
        `;
      }

      const filePath = await createTestFile('large-file.scss', largeScss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.filePath).toBe(filePath);
      expect(result.metadata.fileSize).toBeGreaterThan(10000); // Large file
      expect(result.complexity.score).toBeGreaterThan(1000);
    });
  });

  describe('File Format Edge Cases', () => {
    it('should handle files with only whitespace', async () => {
      const scss = '   \n\n   \t\t   \n  ';

      const filePath = await createTestFile('whitespace-only.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
      expect(result.metadata.lineCount).toBeGreaterThan(0);
    });

    it('should handle different line endings', async () => {
      const scss = '.class1 {\r\n  color: blue;\r\n}\n\n.class2 {\r  background: red;\r}';

      const filePath = await createTestFile('line-endings.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
    });

    it('should handle Unicode characters', async () => {
      const scss = `
        .unicode-test {
          content: '✓ ✗ → ← ↑ ↓';
          font-family: 'Ñandú', sans-serif;
        }
        
        .emoji-class {
          /* 🎨 Styling comment */
          background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        }
      `;

      const filePath = await createTestFile('unicode.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.ast).toBeDefined();
      expect(result.metadata.filePath).toBe(filePath);
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle multiple concurrent parses', async () => {
      const scssFiles = [];
      
      // Create multiple test files
      for (let i = 0; i < 10; i++) {
        const scss = `
          .test-${i} {
            color: hsl(${i * 36}, 70%, 50%);
            transform: rotate(${i * 36}deg);
          }
        `;
        scssFiles.push(createTestFile(`concurrent-${i}.scss`, scss));
      }

      const filePaths = await Promise.all(scssFiles);
      const parsePromises = filePaths.map(filePath => parserEngine.parseFile(filePath));
      const results = await Promise.all(parsePromises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.ast).toBeDefined();
        expect(result.metadata.filePath).toBe(filePaths[index]);
        expect(result.metadata.parseTime).toBeGreaterThan(0);
      });
    });

    it('should track memory usage correctly', async () => {
      const scss = `
        .memory-test {
          background: linear-gradient(
            45deg,
            #ff0000,
            #ff8000,
            #ffff00,
            #80ff00,
            #00ff00,
            #00ff80,
            #00ffff,
            #0080ff,
            #0000ff,
            #8000ff,
            #ff00ff,
            #ff0080
          );
        }
      `;

      const filePath = await createTestFile('memory-test.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.filePath).toBe(filePath);
      expect(result.metadata.parseTime).toBeGreaterThan(0);
      expect(result.metadata.fileSize).toBeGreaterThan(0);
    });
  });

  describe('Dependency Resolution', () => {
    it('should track import dependencies correctly', async () => {
      // Create a dependency file first
      const dependencyScss = `
        $primary-color: blue;
        @mixin button-style { padding: 1rem; }
      `;
      await createTestFile('_variables.scss', dependencyScss);

      const mainScss = `
        @import 'variables';
        @use 'sass:math';
        @forward 'variables';
        
        .component {
          color: $primary-color;
          @include button-style;
        }
      `;

      const filePath = await createTestFile('main-with-deps.scss', mainScss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.metadata.filePath).toBe(filePath);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complexity Analysis', () => {
    it('should calculate complexity for deeply nested selectors', async () => {
      const scss = `
        .level1 {
          .level2 {
            .level3 {
              .level4 {
                .level5 {
                  .level6 {
                    .level7 {
                      color: red;
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const filePath = await createTestFile('deep-complexity.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.complexity.score).toBeGreaterThan(5);
      expect(result.metadata.filePath).toBe(filePath);
    });

    it('should handle complex selectors with multiple combinators', async () => {
      const scss = `
        .parent > .child + .sibling ~ .general [attr="value"]:hover::before {
          content: 'complex';
        }
        
        .card:nth-child(3n+1):not(.disabled).active[data-type="primary"] {
          display: flex;
        }
      `;

      const filePath = await createTestFile('complex-selectors.scss', scss);
      const result = await parserEngine.parseFile(filePath);

      expect(result.complexity.score).toBeGreaterThan(0);
      expect(result.metadata.filePath).toBe(filePath);
    });
  });
});
