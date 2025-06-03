
import { DeclarationNode } from '../parser/ast-nodes';
import {
  TypographyProperty,
  TypographyEntry,
  VariableResolutionContext,
  FontStackAnalysis
} from './types';

/**
 * Base property extractor interface
 */
export interface PropertyExtractor {
  extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Promise<Partial<TypographyEntry>> | Partial<TypographyEntry>;
  
  validate(value: string): boolean;
  normalize(value: string): string;
}

/**
 * Font family extractor
 */
export class FontFamilyExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const fontStack = this.parseFontStack(normalizedValue);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: false,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: false,
        isInherited: normalizedValue === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    // Font family should not be empty and should be valid CSS
    return value.trim().length > 0 && !value.includes(';');
  }

  public normalize(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private parseFontStack(fontFamily: string): string[] {
    return fontFamily
      .split(',')
      .map(font => font.trim().replace(/^['"]|['"]$/g, ''))
      .filter(font => font.length > 0);
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font size extractor
 */
export class FontSizeExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const unit = this.extractUnit(normalizedValue);
    const isRelative = this.isRelativeUnit(unit);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: isRelative,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: this.containsFunctions(declaration.value),
        isInherited: normalizedValue === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    // Check for valid CSS length values or keywords
    const validPattern = /^(inherit|initial|unset|\d*\.?\d+(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/i;
    return validPattern.test(value.trim());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private extractUnit(value: string): string {
    const match = value.match(/[a-z%]+$/i);
    return match ? match[0] : '';
  }

  private isRelativeUnit(unit: string): boolean {
    return ['em', 'rem', '%', 'vw', 'vh', 'vmin', 'vmax'].includes(unit);
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /calc\(|clamp\(|min\(|max\(/i.test(value);
  }
}

/**
 * Font weight extractor
 */
export class FontWeightExtractor implements PropertyExtractor {
  
  private static readonly WEIGHT_KEYWORDS = [
    'normal', 'bold', 'bolder', 'lighter', 'inherit', 'initial', 'unset'
  ];

  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const numericWeight = this.getNumericWeight(normalizedValue);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: false,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: false,
        isInherited: ['inherit', 'bolder', 'lighter'].includes(normalizedValue),
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    
    // Check keywords
    if (FontWeightExtractor.WEIGHT_KEYWORDS.includes(trimmed)) {
      return true;
    }
    
    // Check numeric values (100-900)
    const numeric = parseInt(trimmed);
    return !isNaN(numeric) && numeric >= 100 && numeric <= 900 && numeric % 100 === 0;
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private getNumericWeight(value: string): number | null {
    const keywordMap: { [key: string]: number } = {
      'normal': 400,
      'bold': 700
    };
    
    if (keywordMap[value]) {
      return keywordMap[value];
    }
    
    const numeric = parseInt(value);
    return !isNaN(numeric) ? numeric : null;
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Line height extractor
 */
export class LineHeightExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const isUnitless = this.isUnitless(normalizedValue);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: !isUnitless,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: this.containsFunctions(declaration.value),
        isInherited: normalizedValue === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    
    // Keywords
    if (['normal', 'inherit', 'initial', 'unset'].includes(trimmed)) {
      return true;
    }
    
    // Unitless numbers
    if (/^\d*\.?\d+$/.test(trimmed)) {
      return parseFloat(trimmed) >= 0;
    }
    
    // Length values
    return /^\d*\.?\d+(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)$/i.test(trimmed);
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private isUnitless(value: string): boolean {
    return /^\d*\.?\d+$/.test(value) && !value.includes('%');
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /calc\(|clamp\(|min\(|max\(/i.test(value);
  }
}

/**
 * Letter spacing extractor
 */
export class LetterSpacingExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: this.hasRelativeUnits(normalizedValue),
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: this.containsFunctions(declaration.value),
        isInherited: normalizedValue === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    
    // Keywords
    if (['normal', 'inherit', 'initial', 'unset'].includes(trimmed)) {
      return true;
    }
    
    // Length values (can be negative)
    return /^-?\d*\.?\d+(px|em|rem|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)$/i.test(trimmed);
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private hasRelativeUnits(value: string): boolean {
    return /em|rem|%|vw|vh|vmin|vmax/i.test(value);
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /calc\(|clamp\(|min\(|max\(/i.test(value);
  }
}

/**
 * Text transform extractor
 */
export class TextTransformExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'none', 'capitalize', 'uppercase', 'lowercase', 'inherit', 'initial', 'unset'
  ];

  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: false,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: false,
        isInherited: normalizedValue === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    return TextTransformExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Custom property extractor for CSS custom properties (--*)
 */
export class CustomPropertyExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    return {
      value: {
        original: declaration.value,
        resolved: declaration.value // Custom properties are not resolved
      },
      metadata: {
        isResponsive: false,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: this.containsFunctions(declaration.value),
        isInherited: true, // Custom properties are inheritable
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    // Custom properties can contain any valid CSS value
    return value.trim().length > 0;
  }

  public normalize(value: string): string {
    return value.trim();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /calc\(|clamp\(|min\(|max\(|var\(/i.test(value);
  }
}

/**
 * Property extractor factory
 */
export class PropertyExtractorFactory {
  private extractors = new Map<TypographyProperty, PropertyExtractor>();

  constructor() {
    this.extractors.set('font-family', new FontFamilyExtractor());
    this.extractors.set('font-size', new FontSizeExtractor());
    this.extractors.set('font-weight', new FontWeightExtractor());
    this.extractors.set('line-height', new LineHeightExtractor());
    this.extractors.set('letter-spacing', new LetterSpacingExtractor());
    this.extractors.set('text-transform', new TextTransformExtractor());
  }

  public getExtractor(property: TypographyProperty): PropertyExtractor {
    // Check for custom properties
    if (property.startsWith('--')) {
      return new CustomPropertyExtractor();
    }

    return this.extractors.get(property) || new CustomPropertyExtractor();
  }

  public registerExtractor(property: TypographyProperty, extractor: PropertyExtractor): void {
    this.extractors.set(property, extractor);
  }
}
