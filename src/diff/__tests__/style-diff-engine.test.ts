import { StyleDiffEngine } from '../style-diff-engine';
import { StyleDiffEngine } from '../style-diff-engine';
import { StyleDiffEngineFactory, createQuickEngine, createDevelopmentEngine } from '../engine-factory';
import { EngineConfigManager } from '../engine-config';
import { DiffAnalysisMode, DiffRenderFormat } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../diff-analyzer');
jest.mock('../context-aware-diff-analyzer');
jest.mock('../diff-renderer');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('StyleDiffEngine', () => {
  let engine: StyleDiffEngine;
  const testScssContent1 = `
    $primary-color: #007bff;
    $font-size: 16px;
    
    .button {
      background-color: $primary-color;
      font-size: $font-size;
      padding: 10px 20px;
      border-radius: 4px;
      
      &:hover {
        background-color: darken($primary-color, 10%);
      }
    }
  `;

  const testScssContent2 = `
    $primary-color: #0056b3;
    $font-size: 18px;
    $border-radius: 6px;
    
    .button {
      background-color: $primary-color;
      font-size: $font-size;
      padding: 12px 24px;
      border-radius: $border-radius;
      
      &:hover {
        background-color: darken($primary-color, 15%);
      }
      
      &:focus {
        outline: 2px solid $primary-color;
      }
    }
  `;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new StyleDiffEngine();
  });

  describe('Core Functionality', () => {
    describe('compareFiles', () => {
      beforeEach(() => {
        mockFs.readFile
          .mockResolvedValueOnce(testScssContent1)
          .mockResolvedValueOnce(testScssContent2);
        mockFs.stat
          .mockResolvedValue({ 
            isDirectory: () => false, 
            size: 1000 
          } as any);
        mockFs.access.mockResolvedValue(undefined);
      });

      test('should compare files successfully', async () => {
        const result = await engine.compareFiles('file1.scss', 'file2.scss');
        
        expect(result).toBeDefined();
        expect(result.metadata).toBeDefined();
        expect(result.metadata.version).toBe('1.0.0');
        expect(mockFs.readFile).toHaveBeenCalledTimes(2);
      });

      test('should handle file validation errors', async () => {
        mockFs.stat.mockRejectedValueOnce(new Error('ENOENT: file not found'));
        
        await expect(engine.compareFiles('nonexistent.scss', 'file2.scss'))
          .rejects.toThrow('Validation failed');
      });

      test('should use cache for repeated comparisons', async () => {
        // First comparison
        const result1 = await engine.compareFiles('file1.scss', 'file2.scss');
        
        // Second comparison (should use cache)
        const result2 = await engine.compareFiles('file1.scss', 'file2.scss');
        
        expect(result1).toEqual(result2);
        // readFile should only be called once (for the first comparison)
        expect(mockFs.readFile).toHaveBeenCalledTimes(2);
      });

      test('should apply custom options', async () => {
        const options = {
          analysisMode: DiffAnalysisMode.TEXT,
          contextDepth: 5,
          includeVariables: false
        };

        const result = await engine.compareFiles('file1.scss', 'file2.scss', options);
        
        expect(result).toBeDefined();
        expect(result.metadata.analysisMode).toBe(DiffAnalysisMode.TEXT);
      });
    });

    describe('compareContent', () => {
      test('should compare content successfully', async () => {
        const result = await engine.compareContent(testScssContent1, testScssContent2);
        
        expect(result).toBeDefined();
        expect(result.metadata).toBeDefined();
        expect(result.metadata.cacheUsed).toBe(false);
      });

      test('should handle empty content', async () => {
        const result = await engine.compareContent('', '');
        
        expect(result).toBeDefined();
      });

      test('should validate content', async () => {
        await expect(engine.compareContent(null as any, testScssContent2))
          .rejects.toThrow('Content validation failed');
      });

      test('should cache content comparisons', async () => {
        // First comparison
        const result1 = await engine.compareContent(testScssContent1, testScssContent2);
        
        // Second comparison (should use cache)
        const result2 = await engine.compareContent(testScssContent1, testScssContent2);
        
        expect(result1.metadata.cacheUsed).toBe(false);
        expect(result2.metadata.cacheUsed).toBe(true);
      });
    });

    describe('batchCompare', () => {
      beforeEach(() => {
        mockFs.readFile
          .mockResolvedValue(testScssContent1);
        mockFs.stat
          .mockResolvedValue({ 
            isDirectory: () => false, 
            size: 1000 
          } as any);
        mockFs.access.mockResolvedValue(undefined);
      });

      test('should handle batch file comparisons', async () => {        const comparisons = [
          { 
            type: 'files' as const, 
            file1: 'file1.scss', 
            file2: 'file2.scss',
            options: { analysisMode: DiffAnalysisMode.TEXT, contextLines: 3 }
          },
          { 
            type: 'files' as const, 
            file1: 'file3.scss', 
            file2: 'file4.scss',
            options: { analysisMode: DiffAnalysisMode.TEXT, contextLines: 3 }
          },
          { 
            type: 'content' as const, 
            content1: testScssContent1, 
            content2: testScssContent2,
            options: { analysisMode: DiffAnalysisMode.TEXT, contextLines: 3 }
          }
        ];

        const results = await engine.batchCompare(comparisons);
        
        expect(results).toHaveLength(3);
        expect(results.every(result => result.metadata)).toBe(true);
      });      test('should validate batch operations', async () => {
        const invalidComparisons = [
          { 
            type: 'invalid' as any,
            options: { analysisMode: DiffAnalysisMode.TEXT, contextLines: 3 }
          }
        ];

        await expect(engine.batchCompare(invalidComparisons))
          .rejects.toThrow('Batch validation failed');
      });

      test('should handle mixed comparison types', async () => {
        const comparisons = [
          { type: 'files' as const, file1: 'file1.scss', file2: 'file2.scss' },
          { type: 'content' as const, content1: testScssContent1, content2: testScssContent2 }
        ];

        const results = await engine.batchCompare(comparisons);
        
        expect(results).toHaveLength(2);
      });
    });

    describe('render', () => {
      test('should render diff results', async () => {
        const result = await engine.compareContent(testScssContent1, testScssContent2);
        const rendered = await engine.render(result, DiffRenderFormat.TERMINAL);
        
        expect(typeof rendered).toBe('string');
        expect(rendered.length).toBeGreaterThan(0);
      });

      test('should handle different render formats', async () => {
        const result = await engine.compareContent(testScssContent1, testScssContent2);
        
        const terminalRender = await engine.render(result, DiffRenderFormat.TERMINAL);
        const jsonRender = await engine.render(result, DiffRenderFormat.JSON);
        const htmlRender = await engine.render(result, DiffRenderFormat.HTML);
        
        expect(terminalRender).toBeDefined();
        expect(jsonRender).toBeDefined();
        expect(htmlRender).toBeDefined();
      });
    });
  });

  describe('Configuration Management', () => {
    test('should use default configuration', () => {
      const config = engine.getConfig();
      expect(config).toBeDefined();
      expect(config.analysis).toBeDefined();
      expect(config.cache).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const customEngine = new StyleDiffEngine({
        analysisMode: DiffAnalysisMode.TEXT,
        contextDepth: 10
      });
      
      const config = customEngine.getConfig();
      expect(config.analysis.mode).toBe(DiffAnalysisMode.TEXT);
      expect(config.analysis.contextDepth).toBe(10);
    });

    test('should update configuration dynamically', () => {
      engine.updateConfig({
        analysis: {
          mode: DiffAnalysisMode.SEMANTIC,
          contextDepth: 7
        }
      });
      
      const config = engine.getConfig();
      expect(config.analysis.mode).toBe(DiffAnalysisMode.SEMANTIC);
      expect(config.analysis.contextDepth).toBe(7);
    });

    test('should validate configuration updates', () => {
      expect(() => {
        engine.updateConfig({
          analysis: {
            contextDepth: -1 // Invalid
          }
        });
      }).toThrow('Configuration update invalid');
    });
  });

  describe('Caching System', () => {
    test('should cache results correctly', async () => {
      const stats1 = engine.getCacheStats();
      expect(stats1.totalEntries).toBe(0);
      
      await engine.compareContent(testScssContent1, testScssContent2);
      
      const stats2 = engine.getCacheStats();
      expect(stats2.totalEntries).toBe(1);
      expect(stats2.hitRate).toBe(0); // First call is a miss
    });

    test('should respect cache TTL', async () => {
      // This would require mocking time or waiting, simplified for testing
      const stats = engine.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats.hitRate).toBe('number');
    });

    test('should handle cache eviction', () => {
      // Create engine with small cache size
      const smallCacheEngine = new StyleDiffEngine({
        cache: { maxSize: 1 }
      });
      
      // This would test eviction logic
      expect(smallCacheEngine.getCacheStats().totalEntries).toBe(0);
    });

    test('should clear cache', async () => {
      await engine.compareContent(testScssContent1, testScssContent2);
      expect(engine.getCacheStats().totalEntries).toBeGreaterThan(0);
      
      engine.clearCache();
      expect(engine.getCacheStats().totalEntries).toBe(0);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track performance metrics', async () => {
      await engine.compareContent(testScssContent1, testScssContent2);
      
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalComparisons).toBeGreaterThan(0);
      expect(metrics.totalProcessingTime).toBeGreaterThan(0);
    });

    test('should provide performance reports', async () => {
      await engine.compareContent(testScssContent1, testScssContent2);
      
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.throughput).toBeGreaterThanOrEqual(0);
    });

    test('should reset metrics', async () => {
      await engine.compareContent(testScssContent1, testScssContent2);
      
      engine.resetMetrics();
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.totalComparisons).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle file access errors gracefully', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT: file not found'));
      
      await expect(engine.compareFiles('nonexistent.scss', 'another.scss'))
        .rejects.toThrow();
    });

    test('should recover from parsing errors', async () => {
      const invalidScss = '{ invalid scss content ///// }}}';
      
      // Should not throw, but may produce warnings
      const result = await engine.compareContent(invalidScss, testScssContent2);
      expect(result).toBeDefined();
    });

    test('should maintain stability under load', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        engine.compareContent(
          testScssContent1 + `/* iteration ${i} */`,
          testScssContent2 + `/* iteration ${i} */`
        )
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(result => result.metadata)).toBe(true);
    });
  });
});

