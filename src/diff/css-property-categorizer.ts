/**
 * CSS Property Categorization Engine
 * Provides semantic understanding of CSS properties and their impact levels
 */

export interface PropertyCategoryInfo {
  category: 'typography' | 'layout' | 'color' | 'animation' | 'other';
  impact: 'high' | 'medium' | 'low';
  description: string;
  relatedProperties: string[];
  accessibility?: boolean;
  responsive?: boolean;
}

export interface PropertyAnalysisResult {
  property: string;
  category: string;
  impact: string;
  description: string;
  relatedProperties: string[];
  accessibility: boolean;
  responsive: boolean;
  visualImpact: 'major' | 'moderate' | 'minor';
  performanceImpact: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Core CSS Property Categorizer
 */
export class CssPropertyCategorizer {
  private readonly propertyRegistry: Map<string, PropertyCategoryInfo>;
  private readonly categoryPatterns: Map<RegExp, PropertyCategoryInfo>;

  constructor() {
    this.propertyRegistry = new Map();
    this.categoryPatterns = new Map();
    this.initializePropertyDatabase();
    this.initializeCategoryPatterns();
  }

  /**
   * Categorize a CSS property and determine its impact
   */
  categorizeProperty(property: string): PropertyAnalysisResult {
    const normalizedProperty = this.normalizePropertyName(property);
    
    // Try exact match first
    const exactMatch = this.propertyRegistry.get(normalizedProperty);
    if (exactMatch) {
      return this.createAnalysisResult(property, exactMatch);
    }

    // Try pattern matching
    for (const [pattern, info] of this.categoryPatterns) {
      if (pattern.test(normalizedProperty)) {
        return this.createAnalysisResult(property, info);
      }
    }

    // Default categorization for unknown properties
    return this.createAnalysisResult(property, {
      category: 'other',
      impact: 'low',
      description: 'Unknown or custom CSS property',
      relatedProperties: [],
      accessibility: false,
      responsive: false
    });
  }

  /**
   * Analyze multiple properties and their relationships
   */
  analyzePropertyGroup(properties: string[]): {
    properties: PropertyAnalysisResult[];
    groupImpact: 'high' | 'medium' | 'low';
    crossCategoryChanges: boolean;
    accessibilityChanges: boolean;
    responsiveChanges: boolean;
  } {
    const analyzedProperties = properties.map(prop => this.categorizeProperty(prop));
    
    const highImpactCount = analyzedProperties.filter(p => p.impact === 'high').length;
    const mediumImpactCount = analyzedProperties.filter(p => p.impact === 'medium').length;
    
    const categories = new Set(analyzedProperties.map(p => p.category));
    const crossCategoryChanges = categories.size > 1;
    
    const accessibilityChanges = analyzedProperties.some(p => p.accessibility);
    const responsiveChanges = analyzedProperties.some(p => p.responsive);

    let groupImpact: 'high' | 'medium' | 'low' = 'low';
    if (highImpactCount > 0 || (mediumImpactCount > 2)) {
      groupImpact = 'high';
    } else if (mediumImpactCount > 0 || crossCategoryChanges) {
      groupImpact = 'medium';
    }

    return {
      properties: analyzedProperties,
      groupImpact,
      crossCategoryChanges,
      accessibilityChanges,
      responsiveChanges
    };
  }

  /**
   * Get properties related to a specific category
   */
  getPropertiesByCategory(category: string): string[] {
    const properties: string[] = [];
    for (const [property, info] of this.propertyRegistry) {
      if (info.category === category) {
        properties.push(property);
      }
    }
    return properties;
  }

  /**
   * Check if a property affects accessibility
   */
  isAccessibilityProperty(property: string): boolean {
    const info = this.getPropertyInfo(property);
    return info?.accessibility || false;
  }

  /**
   * Check if a property is responsive-related
   */
  isResponsiveProperty(property: string): boolean {
    const info = this.getPropertyInfo(property);
    return info?.responsive || false;
  }

  /**
   * Get detailed information about a property
   */
  getPropertyInfo(property: string): PropertyCategoryInfo | null {
    const normalized = this.normalizePropertyName(property);
    return this.propertyRegistry.get(normalized) || null;
  }

  private createAnalysisResult(property: string, info: PropertyCategoryInfo): PropertyAnalysisResult {
    return {
      property,
      category: info.category,
      impact: info.impact,
      description: info.description,
      relatedProperties: info.relatedProperties,
      accessibility: info.accessibility || false,
      responsive: info.responsive || false,
      visualImpact: this.determineVisualImpact(info),
      performanceImpact: this.determinePerformanceImpact(property, info)
    };
  }

  private determineVisualImpact(info: PropertyCategoryInfo): 'major' | 'moderate' | 'minor' {
    if (info.category === 'layout' && info.impact === 'high') {
      return 'major';
    }
    if (info.category === 'typography' || info.category === 'color') {
      return info.impact === 'high' ? 'major' : 'moderate';
    }
    return 'minor';
  }

  private determinePerformanceImpact(property: string, info: PropertyCategoryInfo): 'high' | 'medium' | 'low' | 'none' {
    const highPerformanceImpact = [
      'transform', 'opacity', 'filter', 'backdrop-filter',
      'will-change', 'contain', 'isolation'
    ];
    
    const mediumPerformanceImpact = [
      'box-shadow', 'border-radius', 'background-image',
      'mask', 'clip-path'
    ];

    if (highPerformanceImpact.some(prop => property.includes(prop))) {
      return 'high';
    }
    if (mediumPerformanceImpact.some(prop => property.includes(prop))) {
      return 'medium';
    }
    if (info.category === 'animation') {
      return 'medium';
    }
    return 'low';
  }
  private normalizePropertyName(property: string): string {
    return property.toLowerCase().trim().replace(/^-(?:webkit|moz|ms|o)-/, '');
  }

