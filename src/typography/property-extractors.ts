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
  private extractors = new Map<TypographyProperty, PropertyExtractor>();  constructor() {
    // Existing extractors
    this.extractors.set('font-family', new FontFamilyExtractor());
    this.extractors.set('font-size', new FontSizeExtractor());
    this.extractors.set('font-weight', new FontWeightExtractor());
    this.extractors.set('line-height', new LineHeightExtractor());
    this.extractors.set('letter-spacing', new LetterSpacingExtractor());
    this.extractors.set('text-transform', new TextTransformExtractor());
    
    // Font shorthand extractor
    this.extractors.set('font', new FontShorthandExtractor());
    
    // New font property extractors
    this.extractors.set('font-style', new FontStyleExtractor());
    this.extractors.set('font-variant', new FontVariantExtractor());
    this.extractors.set('font-stretch', new FontStretchExtractor());
    this.extractors.set('font-kerning', new FontKerningExtractor());
    this.extractors.set('font-feature-settings', new FontFeatureExtractor());
    this.extractors.set('font-variant-numeric', new FontVariantNumericExtractor());
    this.extractors.set('font-variant-ligatures', new FontVariantLigaturesExtractor());
    
    // Text property extractors
    this.extractors.set('word-spacing', new WordSpacingExtractor());
    this.extractors.set('text-decoration', new TextDecorationExtractor());
    this.extractors.set('text-align', new TextAlignExtractor());
    this.extractors.set('text-indent', new TextIndentExtractor());
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

/**
 * Font style extractor
 */
export class FontStyleExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'italic', 'oblique', 'inherit', 'initial', 'unset'
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
    const trimmed = value.trim().toLowerCase();
    return FontStyleExtractor.VALID_VALUES.includes(trimmed) || 
           /^oblique\s+\d*\.?\d+deg$/.test(trimmed);
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font variant extractor
 */
export class FontVariantExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'small-caps', 'inherit', 'initial', 'unset'
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
    return FontVariantExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font stretch extractor
 */
export class FontStretchExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
    'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded',
    'inherit', 'initial', 'unset'
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
    const trimmed = value.trim().toLowerCase();
    return FontStretchExtractor.VALID_VALUES.includes(trimmed) ||
           /^\d*\.?\d+%$/.test(trimmed);
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Word spacing extractor
 */
export class WordSpacingExtractor implements PropertyExtractor {
  
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
 * Text decoration extractor
 */
export class TextDecorationExtractor implements PropertyExtractor {
  
  private static readonly VALID_LINES = [
    'none', 'underline', 'overline', 'line-through', 'blink'
  ];
  
  private static readonly VALID_STYLES = [
    'solid', 'double', 'dotted', 'dashed', 'wavy'
  ];

  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const parsed = this.parseTextDecoration(normalizedValue);
    
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
    const trimmed = value.trim().toLowerCase();
    
    if (['none', 'inherit', 'initial', 'unset'].includes(trimmed)) {
      return true;
    }
    
    // Parse shorthand values
    const parts = trimmed.split(/\s+/);
    return parts.some(part => 
      TextDecorationExtractor.VALID_LINES.includes(part) ||
      TextDecorationExtractor.VALID_STYLES.includes(part) ||
      this.isValidColor(part)
    );
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private parseTextDecoration(value: string): {
    line?: string;
    style?: string;
    color?: string;
  } {
    const parts = value.split(/\s+/);
    const result: any = {};
    
    for (const part of parts) {
      if (TextDecorationExtractor.VALID_LINES.includes(part)) {
        result.line = part;
      } else if (TextDecorationExtractor.VALID_STYLES.includes(part)) {
        result.style = part;
      } else if (this.isValidColor(part)) {
        result.color = part;
      }
    }
    
    return result;
  }

  private isValidColor(value: string): boolean {
    return /^#[0-9a-f]{3,8}$/i.test(value) ||
           /^rgba?\(/i.test(value) ||
           /^hsla?\(/i.test(value) ||
           ['transparent', 'currentcolor'].includes(value);
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Text align extractor
 */
export class TextAlignExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'left', 'right', 'center', 'justify', 'start', 'end',
    'inherit', 'initial', 'unset'
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
    return TextAlignExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Text indent extractor
 */
export class TextIndentExtractor implements PropertyExtractor {
  
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
    if (['inherit', 'initial', 'unset'].includes(trimmed)) {
      return true;
    }
    
    // Length or percentage values
    return /^-?\d*\.?\d+(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)$/i.test(trimmed);
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
 * Font feature settings extractor
 */
export class FontFeatureExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const features = this.parseFeatures(normalizedValue);
    
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
    const trimmed = value.trim().toLowerCase();
    
    if (['normal', 'inherit', 'initial', 'unset'].includes(trimmed)) {
      return true;
    }
    
    // Feature syntax: "liga" 1, "kern" 0
    return /^"[a-z0-9]{4}"\s+(0|1|on|off)(\s*,\s*"[a-z0-9]{4}"\s+(0|1|on|off))*$/i.test(trimmed);
  }

  public normalize(value: string): string {
    return value.trim();
  }

  private parseFeatures(value: string): Array<{ feature: string; enabled: boolean }> {
    if (value === 'normal') return [];
    
    const features: Array<{ feature: string; enabled: boolean }> = [];
    const matches = value.matchAll(/"([a-z0-9]{4})"\s+(0|1|on|off)/gi);
    
    for (const match of matches) {
      features.push({
        feature: match[1],
        enabled: ['1', 'on'].includes(match[2].toLowerCase())
      });
    }
    
    return features;
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font variant numeric extractor
 */
export class FontVariantNumericExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'ordinal', 'slashed-zero', 'lining-nums', 'oldstyle-nums',
    'proportional-nums', 'tabular-nums', 'diagonal-fractions', 'stacked-fractions',
    'inherit', 'initial', 'unset'
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
    const parts = value.trim().toLowerCase().split(/\s+/);
    return parts.every(part => FontVariantNumericExtractor.VALID_VALUES.includes(part));
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font variant ligatures extractor
 */
export class FontVariantLigaturesExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'none', 'common-ligatures', 'no-common-ligatures',
    'discretionary-ligatures', 'no-discretionary-ligatures',
    'historical-ligatures', 'no-historical-ligatures',
    'contextual', 'no-contextual', 'inherit', 'initial', 'unset'
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
    const parts = value.trim().toLowerCase().split(/\s+/);
    return parts.every(part => FontVariantLigaturesExtractor.VALID_VALUES.includes(part));
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font kerning extractor
 */
export class FontKerningExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'auto', 'normal', 'none', 'inherit', 'initial', 'unset'
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
    return FontKerningExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Shorthand font parser for parsing CSS font shorthand property
 * Handles: font: [font-style] [font-variant] [font-weight] [font-stretch] font-size[/line-height] font-family
 */
export class ShorthandFontParser {
  /**
   * Parse font shorthand value into individual components
   */
  public static parseFontShorthand(value: string): Partial<Record<TypographyProperty, string>> {
    const result: Partial<Record<TypographyProperty, string>> = {};
    
    // Clean up the value
    const cleanValue = value.trim().replace(/\s+/g, ' ');
    
    // Handle system font keywords first
    const systemFonts = [
      'caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'
    ];
    
    if (systemFonts.includes(cleanValue.toLowerCase())) {
      result['font'] = cleanValue;
      return result;
    }
    
    // Split the value into tokens
    const tokens = this.tokenize(cleanValue);
    
    if (tokens.length < 2) {
      // Invalid shorthand, must have at least font-size and font-family
      return {};
    }
    
    let tokenIndex = 0;
    
    // Parse optional font-style (italic, oblique, normal)
    if (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      if (this.isFontStyle(token)) {
        result['font-style'] = token;
        tokenIndex++;
      }
    }
    
    // Parse optional font-variant (small-caps, normal)
    if (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      if (this.isFontVariant(token)) {
        result['font-variant'] = token;
        tokenIndex++;
      }
    }
    
    // Parse optional font-weight (bold, bolder, lighter, 100-900, normal)
    if (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      if (this.isFontWeight(token)) {
        result['font-weight'] = token;
        tokenIndex++;
      }
    }
    
    // Parse optional font-stretch
    if (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      if (this.isFontStretch(token)) {
        result['font-stretch'] = token;
        tokenIndex++;
      }
    }
    
    // Parse required font-size (and optional line-height)
    if (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      if (this.isFontSize(token)) {
        const sizeLineHeight = this.parseSizeLineHeight(token);
        result['font-size'] = sizeLineHeight.size;
        if (sizeLineHeight.lineHeight) {
          result['line-height'] = sizeLineHeight.lineHeight;
        }
        tokenIndex++;
      } else {
        // Invalid shorthand, font-size is required
        return {};
      }
    }
    
    // Parse required font-family (everything remaining)
    if (tokenIndex < tokens.length) {
      const fontFamily = tokens.slice(tokenIndex).join(' ');
      result['font-family'] = fontFamily;
    } else {
      // Invalid shorthand, font-family is required
      return {};
    }
    
    return result;
  }
  
  /**
   * Tokenize font shorthand value while preserving quoted strings
   */
  private static tokenize(value: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      tokens.push(current.trim());
    }
    
    return tokens;
  }
  
  /**
   * Parse font-size and optional line-height (size/line-height)
   */
  private static parseSizeLineHeight(token: string): { size: string; lineHeight?: string } {
    const parts = token.split('/');
    if (parts.length === 1) {
      return { size: parts[0] };
    } else if (parts.length === 2) {
      return { size: parts[0], lineHeight: parts[1] };
    }
    // Invalid format
    return { size: token };
  }
  
  /**
   * Check if token is a valid font-style value
   */
  private static isFontStyle(token: string): boolean {
    const validValues = ['normal', 'italic', 'oblique'];
    return validValues.includes(token.toLowerCase());
  }
  
  /**
   * Check if token is a valid font-variant value
   */
  private static isFontVariant(token: string): boolean {
    const validValues = ['normal', 'small-caps'];
    return validValues.includes(token.toLowerCase());
  }
  
  /**
   * Check if token is a valid font-weight value
   */
  private static isFontWeight(token: string): boolean {
    const validKeywords = ['normal', 'bold', 'bolder', 'lighter'];
    const numericPattern = /^[1-9]00$/; // 100, 200, ..., 900
    
    return validKeywords.includes(token.toLowerCase()) || numericPattern.test(token);
  }
  
  /**
   * Check if token is a valid font-stretch value
   */
  private static isFontStretch(token: string): boolean {
    const validValues = [
      'normal', 'ultra-condensed', 'extra-condensed', 'condensed', 
      'semi-condensed', 'semi-expanded', 'expanded', 'extra-expanded', 
      'ultra-expanded'
    ];
    return validValues.includes(token.toLowerCase());
  }
  
  /**
   * Check if token is a valid font-size value
   */
  private static isFontSize(token: string): boolean {
    // Remove line-height part if present
    const sizeOnly = token.split('/')[0];
    
    // CSS length units
    const lengthPattern = /^(\d*\.?\d+)(px|em|rem|ex|ch|vw|vh|vmin|vmax|%|pt|pc|in|cm|mm)$/;
    
    // Absolute size keywords
    const absoluteKeywords = ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large'];
    
    // Relative size keywords
    const relativeKeywords = ['larger', 'smaller'];
    
    return lengthPattern.test(sizeOnly) || 
           absoluteKeywords.includes(sizeOnly.toLowerCase()) ||
           relativeKeywords.includes(sizeOnly.toLowerCase());
  }
}

/**
 * Font shorthand property extractor
 */
export class FontShorthandExtractor implements PropertyExtractor {
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const parsedProperties = ShorthandFontParser.parseFontShorthand(declaration.value);
    
    // Create a partial TypographyEntry for the shorthand
    return {
      property: 'font' as TypographyProperty,
      value: {
        original: declaration.value,
        resolved: declaration.value,
        computed: undefined,
        fallbacks: []
      },
      dependencies: {
        variables: this.extractVariables(declaration.value),
        mixins: [],
        imports: [],
        customProperties: this.extractCustomProperties(declaration.value)
      },
      metadata: {
        isResponsive: this.containsVariables(declaration.value),
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: this.containsFunctions(declaration.value),
        isInherited: declaration.value.trim().toLowerCase() === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    // Try to parse the shorthand
    const parsed = ShorthandFontParser.parseFontShorthand(value);
    
    // Valid if we got at least font-size and font-family
    return Object.keys(parsed).length >= 2 && 
           'font-size' in parsed && 
           'font-family' in parsed;
  }

  public normalize(value: string): string {
    return value.trim();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /(?:calc|clamp|min|max|var)\s*\(/i.test(value);
  }

  private extractVariables(value: string): string[] {
    const variables: string[] = [];
    const scssVarMatches = value.match(/\$[\w-]+/g);
    const cssVarMatches = value.match(/var\(\s*--[\w-]+/g);
    
    if (scssVarMatches) {
      variables.push(...scssVarMatches);
    }
    if (cssVarMatches) {
      variables.push(...cssVarMatches.map(match => match.replace('var(', '').trim()));
    }
    
    return variables;
  }

  private extractCustomProperties(value: string): string[] {
    const customProps: string[] = [];
    const matches = value.match(/--[\w-]+/g);
    if (matches) {
      customProps.push(...matches);
    }
    return customProps;
  }
}