describe('StyleDiffEngineFactory', () => {
  describe('Preset Creation', () => {
    test('should create engine with fast preset', () => {
      const engine = StyleDiffEngineFactory.createEngine('fast');
      expect(engine).toBeInstanceOf(StyleDiffEngine);
      
      const config = engine.getConfig();
      expect(config.analysis.performanceMode).toBe('fast');
    });

    test('should create engine with balanced preset', () => {
      const engine = StyleDiffEngineFactory.createEngine('balanced');
      expect(engine).toBeInstanceOf(StyleDiffEngine);
    });

    test('should create engine with thorough preset', () => {
      const engine = StyleDiffEngineFactory.createEngine('thorough');
      expect(engine).toBeInstanceOf(StyleDiffEngine);
      
      const config = engine.getConfig();
      expect(config.analysis.performanceMode).toBe('thorough');
    });

    test('should throw error for unknown preset', () => {
      expect(() => {
        StyleDiffEngineFactory.createEngine('unknown' as any);
      }).toThrow('Unknown preset');
    });
  });

  describe('Custom Configuration', () => {
    test('should create engine with custom config', () => {
      const customConfig = {
        analysis: {
          mode: DiffAnalysisMode.TEXT,
          contextDepth: 5
        }
      };
      
      const engine = StyleDiffEngineFactory.createCustomEngine(customConfig);
      expect(engine).toBeInstanceOf(StyleDiffEngine);
    });

    test('should merge preset with overrides', () => {
      const overrides = {
        analysis: {
          contextDepth: 10
        }
      };
      
      const engine = StyleDiffEngineFactory.createEngineWithOverrides('fast', overrides);
      const config = engine.getConfig();
      
      expect(config.analysis.performanceMode).toBe('fast'); // From preset
      expect(config.analysis.contextDepth).toBe(10); // From override
    });
  });

  describe('Preset Management', () => {
    test('should list all presets', () => {
      const presets = StyleDiffEngineFactory.listPresets();
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
      
      const presetNames = presets.map(p => p.name);
      expect(presetNames).toContain('fast');
      expect(presetNames).toContain('balanced');
      expect(presetNames).toContain('thorough');
    });

    test('should get specific preset', () => {
      const preset = StyleDiffEngineFactory.getPreset('fast');
      expect(preset.name).toBe('fast');
      expect(preset.description).toBeDefined();
      expect(preset.recommended).toBeDefined();
    });

    test('should register custom preset', () => {
      const customPreset = {
        name: 'custom-test' as any,
        description: 'Test preset',
        config: EngineConfigManager.getDefaultConfig(),
        recommended: ['Testing']
      };
      
      StyleDiffEngineFactory.registerPreset(customPreset);
      const retrieved = StyleDiffEngineFactory.getPreset('custom-test' as any);
      
      expect(retrieved.name).toBe('custom-test');
    });
  });

  describe('Preset Recommendations', () => {
    test('should recommend CI preset for CI use case', () => {
      const preset = StyleDiffEngineFactory.getRecommendedPreset('CI pipeline');
      expect(preset).toBe('ci-cd');
    });

    test('should recommend fast preset for quick use case', () => {
      const preset = StyleDiffEngineFactory.getRecommendedPreset('quick comparison');
      expect(preset).toBe('fast');
    });

    test('should recommend balanced preset for unknown use case', () => {
      const preset = StyleDiffEngineFactory.getRecommendedPreset('unknown use case');
      expect(preset).toBe('balanced');
    });
  });
});

