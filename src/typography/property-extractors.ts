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
    // Basic font property extractors
    this.extractors.set('font-family', new FontFamilyExtractor());
    this.extractors.set('font-size', new FontSizeExtractor());
    this.extractors.set('font-weight', new FontWeightExtractor());
    this.extractors.set('font-style', new FontStyleExtractor());
    this.extractors.set('font-variant', new FontVariantExtractor());
    this.extractors.set('font-stretch', new FontStretchExtractor());
    
    // Advanced font property extractors
    this.extractors.set('font-kerning', new FontKerningExtractor());
    this.extractors.set('font-feature-settings', new FontFeatureExtractor());
    this.extractors.set('font-variant-numeric', new FontVariantNumericExtractor());
    this.extractors.set('font-variant-ligatures', new FontVariantLigaturesExtractor());
    this.extractors.set('font-optical-sizing', new FontOpticalSizingExtractor());
    this.extractors.set('font-variation-settings', new FontVariationSettingsExtractor());
    this.extractors.set('font-display', new FontDisplayExtractor());
    
    // Font shorthand extractor
    this.extractors.set('font', new FontShorthandExtractor());
    
    // Text layout properties
    this.extractors.set('line-height', new LineHeightExtractor());
    this.extractors.set('letter-spacing', new LetterSpacingExtractor());
    this.extractors.set('word-spacing', new WordSpacingExtractor());
    this.extractors.set('text-transform', new TextTransformExtractor());
    this.extractors.set('text-align', new TextAlignExtractor());
    this.extractors.set('text-indent', new TextIndentExtractor());
    
    // Text decoration properties
    this.extractors.set('text-decoration', new TextDecorationExtractor());
    this.extractors.set('text-decoration-line', new TextDecorationLineExtractor());
    this.extractors.set('text-decoration-style', new TextDecorationStyleExtractor());
    this.extractors.set('text-decoration-color', new TextDecorationColorExtractor());
    this.extractors.set('text-decoration-thickness', new TextDecorationThicknessExtractor());
    this.extractors.set('text-underline-position', new TextUnderlinePositionExtractor());
    this.extractors.set('text-shadow', new TextShadowExtractor());
    
    // Text layout and wrapping properties
    this.extractors.set('white-space', new WhiteSpaceExtractor());
    this.extractors.set('word-break', new WordBreakExtractor());
    this.extractors.set('overflow-wrap', new OverflowWrapExtractor());
    this.extractors.set('hyphens', new HyphensExtractor());
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
 * Text decoration line extractor
 */
export class TextDecorationLineExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'none', 'underline', 'overline', 'line-through', 'blink',
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
    return parts.every(part => TextDecorationLineExtractor.VALID_VALUES.includes(part));
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Text decoration style extractor
 */
export class TextDecorationStyleExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'solid', 'double', 'dotted', 'dashed', 'wavy',
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
    return TextDecorationStyleExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Text decoration color extractor
 */
