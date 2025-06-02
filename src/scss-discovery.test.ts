import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ScssDiscoveryEngine, ScssDiscoveryService, ScssFileType } from './scss-discovery';
import * as os from 'os';

describe('ScssDiscoveryEngine', () => {
  let tempDir: string;
  let engine: ScssDiscoveryEngine;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scss-discovery-test-'));
    engine = new ScssDiscoveryEngine();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('File Classification', () => {
    it('should classify component SCSS files correctly', async () => {
      // Create test files
      const componentDir = path.join(tempDir, 'src/app/component');
      await fs.ensureDir(componentDir);
      
      const scssFile = path.join(componentDir, 'test.component.scss');
      const tsFile = path.join(componentDir, 'test.component.ts');
      
      await fs.writeFile(scssFile, '.test { color: blue; }');
      await fs.writeFile(tsFile, 'export class TestComponent {}');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.files).toHaveLength(1);
      expect(discovery.files[0].type).toBe(ScssFileType.COMPONENT);
      expect(discovery.files[0].componentPath).toBe(tsFile);
    });

    it('should classify global styles correctly', async () => {
      const stylesFile = path.join(tempDir, 'src/styles.scss');
      await fs.ensureDir(path.dirname(stylesFile));
      await fs.writeFile(stylesFile, 'body { margin: 0; }');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.files).toHaveLength(1);
      expect(discovery.files[0].type).toBe(ScssFileType.GLOBAL);
    });

    it('should classify partial files correctly', async () => {
      const partialFile = path.join(tempDir, 'src/_variables.scss');
      await fs.ensureDir(path.dirname(partialFile));
      await fs.writeFile(partialFile, '$primary-color: blue;');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.files).toHaveLength(1);
      expect(discovery.files[0].type).toBe(ScssFileType.VARIABLES);
    });

    it('should classify theme files correctly', async () => {
      const themeFile = path.join(tempDir, 'src/themes/dark-theme.scss');
      await fs.ensureDir(path.dirname(themeFile));
      await fs.writeFile(themeFile, '.dark-theme { background: black; }');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.files).toHaveLength(1);
      expect(discovery.files[0].type).toBe(ScssFileType.THEME);
    });

    it('should classify mixin files correctly', async () => {
      const mixinFile = path.join(tempDir, 'src/_mixins.scss');
      await fs.ensureDir(path.dirname(mixinFile));
      await fs.writeFile(mixinFile, '@mixin button { padding: 10px; }');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.files).toHaveLength(1);
      expect(discovery.files[0].type).toBe(ScssFileType.MIXIN);
    });
  });

  describe('Import Resolution', () => {
    it('should extract imports correctly', async () => {
      const mainFile = path.join(tempDir, 'src/main.scss');
      const partialFile = path.join(tempDir, 'src/_variables.scss');
      
      await fs.ensureDir(path.dirname(mainFile));
      await fs.writeFile(mainFile, `
        @import './variables';
        @use '_mixins.scss';
        
        .main { color: $primary-color; }
      `);
      await fs.writeFile(partialFile, '$primary-color: blue;');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      const mainFileMetadata = discovery.files.find(f => f.relativePath.includes('main.scss'));
      expect(mainFileMetadata?.imports).toHaveLength(2);
      expect(mainFileMetadata?.imports[0]).toContain('variables.scss');
    });

    it('should build reverse dependencies correctly', async () => {
      const mainFile = path.join(tempDir, 'src/main.scss');
      const partialFile = path.join(tempDir, 'src/_variables.scss');
      
      await fs.ensureDir(path.dirname(mainFile));
      await fs.writeFile(mainFile, `@import './variables';`);
      await fs.writeFile(partialFile, '$primary-color: blue;');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      const partialMetadata = discovery.files.find(f => f.relativePath.includes('_variables.scss'));
      expect(partialMetadata?.importedBy).toHaveLength(1);
      expect(partialMetadata?.importedBy[0]).toContain('main.scss');
    });
  });

  describe('Component Mapping', () => {
    it('should create component mappings correctly', async () => {
      const componentDir = path.join(tempDir, 'src/app/test');
      await fs.ensureDir(componentDir);
      
      const scssFile = path.join(componentDir, 'test.component.scss');
      const tsFile = path.join(componentDir, 'test.component.ts');
      const globalFile = path.join(tempDir, 'src/styles.scss');
      
      await fs.writeFile(scssFile, '.test { color: blue; }');
      await fs.writeFile(tsFile, `
        @Component({
          selector: 'app-test',
          templateUrl: './test.component.html',
          styleUrls: ['./test.component.scss']
        })
        export class TestComponent {}
      `);
      await fs.writeFile(globalFile, 'body { margin: 0; }');

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.mappings).toHaveLength(1);
      
      const mapping = discovery.mappings[0];
      expect(mapping.componentName).toBe('test');
      expect(mapping.componentPath).toBe(tsFile);
      expect(mapping.styleFiles.primary).toBe(scssFile);
      expect(mapping.styleFiles.global).toHaveLength(1);
      expect(mapping.styleFiles.global[0]).toBe(globalFile);
    });

    it('should detect standalone components', async () => {
      const componentDir = path.join(tempDir, 'src/app/standalone');
      await fs.ensureDir(componentDir);
      
      const scssFile = path.join(componentDir, 'standalone.component.scss');
      const tsFile = path.join(componentDir, 'standalone.component.ts');
      
      await fs.writeFile(scssFile, '.standalone { color: red; }');
      await fs.writeFile(tsFile, `
        @Component({
          selector: 'app-standalone',
          standalone: true,
          templateUrl: './standalone.component.html',
          styleUrls: ['./standalone.component.scss']
        })
        export class StandaloneComponent {}
      `);

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.mappings).toHaveLength(1);
      expect(discovery.mappings[0].isStandalone).toBe(true);
    });
  });
  describe('Error Handling', () => {
    it('should handle file access errors gracefully', async () => {
      const inaccessibleDir = path.join(tempDir, 'inaccessible');
      await fs.ensureDir(inaccessibleDir);
      
      const scssFile = path.join(inaccessibleDir, 'test.scss');
      await fs.writeFile(scssFile, '.test { color: blue; }');      // Use jest.spyOn to mock fs.pathExists
      const pathExistsSpy = jest.spyOn(fs, 'pathExists');
      pathExistsSpy.mockImplementation(async (filePath) => {
        if (typeof filePath === 'string' && filePath.includes('test.scss')) {
          return false;
        }
        return true; // Return true for all other files
      });

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      // Should complete without throwing, but file should not be in results
      expect(discovery.files.length).toBe(0);
      
      // Restore original fs.pathExists
      pathExistsSpy.mockRestore();
    });

    it('should handle invalid import paths', async () => {
      const mainFile = path.join(tempDir, 'src/main.scss');
      
      await fs.ensureDir(path.dirname(mainFile));
      await fs.writeFile(mainFile, `
        @import './non-existent-file';
        @import '../invalid/path';
        
        .main { color: blue; }
      `);

      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      
      expect(discovery.files).toHaveLength(1);
      const mainFileMetadata = discovery.files[0];
      expect(mainFileMetadata.imports).toHaveLength(2); // Imports are recorded even if files don't exist
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of files efficiently', async () => {
      // Create many SCSS files
      const numFiles = 50;
      const componentDir = path.join(tempDir, 'src/app/components');
      await fs.ensureDir(componentDir);
      
      const promises = [];
      for (let i = 0; i < numFiles; i++) {
        const scssFile = path.join(componentDir, `component-${i}.component.scss`);
        const tsFile = path.join(componentDir, `component-${i}.component.ts`);
        
        promises.push(
          fs.writeFile(scssFile, `.component-${i} { color: blue; }`),
          fs.writeFile(tsFile, `export class Component${i} {}`)
        );
      }
      
      await Promise.all(promises);
      
      const startTime = Date.now();
      const discovery = await engine.discoverScssFiles(tempDir, 'test');
      const duration = Date.now() - startTime;
      
      expect(discovery.files).toHaveLength(numFiles);
      expect(discovery.mappings).toHaveLength(numFiles);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});

describe('ScssDiscoveryService', () => {
  let tempDir1: string;
  let tempDir2: string;
  let service: ScssDiscoveryService;

  beforeEach(async () => {
    tempDir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'scss-service-test1-'));
    tempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'scss-service-test2-'));
    service = new ScssDiscoveryService();
  });

  afterEach(async () => {
    await Promise.all([
      fs.remove(tempDir1),
      fs.remove(tempDir2)
    ]);
  });

  describe('Branch Comparison', () => {
    it('should discover SCSS files in both branches', async () => {
      // Create different files in each branch
      const branch1Dir = path.join(tempDir1, 'src/app');
      const branch2Dir = path.join(tempDir2, 'src/app');
      
      await fs.ensureDir(branch1Dir);
      await fs.ensureDir(branch2Dir);
      
      // Branch 1 files
      await fs.writeFile(path.join(branch1Dir, 'app.component.scss'), '.app { color: blue; }');
      await fs.writeFile(path.join(branch1Dir, 'app.component.ts'), 'export class AppComponent {}');
      
      // Branch 2 files (different)
      await fs.writeFile(path.join(branch2Dir, 'app.component.scss'), '.app { color: red; }');
      await fs.writeFile(path.join(branch2Dir, 'app.component.ts'), 'export class AppComponent {}');
      await fs.writeFile(path.join(branch2Dir, 'new.component.scss'), '.new { color: green; }');
      await fs.writeFile(path.join(branch2Dir, 'new.component.ts'), 'export class NewComponent {}');

      const result = await service.discoverForBranches(
        tempDir1, 'branch1',
        tempDir2, 'branch2'
      );

      expect(result.branch1.files).toHaveLength(1);
      expect(result.branch2.files).toHaveLength(2);
      expect(result.summary.totalFilesDiscovered).toBe(3);
      expect(result.summary.componentMappings).toBe(3);
    });

    it('should build project style inventories', async () => {
      const componentDir = path.join(tempDir1, 'src/app');
      await fs.ensureDir(componentDir);
      
      await fs.writeFile(path.join(tempDir1, 'src/styles.scss'), 'body { margin: 0; }');
      await fs.writeFile(path.join(componentDir, 'app.component.scss'), '.app { color: blue; }');
      await fs.writeFile(path.join(componentDir, 'app.component.ts'), 'export class AppComponent {}');

      await service.discoverForBranches(
        tempDir1, 'test-branch',
        tempDir2, 'empty-branch'
      );

      const inventory = service.getInventory('test-branch');
      
      expect(inventory).toBeDefined();
      expect(inventory!.totalFiles).toBe(2);
      expect(inventory!.globalStyles).toHaveLength(1);
      expect(inventory!.componentMappings.size).toBe(1);
    });
  });

  describe('Summary Generation', () => {
    it('should generate accurate summary statistics', async () => {
      // Create mixed file types
      await fs.ensureDir(path.join(tempDir1, 'src'));
      await fs.writeFile(path.join(tempDir1, 'src/styles.scss'), 'body { margin: 0; }'); // Global
      await fs.writeFile(path.join(tempDir1, 'src/_variables.scss'), '$color: blue;'); // Variables
      await fs.writeFile(path.join(tempDir1, 'src/theme.scss'), '.theme { color: dark; }'); // Theme
      await fs.writeFile(path.join(tempDir1, 'src/app.component.scss'), '.app { color: blue; }'); // Component
      await fs.writeFile(path.join(tempDir1, 'src/app.component.ts'), 'export class AppComponent {}');

      const result = await service.discoverForBranches(
        tempDir1, 'main',
        tempDir2, 'empty'
      );      expect(result.summary.totalFilesDiscovered).toBe(4);
      expect(result.summary.globalStyles).toBe(1);
      expect(result.summary.themes).toBe(1);
      expect(result.summary.partials).toBe(1); // _variables.scss counts as partial since it starts with _
      expect(result.summary.componentMappings).toBe(1);
    });
  });
});