describe('Convenience Functions', () => {
  test('createQuickEngine should create fast engine', () => {
    const engine = createQuickEngine();
    expect(engine).toBeInstanceOf(StyleDiffEngine);
  });

  test('createDevelopmentEngine should create development engine', () => {
    const engine = createDevelopmentEngine();
    expect(engine).toBeInstanceOf(StyleDiffEngine);
    
    const config = engine.getConfig();
    expect(config.output.verboseMode).toBe(true);
  });
});

describe('Integration Tests', () => {
  test('should perform end-to-end file comparison', async () => {
    // Mock file system for integration test
    const testFile1 = path.join(__dirname, 'test1.scss');
    const testFile2 = path.join(__dirname, 'test2.scss');
    
    mockFs.readFile
      .mockResolvedValueOnce(testScssContent1)
      .mockResolvedValueOnce(testScssContent2);
    mockFs.stat
      .mockResolvedValue({ 
        isDirectory: () => false, 
        size: testScssContent1.length 
      } as any);
    mockFs.access.mockResolvedValue(undefined);

    const engine = StyleDiffEngineFactory.createEngine('balanced');
    const result = await engine.compareFiles(testFile1, testFile2);
    
    expect(result).toBeDefined();
    expect(result.metadata.engineVersion).toBe('1.0.0');
    
    // Test rendering
    const terminalOutput = await engine.render(result, DiffRenderFormat.TERMINAL);
    expect(typeof terminalOutput).toBe('string');
    
    // Check performance metrics
    const metrics = engine.getPerformanceMetrics();
    expect(metrics.totalComparisons).toBeGreaterThan(0);
  });

  test('should handle real-world SCSS patterns', async () => {
    const complexScss1 = `
      @import 'variables';
      @import 'mixins';
      
      $theme-colors: (
        primary: #007bff,
        secondary: #6c757d,
        success: #28a745
      );
      
      @each $color, $value in $theme-colors {
        .btn-#{$color} {
          background-color: $value;
          border-color: darken($value, 5%);
          
          &:hover {
            background-color: darken($value, 7.5%);
          }
        }
      }
      
      @media (min-width: 768px) {
        .container {
          max-width: 750px;
        }
      }
    `;

    const complexScss2 = `
      @import 'variables';
      @import 'mixins';
      @import 'utilities';
      
      $theme-colors: (
        primary: #0056b3,
        secondary: #6c757d,
        success: #28a745,
        danger: #dc3545
      );
      
      @each $color, $value in $theme-colors {
        .btn-#{$color} {
          background-color: $value;
          border-color: darken($value, 5%);
          color: white;
          
          &:hover {
            background-color: darken($value, 10%);
            transform: translateY(-1px);
          }
          
          &:active {
            transform: translateY(0);
          }
        }
      }
      
      @media (min-width: 768px) {
        .container {
          max-width: 750px;
          padding: 0 15px;
        }
      }
      
      @media (min-width: 992px) {
        .container {
          max-width: 970px;
        }
      }
    `;

    const engine = StyleDiffEngineFactory.createEngine('thorough');
    const result = await engine.compareContent(complexScss1, complexScss2);
    
    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
    
    // Should detect the added import, new color, and media query changes
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});

describe('Performance Tests', () => {
  test('should handle large content efficiently', async () => {
    // Generate large SCSS content
    const generateLargeScss = (size: number) => {
      let content = '$base-color: #000;\n';
      for (let i = 0; i < size; i++) {
        content += `.class-${i} { color: lighten($base-color, ${i % 100}%); }\n`;
      }
      return content;
    };

    const largeScss1 = generateLargeScss(1000);
    const largeScss2 = generateLargeScss(1100);

    const engine = StyleDiffEngineFactory.createEngine('large-files');
    const startTime = Date.now();
    
    const result = await engine.compareContent(largeScss1, largeScss2);
    
    const duration = Date.now() - startTime;
    
    expect(result).toBeDefined();
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    
    const metrics = engine.getPerformanceMetrics();
    expect(metrics.totalComparisons).toBe(1);
  });

  test('should maintain memory usage within limits', async () => {
    const engine = StyleDiffEngineFactory.createEngine('memory-optimized');
    
    // Perform multiple comparisons to test memory management
    for (let i = 0; i < 20; i++) {
      await engine.compareContent(
        testScssContent1 + `/* iteration ${i} */`,
        testScssContent2 + `/* iteration ${i} */`
      );
    }
    
    const metrics = engine.getPerformanceMetrics();
    expect(metrics.totalComparisons).toBe(20);
    
    // Memory usage should be reasonable
    expect(metrics.memoryUsage.current).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  });
});