export class TextDecorationColorExtractor implements PropertyExtractor {
  
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
        hasFunctions: this.containsFunctions(declaration.value),
        isInherited: normalizedValue === 'inherit',
        overrides: []
      }
    };
  }

  public validate(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    
    // Check for keywords
    if (['inherit', 'initial', 'unset', 'currentcolor', 'transparent'].includes(trimmed)) {
      return true;
    }
    
    // Check for color values
    return this.isValidColor(trimmed);
  }

  public normalize(value: string): string {
    return value.trim();
  }

  private isValidColor(value: string): boolean {
    return /^#[0-9a-f]{3,8}$/i.test(value) ||
           /^rgba?\(/i.test(value) ||
           /^hsla?\(/i.test(value) ||
           /^hwb\(/i.test(value) ||
           /^lab\(/i.test(value) ||
           /^lch\(/i.test(value) ||
           /^color\(/i.test(value) ||
           /^[a-z]+$/i.test(value); // Named colors
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /(?:calc|clamp|min|max|var|rgb|hsl|hwb|lab|lch|color)\s*\(/i.test(value);
  }
}

/**
 * Text decoration thickness extractor
 */
export class TextDecorationThicknessExtractor implements PropertyExtractor {
  
  private static readonly VALID_KEYWORDS = [
    'auto', 'from-font', 'inherit', 'initial', 'unset'
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
    
    // Check keywords
    if (TextDecorationThicknessExtractor.VALID_KEYWORDS.includes(trimmed)) {
      return true;
    }
    
    // Check length values
    return /^\d*\.?\d+(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)$/i.test(trimmed);
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
    return /(?:calc|clamp|min|max|var)\s*\(/i.test(value);
  }
}

/**
 * Text underline position extractor
 */
export class TextUnderlinePositionExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'auto', 'under', 'left', 'right', 'from-font',
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
    return parts.every(part => TextUnderlinePositionExtractor.VALID_VALUES.includes(part));
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Text shadow extractor
 */
export class TextShadowExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const shadows = this.parseTextShadows(normalizedValue);
    
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
    
    if (['none', 'inherit', 'initial', 'unset'].includes(trimmed)) {
      return true;
    }
    
    // Basic shadow syntax validation
    return /^[^;]+$/.test(trimmed) && !trimmed.includes(';;');
  }

  public normalize(value: string): string {
    return value.trim();
  }

  private parseTextShadows(value: string): Array<{
    offsetX: string;
    offsetY: string;
    blurRadius?: string;
    color?: string;
  }> {
    if (value === 'none') return [];
    
    const shadows: Array<{
      offsetX: string;
      offsetY: string;
      blurRadius?: string;
      color?: string;
    }> = [];
    
    // Split by comma, but not inside functions
    const shadowStrings = this.splitShadows(value);
    
    for (const shadowStr of shadowStrings) {
      const parts = shadowStr.trim().split(/\s+/);
      if (parts.length >= 2) {
        const shadow = {
          offsetX: parts[0],
          offsetY: parts[1],
          blurRadius: parts.length > 2 && /\d/.test(parts[2]) ? parts[2] : undefined,
          color: parts.find(part => this.isColor(part))
        };
        shadows.push(shadow);
      }
    }
    
    return shadows;
  }

  private splitShadows(value: string): string[] {
    const shadows: string[] = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ',' && depth === 0) {
        shadows.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      shadows.push(current.trim());
    }
    
    return shadows;
  }

  private isColor(value: string): boolean {
    return /^#[0-9a-f]{3,8}$/i.test(value) ||
           /^rgba?\(/i.test(value) ||
           /^hsla?\(/i.test(value) ||
           /^[a-z]+$/i.test(value);
  }

  private hasRelativeUnits(value: string): boolean {
    return /em|rem|%|vw|vh|vmin|vmax/i.test(value);
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /(?:calc|clamp|min|max|var|rgb|hsl)\s*\(/i.test(value);
  }
}

/**
 * Font optical sizing extractor
 */
export class FontOpticalSizingExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'auto', 'none', 'inherit', 'initial', 'unset'
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
    return FontOpticalSizingExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Font variation settings extractor
 */
export class FontVariationSettingsExtractor implements PropertyExtractor {
  
  public extract(
    declaration: DeclarationNode,
    context: VariableResolutionContext
  ): Partial<TypographyEntry> {
    const normalizedValue = this.normalize(declaration.value);
    const variations = this.parseVariations(normalizedValue);
    
    return {
      value: {
        original: declaration.value,
        resolved: normalizedValue
      },
      metadata: {
        isResponsive: false,
        hasVariables: this.containsVariables(declaration.value),
        hasFunctions: this.containsFunctions(declaration.value),
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
    
    // Variation syntax: "wght" 400, "wdth" 100
    return /^"[a-z]{4}"\s+[-\d.]+(\s*,\s*"[a-z]{4}"\s+[-\d.]+)*$/i.test(trimmed);
  }

  public normalize(value: string): string {
    return value.trim();
  }

  private parseVariations(value: string): Array<{ axis: string; value: number }> {
    if (value === 'normal') return [];
    
    const variations: Array<{ axis: string; value: number }> = [];
    const matches = value.matchAll(/"([a-z]{4})"\s+([-\d.]+)/gi);
    
    for (const match of matches) {
      variations.push({
        axis: match[1],
        value: parseFloat(match[2])
      });
    }
    
    return variations;
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }

  private containsFunctions(value: string): boolean {
    return /(?:calc|clamp|min|max|var)\s*\(/i.test(value);
  }
}

/**
 * Font display extractor
 */
export class FontDisplayExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'auto', 'block', 'swap', 'fallback', 'optional',
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
    return FontDisplayExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * White space extractor
 */
export class WhiteSpaceExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces',
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
    return WhiteSpaceExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Word break extractor
 */
export class WordBreakExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'break-all', 'keep-all', 'break-word',
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
    return WordBreakExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Overflow wrap extractor
 */
export class OverflowWrapExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'normal', 'break-word', 'anywhere',
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
    return OverflowWrapExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Hyphens extractor
 */
export class HyphensExtractor implements PropertyExtractor {
  
  private static readonly VALID_VALUES = [
    'none', 'manual', 'auto',
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
    return HyphensExtractor.VALID_VALUES.includes(value.trim().toLowerCase());
  }

  public normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private containsVariables(value: string): boolean {
    return value.includes('$') || value.includes('var(');
  }
}

/**
 * Extracts font-kerning property for character spacing control
 */
export class FontKerningExtractor extends BasePropertyExtractor {
  extract(value: string, context: ExtractionContext): TypographyProperty {
    const normalizedValue = this.normalizeValue(value);
    
    // Valid font-kerning values
    const validValues = ['auto', 'normal', 'none'];
    
    if (!validValues.includes(normalizedValue)) {
      return this.createProperty('font-kerning', value, context, [], [`Invalid font-kerning value: ${value}`]);
    }

    return this.createProperty('font-kerning', normalizedValue, context);
  }
}

/**
 * Extracts font-feature-settings property for OpenType features
 */
export class FontFeatureExtractor extends BasePropertyExtractor {
  extract(value: string, context: ExtractionContext): TypographyProperty {
    const normalizedValue = this.normalizeValue(value);
    
    if (normalizedValue === 'normal') {
      return this.createProperty('font-feature-settings', normalizedValue, context);
    }

    // Parse font feature settings like "liga" 1, "kern" 0, etc.
    const featurePattern = /"([a-z]{4})"\s*(?:(\d+|on|off))?/gi;
    const features: string[] = [];
    const warnings: string[] = [];
    
    let match;
    while ((match = featurePattern.exec(normalizedValue)) !== null) {
      const [, feature, setting = '1'] = match;
      
      // Validate 4-character feature tag
      if (feature.length !== 4) {
        warnings.push(`Invalid feature tag length: ${feature}`);
        continue;
      }
      
      // Normalize setting value
      let normalizedSetting = setting;
      if (setting === 'on') normalizedSetting = '1';
      if (setting === 'off') normalizedSetting = '0';
      
      features.push(`"${feature}" ${normalizedSetting}`);
    }

    if (features.length === 0 && normalizedValue !== 'normal') {
      warnings.push(`Unable to parse font-feature-settings: ${value}`);
    }

    const finalValue = features.length > 0 ? features.join(', ') : normalizedValue;
    return this.createProperty('font-feature-settings', finalValue, context, [], warnings);
  }
}

/**
 * Extracts font-variant-numeric property for numeric styling
 */
export class FontVariantNumericExtractor extends BasePropertyExtractor {
  extract(value: string, context: ExtractionContext): TypographyProperty {
    const normalizedValue = this.normalizeValue(value);
    
    if (normalizedValue === 'normal') {
      return this.createProperty('font-variant-numeric', normalizedValue, context);
    }

    // Valid font-variant-numeric values
    const validValues = [
      'lining-nums', 'oldstyle-nums',
      'proportional-nums', 'tabular-nums',
      'diagonal-fractions', 'stacked-fractions',
      'ordinal', 'slashed-zero'
    ];
    
    const values = normalizedValue.split(/\s+/);
    const warnings: string[] = [];
    const validatedValues: string[] = [];
    
    for (const val of values) {
      if (validValues.includes(val)) {
        validatedValues.push(val);
      } else {
        warnings.push(`Invalid font-variant-numeric value: ${val}`);
      }
    }

    const finalValue = validatedValues.length > 0 ? validatedValues.join(' ') : normalizedValue;
    return this.createProperty('font-variant-numeric', finalValue, context, [], warnings);
  }
}

/**
 * Extracts font-variant-ligatures property for ligature control
 */
export class FontVariantLigaturesExtractor extends BasePropertyExtractor {
  extract(value: string, context: ExtractionContext): TypographyProperty {
    const normalizedValue = this.normalizeValue(value);
    
    if (normalizedValue === 'normal' || normalizedValue === 'none') {
      return this.createProperty('font-variant-ligatures', normalizedValue, context);
    }

    // Valid font-variant-ligatures values
    const validValues = [
      'common-ligatures', 'no-common-ligatures',
      'discretionary-ligatures', 'no-discretionary-ligatures',
      'historical-ligatures', 'no-historical-ligatures',
      'contextual', 'no-contextual'
    ];
    
    const values = normalizedValue.split(/\s+/);
    const warnings: string[] = [];
    const validatedValues: string[] = [];
    
    for (const val of values) {
      if (validValues.includes(val)) {
        validatedValues.push(val);
      } else {
        warnings.push(`Invalid font-variant-ligatures value: ${val}`);
      }
    }

    const finalValue = validatedValues.length > 0 ? validatedValues.join(' ') : normalizedValue;
    return this.createProperty('font-variant-ligatures', finalValue, context, [], warnings);
  }
}

/**
 * Extracts font shorthand property with comprehensive parsing
 */
export class FontShorthandExtractor extends BasePropertyExtractor {
  extract(value: string, context: ExtractionContext): TypographyProperty {
    const normalizedValue = this.normalizeValue(value);
    const warnings: string[] = [];
    const extractedProps: { [key: string]: string } = {};
    
    // Handle system fonts first
    const systemFonts = [
      'caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'
    ];
    
    if (systemFonts.includes(normalizedValue)) {
      return this.createProperty('font', normalizedValue, context, [], [], {
        isSystemFont: true,
        systemFontType: normalizedValue
      });
    }

    // Parse complex font shorthand: [font-style] [font-variant] [font-weight] [font-stretch] font-size[/line-height] font-family
    const fontPattern = /^(?:(italic|oblique|normal)\s+)?(?:(small-caps|normal)\s+)?(?:(normal|bold|bolder|lighter|\d+)\s+)?(?:(normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded)\s+)?(\d+(?:\.\d+)?(?:px|em|rem|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax))(?:\/(\d+(?:\.\d+)?(?:px|em|rem|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax|normal)?\s*))?\s+(.+)$/;

    const match = fontPattern.exec(normalizedValue);
    
    if (!match) {
      // Fallback: try to extract at least font-size and font-family
      const simplePattern = /(\d+(?:\.\d+)?(?:px|em|rem|%|pt|pc|in|cm|mm))\s+(.+)$/;
      const simpleMatch = simplePattern.exec(normalizedValue);
      
      if (simpleMatch) {
        const [, fontSize, fontFamily] = simpleMatch;
        extractedProps['font-size'] = fontSize;
        extractedProps['font-family'] = fontFamily;
        warnings.push('Partial font shorthand parsing - only size and family extracted');
      } else {
        warnings.push(`Unable to parse font shorthand: ${value}`);
      }
    } else {
      const [, fontStyle, fontVariant, fontWeight, fontStretch, fontSize, lineHeight, fontFamily] = match;
      
      if (fontStyle) extractedProps['font-style'] = fontStyle;
      if (fontVariant) extractedProps['font-variant'] = fontVariant;
      if (fontWeight) extractedProps['font-weight'] = fontWeight;
      if (fontStretch) extractedProps['font-stretch'] = fontStretch;
      if (fontSize) extractedProps['font-size'] = fontSize;
      if (lineHeight) extractedProps['line-height'] = lineHeight;
      if (fontFamily) extractedProps['font-family'] = fontFamily;
    }

    return this.createProperty('font', normalizedValue, context, [], warnings, {
      extractedProperties: extractedProps,
      isShorthand: true
    });
  }
}