describe('Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scss-integration-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should handle complex Angular project structure', async () => {
    // Create a realistic Angular project structure
    const srcDir = path.join(tempDir, 'src');
    const appDir = path.join(srcDir, 'app');
    const featuresDir = path.join(appDir, 'features');
    const sharedDir = path.join(appDir, 'shared');
    
    await fs.ensureDir(featuresDir);
    await fs.ensureDir(sharedDir);

    // Global styles
    await fs.writeFile(path.join(srcDir, 'styles.scss'), `
      @import 'variables';
      @import 'mixins';
      
      body { 
        font-family: Arial, sans-serif;
        margin: 0;
      }
    `);

    // Partials
    await fs.writeFile(path.join(srcDir, '_variables.scss'), `
      $primary-color: #007bff;
      $secondary-color: #6c757d;
      $font-size-base: 1rem;
    `);
    
    await fs.writeFile(path.join(srcDir, '_mixins.scss'), `
      @mixin button-style {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.25rem;
      }
    `);

    // App component
    await fs.writeFile(path.join(appDir, 'app.component.scss'), `
      @import '../variables';
      
      .app-container {
        color: $primary-color;
      }
    `);
    await fs.writeFile(path.join(appDir, 'app.component.ts'), `
      @Component({
        selector: 'app-root',
        templateUrl: './app.component.html',
        styleUrls: ['./app.component.scss']
      })
      export class AppComponent {}
    `);

    // Feature components
    await fs.writeFile(path.join(featuresDir, 'feature.component.scss'), `
      @import '../../variables';
      @import '../../mixins';
      
      .feature {
        @include button-style;
        background-color: $secondary-color;
      }
    `);
    await fs.writeFile(path.join(featuresDir, 'feature.component.ts'), `
      @Component({
        selector: 'app-feature',
        standalone: true,
        templateUrl: './feature.component.html',
        styleUrls: ['./feature.component.scss']
      })
      export class FeatureComponent {}
    `);

    // Shared component
    await fs.writeFile(path.join(sharedDir, 'shared.component.scss'), `
      .shared {
        font-size: 0.875rem;
      }
    `);
    await fs.writeFile(path.join(sharedDir, 'shared.component.ts'), `
      export class SharedComponent {}
    `);

    const engine = new ScssDiscoveryEngine();
    const discovery = await engine.discoverScssFiles(tempDir, 'main');

    // Verify discovery results
    expect(discovery.files).toHaveLength(6);
    
    // Check file types
    const filesByType = discovery.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(filesByType[ScssFileType.GLOBAL]).toBe(1);
    expect(filesByType[ScssFileType.VARIABLES]).toBe(1);
    expect(filesByType[ScssFileType.MIXIN]).toBe(1);
    expect(filesByType[ScssFileType.COMPONENT]).toBe(3);

    // Check component mappings
    expect(discovery.mappings).toHaveLength(3);
    
    const standaloneComponent = discovery.mappings.find(m => m.componentName === 'feature');
    expect(standaloneComponent?.isStandalone).toBe(true);

    // Verify import relationships
    const appComponent = discovery.files.find(f => f.relativePath.includes('app.component.scss'));
    expect(appComponent?.imports).toHaveLength(1);
    expect(appComponent?.imports[0]).toContain('variables.scss');

    const variablesFile = discovery.files.find(f => f.type === ScssFileType.VARIABLES);
    expect(variablesFile?.importedBy.length).toBeGreaterThan(0);
  });
});