  private initializePropertyDatabase(): void {
    // Typography Properties
    this.addProperty('font-family', {
      category: 'typography',
      impact: 'high',
      description: 'Defines the font family for text',
      relatedProperties: ['font-size', 'font-weight', 'line-height'],
      accessibility: true,
      responsive: true
    });

    this.addProperty('font-size', {
      category: 'typography',
      impact: 'high',
      description: 'Sets the size of text',
      relatedProperties: ['line-height', 'font-family', 'letter-spacing'],
      accessibility: true,
      responsive: true
    });

    this.addProperty('line-height', {
      category: 'typography',
      impact: 'medium',
      description: 'Controls spacing between lines of text',
      relatedProperties: ['font-size', 'font-family'],
      accessibility: true,
      responsive: true
    });

    this.addProperty('letter-spacing', {
      category: 'typography',
      impact: 'medium',
      description: 'Adjusts spacing between characters',
      relatedProperties: ['font-size', 'word-spacing'],
      accessibility: true
    });

    this.addProperty('text-align', {
      category: 'typography',
      impact: 'medium',
      description: 'Aligns text horizontally',
      relatedProperties: ['text-justify', 'direction'],
      responsive: true
    });

    // Layout Properties
    this.addProperty('display', {
      category: 'layout',
      impact: 'high',
      description: 'Defines how an element is displayed',
      relatedProperties: ['position', 'float', 'clear'],
      responsive: true
    });

    this.addProperty('position', {
      category: 'layout',
      impact: 'high',
      description: 'Specifies positioning method',
      relatedProperties: ['top', 'right', 'bottom', 'left', 'z-index']
    });

    this.addProperty('width', {
      category: 'layout',
      impact: 'high',
      description: 'Sets element width',
      relatedProperties: ['max-width', 'min-width', 'height'],
      responsive: true
    });

    this.addProperty('height', {
      category: 'layout',
      impact: 'high',
      description: 'Sets element height',
      relatedProperties: ['max-height', 'min-height', 'width'],
      responsive: true
    });

    this.addProperty('margin', {
      category: 'layout',
      impact: 'medium',
      description: 'Sets outer spacing around element',
      relatedProperties: ['padding', 'border'],
      responsive: true
    });

    this.addProperty('padding', {
      category: 'layout',
      impact: 'medium',
      description: 'Sets inner spacing within element',
      relatedProperties: ['margin', 'border'],
      responsive: true
    });

    // Color Properties
    this.addProperty('color', {
      category: 'color',
      impact: 'high',
      description: 'Sets text color',
      relatedProperties: ['background-color', 'border-color'],
      accessibility: true
    });

    this.addProperty('background-color', {
      category: 'color',
      impact: 'high',
      description: 'Sets background color',
      relatedProperties: ['color', 'background-image'],
      accessibility: true
    });

    this.addProperty('border-color', {
      category: 'color',
      impact: 'medium',
      description: 'Sets border color',
      relatedProperties: ['border-width', 'border-style', 'color']
    });

    // Animation Properties
    this.addProperty('transition', {
      category: 'animation',
      impact: 'medium',
      description: 'Defines transitions between states',
      relatedProperties: ['animation', 'transform']
    });

    this.addProperty('animation', {
      category: 'animation',
      impact: 'medium',
      description: 'Applies keyframe animations',
      relatedProperties: ['transition', 'transform']
    });

    this.addProperty('transform', {
      category: 'animation',
      impact: 'medium',
      description: 'Applies transformations to elements',
      relatedProperties: ['transition', 'animation', 'transform-origin']
    });
  }

  private initializeCategoryPatterns(): void {
    // Typography patterns
    this.categoryPatterns.set(/^font-.*/, {
      category: 'typography',
      impact: 'medium',
      description: 'Font-related property',
      relatedProperties: [],
      accessibility: true
    });

    this.categoryPatterns.set(/^text-.*/, {
      category: 'typography',
      impact: 'medium',
      description: 'Text styling property',
      relatedProperties: [],
      accessibility: true
    });

    // Layout patterns
    this.categoryPatterns.set(/^(margin|padding)-.*/, {
      category: 'layout',
      impact: 'medium',
      description: 'Spacing property',
      relatedProperties: [],
      responsive: true
    });

    this.categoryPatterns.set(/^border-.*/, {
      category: 'layout',
      impact: 'low',
      description: 'Border property',
      relatedProperties: []
    });

    // Color patterns
    this.categoryPatterns.set(/.*-color$/, {
      category: 'color',
      impact: 'medium',
      description: 'Color property',
      relatedProperties: [],
      accessibility: true
    });

    // Animation patterns
    this.categoryPatterns.set(/^(animation|transition|transform)-.*/, {
      category: 'animation',
      impact: 'medium',
      description: 'Animation property',
      relatedProperties: []
    });

    // Custom property patterns
    this.categoryPatterns.set(/^--.*/, {
      category: 'other',
      impact: 'low',
      description: 'CSS custom property (variable)',
      relatedProperties: []
    });
  }

  private addProperty(name: string, info: PropertyCategoryInfo): void {
    this.propertyRegistry.set(name, info);
  }
}

/**
 * Default singleton instance for global use
 */
export const defaultPropertyCategorizer = new CssPropertyCategorizer();
