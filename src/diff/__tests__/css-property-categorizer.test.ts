import { CssPropertyCategorizer, PropertyCategoryInfo, PropertyAnalysisResult } from '../css-property-categorizer';

describe('CssPropertyCategorizer', () => {
  let categorizer: CssPropertyCategorizer;

  beforeEach(() => {
    categorizer = new CssPropertyCategorizer();
  });

  describe('categorizeProperty', () => {
    test('should categorize typography properties correctly', () => {
      const result = categorizer.categorizeProperty('font-size');
      
      expect(result.category).toBe('typography');
      expect(result.impact).toBe('medium');
      expect(result.accessibility).toBe(true);
      expect(result.visualImpact).toBe('moderate');
    });

    test('should categorize layout properties correctly', () => {
      const result = categorizer.categorizeProperty('margin');
      
      expect(result.category).toBe('layout');
      expect(result.impact).toBe('medium');
      expect(result.responsive).toBe(true);
    });

    test('should categorize color properties correctly', () => {
      const result = categorizer.categorizeProperty('color');
      
      expect(result.category).toBe('color');
      expect(result.accessibility).toBe(true);
      expect(result.visualImpact).toBe('moderate');
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
    });

    test('should handle vendor prefixed properties', () => {
      const result = categorizer.categorizeProperty('-webkit-transform');
      
      expect(result.category).toBe('layout');
      expect(result.performanceImpact).toBe('high');
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
      
      expect(result.primaryCategory).toBe('typography');
      expect(result.hasHighImpact).toBe(false);
      expect(result.affectsAccessibility).toBe(true);
      expect(result.properties).toHaveLength(3);
    });

    test('should detect mixed category groups', () => {
      const properties = ['color', 'margin', 'font-size'];
      const result = categorizer.analyzePropertyGroup(properties);
      
      expect(result.categories).toContain('color');
      expect(result.categories).toContain('layout');
      expect(result.categories).toContain('typography');
      expect(result.categories).toHaveLength(3);
    });

    test('should identify high-impact groups', () => {
      const properties = ['display', 'position', 'transform'];
      const result = categorizer.analyzePropertyGroup(properties);
      
      expect(result.hasHighImpact).toBe(true);
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('getRelatedProperties', () => {
    test('should find related typography properties', () => {
      const related = categorizer.getRelatedProperties('font-size');
      
      expect(related).toContain('line-height');
      expect(related).toContain('font-weight');
      expect(related).toContain('font-family');
    });

    test('should find related layout properties', () => {
      const related = categorizer.getRelatedProperties('margin');
      
      expect(related).toContain('padding');
      expect(related).toContain('border');
    });

    test('should return empty array for unrelated properties', () => {
      const related = categorizer.getRelatedProperties('unknown-property');
      
      expect(related).toEqual([]);
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

  describe('accessibility analysis', () => {
    test('should identify accessibility-critical properties', () => {
      const accessibilityProps = [
        'color',
        'background-color',
        'font-size',
        'line-height',
        'outline'
      ];

      accessibilityProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.accessibility).toBe(true);
      });
    });

    test('should identify non-accessibility properties', () => {
      const nonAccessibilityProps = [
        'margin-left',
        'border-radius',
        'text-decoration'
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
    });

    test('should handle properties with special characters', () => {
      const result = categorizer.categorizeProperty('--custom-property');
      
      expect(result.category).toBe('other');
      expect(result.description).toContain('CSS custom property');
    });

    test('should normalize property names correctly', () => {
      const result1 = categorizer.categorizeProperty('fontSize');
      const result2 = categorizer.categorizeProperty('font-size');
      
      expect(result1.category).toBe(result2.category);
      expect(result1.impact).toBe(result2.impact);
    });
  });

  describe('property database integrity', () => {
    test('should have comprehensive typography coverage', () => {
      const typographyProps = [
        'font-family', 'font-size', 'font-weight', 'font-style',
        'line-height', 'letter-spacing', 'word-spacing', 'text-align',
        'text-decoration', 'text-transform'
      ];

      typographyProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.category).toBe('typography');
      });
    });

    test('should have comprehensive layout coverage', () => {
      const layoutProps = [
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'width', 'height', 'margin', 'padding', 'border',
        'flex', 'grid', 'float', 'clear'
      ];

      layoutProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.category).toBe('layout');
      });
    });

    test('should have comprehensive color coverage', () => {
      const colorProps = [
        'color', 'background-color', 'border-color',
        'outline-color', 'text-shadow', 'box-shadow'
      ];

      colorProps.forEach(prop => {
        const result = categorizer.categorizeProperty(prop);
        expect(result.category).toBe('color');
      });
    });
  });
});
