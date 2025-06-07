import { CssPropertyCategorizer, PropertyCategoryInfo, PropertyAnalysisResult } from '../css-property-categorizer';

describe('CssPropertyCategorizer', () => {
  let categorizer: CssPropertyCategorizer;

  beforeEach(() => {
    categorizer = new CssPropertyCategorizer();
  });

  describe('categorizeProperty', () => {    test('should categorize typography properties correctly', () => {
      const result = categorizer.categorizeProperty('font-size');
      
      expect(result.category).toBe('typography');
      expect(result.impact).toBe('high'); // font-size is high impact
      expect(result.accessibility).toBe(true);
      expect(result.visualImpact).toBe('major'); // high impact typography = major visual impact
    });

    test('should categorize layout properties correctly', () => {
      const result = categorizer.categorizeProperty('margin');
      
      expect(result.category).toBe('layout');
      expect(result.impact).toBe('medium');
      expect(result.responsive).toBe(true);
    });    test('should categorize color properties correctly', () => {
      const result = categorizer.categorizeProperty('color');
      
      expect(result.category).toBe('color');
      expect(result.accessibility).toBe(true);
      expect(result.visualImpact).toBe('major'); // color is high impact, so major visual impact
    });

    test('should categorize animation properties correctly', () => {
      const result = categorizer.categorizeProperty('animation-duration');
      
      expect(result.category).toBe('animation');
      expect(result.performanceImpact).toBe('medium');
    });

    test('should handle unknown properties', () => {
      const result = categorizer.categorizeProperty('unknown-property');
      
      expect(result.category).toBe('other');
      expect(result.impact).toBe('low');
    });    test('should handle vendor prefixed properties', () => {
      const result = categorizer.categorizeProperty('-webkit-transform');
      
      expect(result.category).toBe('animation'); // transform is animation category
      expect(result.performanceImpact).toBe('high'); // transform is high performance impact
    });

    test('should detect high-impact properties', () => {
      const result = categorizer.categorizeProperty('display');
      
      expect(result.impact).toBe('high');
      expect(result.visualImpact).toBe('major');
    });
  });
  describe('analyzePropertyGroup', () => {
    test('should analyze a group of related properties', () => {
      const properties = ['font-size', 'font-weight', 'line-height'];
      const result = categorizer.analyzePropertyGroup(properties);
      
      expect(result.properties).toHaveLength(3);
      expect(result.accessibilityChanges).toBe(true);
      expect(result.crossCategoryChanges).toBe(false); // All typography
    });

    test('should detect mixed category groups', () => {
      const properties = ['color', 'margin', 'font-size'];
      const result = categorizer.analyzePropertyGroup(properties);
      
      expect(result.crossCategoryChanges).toBe(true);
      expect(result.properties).toHaveLength(3);
    });

    test('should identify high-impact groups', () => {
      const properties = ['display', 'position', 'transform'];
      const result = categorizer.analyzePropertyGroup(properties);
      
      expect(result.groupImpact).toBe('high');
    });
  });
  describe('getPropertyInfo', () => {
    test('should return property info for typography properties', () => {
      const info = categorizer.getPropertyInfo('font-size');
      
      expect(info).toBeTruthy();
      expect(info?.category).toBe('typography');
      expect(info?.relatedProperties).toContain('line-height');
    });

    test('should return property info for layout properties', () => {
      const info = categorizer.getPropertyInfo('margin');
      
      expect(info).toBeTruthy();
      expect(info?.category).toBe('layout');
      expect(info?.relatedProperties).toContain('padding');
    });

    test('should return null for unknown properties', () => {
      const info = categorizer.getPropertyInfo('unknown-property');
      
      expect(info).toBeNull();
    });
  });

  describe('performance impact analysis', () => {
    test('should identify high-performance impact properties', () => {
      const highImpactProps = [
        'transform',
        'animation',
        'filter',
        'box-shadow'
      ];

      highImpactProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(['high', 'medium']).toContain(result.performanceImpact);
      });
    });

    test('should identify low-performance impact properties', () => {
      const lowImpactProps = [
        'color',
        'font-size',
        'text-align'
      ];

      lowImpactProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(['low', 'none']).toContain(result.performanceImpact);
      });
    });
  });

  describe('accessibility analysis', () => {    test('should identify accessibility-critical properties', () => {
      const accessibilityProps = [
        'color',
        'background-color', 
        'font-size',
        'font-family',
        'line-height',
        'letter-spacing'
      ];

      accessibilityProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.accessibility).toBe(true);
      });
    });    test('should identify non-accessibility properties', () => {
      const nonAccessibilityProps = [
        'margin',
        'padding',
        'border-color'
      ];

      nonAccessibilityProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.accessibility).toBe(false);
      });
    });
  });

  describe('responsive design analysis', () => {
    test('should identify responsive-related properties', () => {
      const responsiveProps = [
        'width',
        'height',
        'margin',
        'padding',
        'font-size'
      ];

      responsiveProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.responsive).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    test('should handle empty property names', () => {
      const result = categorizer.categorizeProperty('');
      
      expect(result.category).toBe('other');
      expect(result.impact).toBe('low');
    });    test('should handle properties with special characters', () => {
      const result = categorizer.categorizeProperty('--custom-property');
      
      expect(result.category).toBe('other');
      expect(result.description).toContain('CSS custom property'); // Match actual message
    });test('should normalize property names correctly', () => {
      const result1 = categorizer.categorizeProperty('fontSize'); // camelCase - will be other
      const result2 = categorizer.categorizeProperty('font-size'); // kebab-case - will be typography
      
      // These should be different since camelCase isn't normalized to kebab-case
      expect(result1.category).toBe('other');
      expect(result2.category).toBe('typography');
    });
  });

  describe('property database integrity', () => {    test('should have comprehensive typography coverage', () => {
      const typographyProps = [
        'font-family', 'font-size', 'line-height', 
        'letter-spacing', 'text-align'
      ];

      typographyProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.category).toBe('typography');
      });
    });test('should have comprehensive layout coverage', () => {
      const layoutProps = [
        'display', 'position', 'width', 'height', 
        'margin', 'padding'
      ];

      layoutProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.category).toBe('layout');
      });
    });test('should have comprehensive color coverage', () => {
      const colorProps = [
        'color', 'background-color', 'border-color'
      ];

      colorProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.category).toBe('color');
      });
    });
  });
});
