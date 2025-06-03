
import { SCSSNode, AtRuleNode, DeclarationNode } from '../parser/ast-nodes';
import { FontFaceDeclaration, FontSource } from './types';

/**
 * Font face processor for extracting @font-face declarations
 */
export class FontFaceProcessor {

  /**
   * Extract all @font-face declarations from AST
   */
  public extractFontFaces(ast: SCSSNode): FontFaceDeclaration[] {
    const fontFaces: FontFaceDeclaration[] = [];

    ast.walkChildren((node) => {
      if (node.type === 'atrule') {
        const atRuleNode = node as AtRuleNode;
        if (atRuleNode.name === 'font-face') {
          const fontFace = this.processFontFaceRule(atRuleNode);
          if (fontFace) {
            fontFaces.push(fontFace);
          }
        }
      }
    });

    return fontFaces;
  }

  /**
   * Process a single @font-face rule
   */
  private processFontFaceRule(atRuleNode: AtRuleNode): FontFaceDeclaration | null {
    try {
      let fontFamily = '';
      const sources: FontSource[] = [];
      const descriptors: FontFaceDeclaration['descriptors'] = {};
      const loading = {
        strategy: 'auto',
        priority: 0
      };

      // Process declarations within @font-face
      for (const child of atRuleNode.children) {
        if (child.type === 'declaration') {
          const declNode = child as DeclarationNode;
          
          switch (declNode.property) {
            case 'font-family':
              fontFamily = this.cleanFontFamilyValue(declNode.value);
              break;
              
            case 'src':
              sources.push(...this.parseFontSources(declNode.value));
              break;
              
            case 'font-weight':
              descriptors.weight = declNode.value;
              break;
              
            case 'font-style':
              descriptors.style = declNode.value;
              break;
              
            case 'font-stretch':
              descriptors.stretch = declNode.value;
              break;
              
            case 'unicode-range':
              descriptors.unicodeRange = this.parseUnicodeRange(declNode.value);
              break;
              
            case 'font-feature-settings':
              descriptors.featureSettings = declNode.value;
              break;
              
            case 'font-variation-settings':
              descriptors.variationSettings = declNode.value;
              break;
              
            case 'font-display':
              descriptors.display = declNode.value as any;
              break;
          }
        }
      }

      // Validate required properties
      if (!fontFamily || sources.length === 0) {
        console.warn('Invalid @font-face declaration: missing font-family or src');
        return null;
      }

      return {
        fontFamily,
        sources,
        descriptors,
        loading,
        location: atRuleNode.location
      };

    } catch (error) {
      console.warn('Error processing @font-face rule:', error);
      return null;
    }
  }

  /**
   * Parse font sources from src declaration
   */
  private parseFontSources(srcValue: string): FontSource[] {
    const sources: FontSource[] = [];
    
    // Split by comma to handle multiple sources
    const sourceStrings = srcValue.split(',');
    
    for (const sourceStr of sourceStrings) {
      const trimmed = sourceStr.trim();
      
      // Handle local() sources
      const localMatch = trimmed.match(/local\(\s*['"]?([^'"()]+)['"]?\s*\)/);
      if (localMatch) {
        sources.push({
          url: localMatch[1],
          isLocal: true
        });
        continue;
      }

      // Handle url() sources
      const urlMatch = trimmed.match(/url\(\s*['"]?([^'"()]+)['"]?\s*\)(?:\s+format\(\s*['"]?([^'"()]+)['"]?\s*\))?(?:\s+tech\(\s*([^)]+)\s*\))?/);
      if (urlMatch) {
        const source: FontSource = {
          url: urlMatch[1],
          isLocal: false
        };

        if (urlMatch[2]) {
          source.format = urlMatch[2];
        }

        if (urlMatch[3]) {
          source.tech = urlMatch[3].split(/\s+/).map(t => t.replace(/['"]?/g, ''));
        }

        sources.push(source);
      }
    }

    return sources;
  }

  /**
   * Clean font family value (remove quotes, etc.)
   */
  private cleanFontFamilyValue(value: string): string {
    return value
      .trim()
      .replace(/^['"]|['"]$/g, '') // Remove surrounding quotes
      .trim();
  }

  /**
   * Parse unicode range values
   */
  private parseUnicodeRange(value: string): string[] {
    return value
      .split(',')
      .map(range => range.trim())
      .filter(range => range.length > 0);
  }

  /**
   * Validate font face declaration
   */
  public validateFontFace(fontFace: FontFaceDeclaration): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check required properties
    if (!fontFace.fontFamily) {
      issues.push('Missing font-family declaration');
    }

    if (fontFace.sources.length === 0) {
      issues.push('Missing src declaration');
    }

    // Check for font-display
    if (!fontFace.descriptors.display) {
      recommendations.push('Consider adding font-display descriptor for better loading performance');
    } else if (fontFace.descriptors.display === 'auto') {
      recommendations.push('Consider using font-display: swap for better user experience');
    }

    // Check for fallbacks
    const hasLocal = fontFace.sources.some(src => src.isLocal);
    if (!hasLocal) {
      recommendations.push('Consider adding local() sources as fallbacks');
    }

    // Check for modern formats
    const hasWoff2 = fontFace.sources.some(src => src.format === 'woff2');
    if (!hasWoff2) {
      recommendations.push('Consider adding WOFF2 format for better compression');
    }

    // Check for multiple weights/styles in single declaration
    if (Array.isArray(fontFace.descriptors.weight)) {
      recommendations.push('Multiple font weights in single @font-face may impact performance');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get font loading strategy recommendations
   */
  public getLoadingRecommendations(fontFace: FontFaceDeclaration): {
    strategy: string;
    priority: number;
    reasoning: string;
  } {
    let strategy = 'auto';
    let priority = 0;
    let reasoning = '';

    // Determine loading strategy based on usage patterns
    const isDisplayFont = this.isDisplayFont(fontFace.fontFamily);
    const isSystemFontFallback = this.hasSystemFontFallback(fontFace);

    if (isDisplayFont) {
      strategy = 'optional';
      priority = 1;
      reasoning = 'Display fonts should use optional loading to avoid layout shifts';
    } else if (fontFace.descriptors.display === 'swap') {
      strategy = 'swap';
      priority = 2;
      reasoning = 'Font uses swap display, prioritize loading';
    } else if (isSystemFontFallback) {
      strategy = 'fallback';
      priority = 1;
      reasoning = 'Has system font fallback, can use fallback strategy';
    } else {
      strategy = 'block';
      priority = 3;
      reasoning = 'Critical font without fallback, needs blocking load';
    }

    return { strategy, priority, reasoning };
  }

  /**
   * Check if font is likely a display/decorative font
   */
  private isDisplayFont(fontFamily: string): boolean {
    const displayIndicators = [
      'display', 'decorative', 'script', 'handwriting',
      'banner', 'headline', 'title'
    ];
    
    const lowerFamily = fontFamily.toLowerCase();
    return displayIndicators.some(indicator => lowerFamily.includes(indicator));
  }

  /**
   * Check if font has system font fallbacks
   */
  private hasSystemFontFallback(fontFace: FontFaceDeclaration): boolean {
    // This would need to be enhanced to check the actual CSS rules
    // where this font is used to see if it has system font fallbacks
    return fontFace.sources.some(src => src.isLocal);
  }
}
