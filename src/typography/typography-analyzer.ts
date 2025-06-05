import {
  TypographyEntry,
  TypographyAnalysisResult,
  FontStackAnalysis,
  ConsistencyReport,
  ConsistencyIssue,
  AccessibilityInsights,
  AccessibilityRecommendation,
  ContrastRequirement,
  ResponsivenessReport,
  ResponsiveGap,
  TypographyProperty,
  ExtractionError,
  ExtractionErrorType
} from './types';
import { SourceLocation } from '../parser/ast-nodes';

/**
 * Advanced typography analyzer for consistency and accessibility analysis
 */
export class TypographyAnalyzer {
  private fontSizeValues: number[] = [];
  private lineHeightRatios: number[] = [];
  private fontFamilies: Set<string> = new Set();
  private errors: ExtractionError[] = [];

  /**
   * Perform comprehensive typography analysis
   */
  analyzeTypography(entries: TypographyEntry[]): TypographyAnalysisResult {
    this.reset();
    
    const byProperty = this.groupByProperty(entries);
    const bySelector = this.groupBySelector(entries);
    const byBreakpoint = this.groupByBreakpoint(entries);
    
    const fontStacks = this.analyzeFontStacks(entries);
    const consistency = this.analyzeConsistency(entries);
    const accessibility = this.analyzeAccessibility(entries);
    const responsiveness = this.analyzeResponsiveness(entries);
    
    return {
      summary: this.generateSummary(entries),
      typography: {
        entries,
        fontFaces: [],
        customProperties: []
      },
      byProperty,
      bySelector,
      byBreakpoint,
      fontStacks,
      consistency,
      accessibility,
      responsiveness
    };
  }

  /**
   * Analyze font stacks for consistency and fallbacks
   */
  private analyzeFontStacks(entries: TypographyEntry[]): FontStackAnalysis[] {
    const fontFamilyEntries = entries.filter(e => e.property === 'font-family');
    const fontStackMap = new Map<string, {
      selectors: string[];
      count: number;
      entry: TypographyEntry;
    }>();

    // Group by font family value
    for (const entry of fontFamilyEntries) {
      const key = entry.value.resolved;
      if (!fontStackMap.has(key)) {
        fontStackMap.set(key, {
          selectors: [],
          count: 0,
          entry
        });
      }
      const stack = fontStackMap.get(key)!;
      stack.selectors.push(entry.selector);
      stack.count++;
    }

    const totalUsage = fontFamilyEntries.length;
    const analyses: FontStackAnalysis[] = [];

    for (const [fontValue, data] of fontStackMap) {
      const analysis = this.analyzeFontStack(fontValue, data, totalUsage);
      analyses.push(analysis);
    }

    return analyses.sort((a, b) => b.usage.count - a.usage.count);
  }

  /**
   * Analyze individual font stack
   */
  private analyzeFontStack(
    fontValue: string,
    data: { selectors: string[]; count: number; entry: TypographyEntry },
    totalUsage: number
  ): FontStackAnalysis {
    const fonts = this.parseFontFamily(fontValue);
    const primaryFont = fonts[0] || '';
    const fallbackChain = fonts.slice(1);
    const genericFallback = this.extractGenericFallback(fallbackChain);

    return {
      primaryFont,
      fallbackChain,
      genericFallback,
      usage: {
        selectors: data.selectors,
        count: data.count,
        percentage: Math.round((data.count / totalUsage) * 100)
      },
      isWebFont: this.isWebFont(primaryFont),
      validation: {
        hasGenericFallback: !!genericFallback,
        fallbackCount: fallbackChain.length,
        recommendedFallbacks: this.getRecommendedFallbacks(primaryFont)
      }
    };
  }

  /**
   * Parse font-family value into individual fonts
   */
  private parseFontFamily(value: string): string[] {
    return value
      .split(',')
      .map(font => font.trim().replace(/['"]/g, ''))
      .filter(font => font.length > 0);
  }

  /**
   * Extract generic fallback from font chain
   */
  private extractGenericFallback(
    fonts: string[]
  ): 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy' | undefined {
    const generics = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
    return fonts.find(font => generics.includes(font.toLowerCase())) as any;
  }

  /**
   * Check if font is a web font
   */
  private isWebFont(fontName: string): boolean {
    const systemFonts = [
      'arial', 'helvetica', 'times', 'georgia', 'verdana',
      'courier', 'palatino', 'garamond', 'bookman', 'avant garde'
    ];
    return !systemFonts.includes(fontName.toLowerCase());
  }

  /**
   * Get recommended fallbacks for a font
   */
  private getRecommendedFallbacks(fontName: string): string[] {
    const fontLower = fontName.toLowerCase();
    
    if (fontLower.includes('sans') || this.isSansSerifFont(fontName)) {
      return ['Arial', 'Helvetica', 'sans-serif'];
    }
    
    if (fontLower.includes('serif') || this.isSerifFont(fontName)) {
      return ['Georgia', 'Times', 'serif'];
    }
    
    if (fontLower.includes('mono') || this.isMonospaceFont(fontName)) {
      return ['Courier New', 'monospace'];
    }
    
    return ['Arial', 'sans-serif'];
  }

  /**
   * Check font category helpers
   */
  private isSansSerifFont(fontName: string): boolean {
    const sansSerifFonts = ['arial', 'helvetica', 'verdana', 'calibri', 'trebuchet'];
    return sansSerifFonts.some(font => fontName.toLowerCase().includes(font));
  }

  private isSerifFont(fontName: string): boolean {
    const serifFonts = ['times', 'georgia', 'garamond', 'palatino', 'bookman'];
    return serifFonts.some(font => fontName.toLowerCase().includes(font));
  }

  private isMonospaceFont(fontName: string): boolean {
    const monoFonts = ['courier', 'consolas', 'monaco', 'menlo', 'source code'];
    return monoFonts.some(font => fontName.toLowerCase().includes(font));
  }

  /**
   * Analyze typography consistency
   */
  private analyzeConsistency(entries: TypographyEntry[]): ConsistencyReport {
    const issues: ConsistencyIssue[] = [];
    
    const fontFamilyConsistency = this.analyzeFontFamilyConsistency(entries, issues);
    const fontSizeScale = this.analyzeFontSizeScale(entries, issues);
    const lineHeightConsistency = this.analyzeLineHeightConsistency(entries, issues);

    return {
      fontFamilyConsistency,
      fontSizeScale,
      lineHeightConsistency,
      issues
    };
  }

  /**
   * Analyze font family consistency
   */
  private analyzeFontFamilyConsistency(
    entries: TypographyEntry[],
    issues: ConsistencyIssue[]
  ): number {
    const fontFamilyEntries = entries.filter(e => e.property === 'font-family');
    const uniqueFonts = new Set(fontFamilyEntries.map(e => e.value.resolved));
    
    if (uniqueFonts.size > 5) {
      issues.push({
        type: 'font-family-inconsistency',
        severity: 'warning',
        message: `Too many font families in use (${uniqueFonts.size}). Consider consolidating.`,
        location: fontFamilyEntries[0]?.context.location || { line: 0, column: 0 },
        suggestions: ['Limit to 2-3 font families', 'Create a font family system']
      });
    }

    // Calculate consistency score (inverse of variety)
    const maxReasonableFonts = 3;
    return Math.max(0, 100 - ((uniqueFonts.size - 1) / maxReasonableFonts) * 100);
  }

  /**
   * Analyze font size scale consistency
   */
  private analyzeFontSizeScale(
    entries: TypographyEntry[],
    issues: ConsistencyIssue[]
  ): number {
    const fontSizeEntries = entries.filter(e => e.property === 'font-size');
    const sizes: number[] = [];

    for (const entry of fontSizeEntries) {
      const sizeValue = this.extractNumericValue(entry.value.resolved);
      if (sizeValue !== null) {
        sizes.push(sizeValue);
      }
    }

    if (sizes.length < 2) return 100;

    sizes.sort((a, b) => a - b);
    const ratios: number[] = [];

    for (let i = 1; i < sizes.length; i++) {
      ratios.push(sizes[i] / sizes[i - 1]);
    }

    // Check for consistent scale (like 1.2, 1.414, 1.618)
    const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - avgRatio, 2), 0) / ratios.length;
    
    if (variance > 0.1) {
      issues.push({
        type: 'font-size-scale-inconsistency',
        severity: 'info',
        message: 'Font sizes do not follow a consistent scale',
        location: fontSizeEntries[0]?.context.location || { line: 0, column: 0 },
        suggestions: ['Use a modular scale (1.2x, 1.414x, or 1.618x)', 'Define font size variables']
      });
    }

    return Math.max(0, 100 - (variance * 100));
  }

  /**
   * Analyze line height consistency
   */
  private analyzeLineHeightConsistency(
    entries: TypographyEntry[],
    issues: ConsistencyIssue[]
  ): number {
    const lineHeightEntries = entries.filter(e => e.property === 'line-height');
    const ratios: number[] = [];

    for (const entry of lineHeightEntries) {
      const ratio = this.calculateLineHeightRatio(entry);
      if (ratio !== null) {
        ratios.push(ratio);
      }
    }

    if (ratios.length === 0) return 100;

    const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    
    // Check for accessibility (1.5+ recommended)
    const poorRatios = ratios.filter(ratio => ratio < 1.5);
    if (poorRatios.length > 0) {
      issues.push({
        type: 'line-height-accessibility',
        severity: 'warning',
        message: `${poorRatios.length} elements have line-height below 1.5`,
        location: lineHeightEntries[0]?.context.location || { line: 0, column: 0 },
        suggestions: ['Use line-height of 1.5 or higher for better readability']
      });
    }

    const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - avgRatio, 2), 0) / ratios.length;
    return Math.max(0, 100 - (variance * 50));
  }

  /**
   * Calculate line height ratio
   */
  private calculateLineHeightRatio(entry: TypographyEntry): number | null {
    const value = entry.value.resolved;
    
    // If unitless, it's already a ratio
    if (/^\d*\.?\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // For now, return null for complex cases
    // TODO: Implement proper calculation with font-size context
    return null;
  }

  /**
   * Analyze accessibility
   */
  private analyzeAccessibility(entries: TypographyEntry[]): AccessibilityInsights {
    const recommendations: AccessibilityRecommendation[] = [];
    
    return {
      readability: {
        minimumFontSize: this.analyzeMinimumFontSize(entries, recommendations),
        lineHeightRatio: this.analyzeLineHeightAccessibility(entries, recommendations),
        contrastRequirements: this.getContrastRequirements()
      },
      fontAccessibility: {
        systemFontUsage: this.analyzeSystemFontUsage(entries, recommendations),
        webFontFallbacks: this.analyzeWebFontFallbacks(entries, recommendations),
        dyslexiaFriendlyFonts: this.findDyslexiaFriendlyFonts(entries)
      },
      responsiveAccessibility: {
        scalableUnits: this.analyzeScalableUnits(entries, recommendations),
        fluidTypography: this.analyzeFluidTypography(entries, recommendations),
        zoomSupport: this.analyzeZoomSupport(entries, recommendations)
      },
      recommendations
    };
  }

  /**
   * Analyze minimum font size for accessibility
   */
  private analyzeMinimumFontSize(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): string {
    const fontSizeEntries = entries.filter(e => e.property === 'font-size');
    let minSize = Infinity;

    for (const entry of fontSizeEntries) {
      const sizeValue = this.extractNumericValue(entry.value.resolved);
      if (sizeValue !== null && sizeValue < minSize) {
        minSize = sizeValue;
      }
    }

    if (minSize < 16 && minSize !== Infinity) {
      recommendations.push({
        type: 'minimum-font-size',
        severity: 'warning',
        message: `Minimum font size is ${minSize}px, consider 16px minimum for accessibility`,
        fix: 'Increase small font sizes to at least 16px'
      });
    }

    return minSize === Infinity ? '16px' : `${minSize}px`;
  }

  /**
   * Analyze line height for accessibility
   */
  private analyzeLineHeightAccessibility(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): number {
    const lineHeightEntries = entries.filter(e => e.property === 'line-height');
    const ratios = lineHeightEntries
      .map(entry => this.calculateLineHeightRatio(entry))
      .filter(ratio => ratio !== null) as number[];

    const avgRatio = ratios.length > 0 
      ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length 
      : 1.5;

    if (avgRatio < 1.5) {
      recommendations.push({
        type: 'line-height-accessibility',
        severity: 'error',
        message: 'Average line-height is below accessibility guidelines (1.5)',
        fix: 'Increase line-height to at least 1.5'
      });
    }

    return avgRatio;
  }

  /**
   * Get contrast requirements
   */
  private getContrastRequirements(): ContrastRequirement[] {
    return [
      { level: 'AA', size: 'normal', ratio: 4.5 },
      { level: 'AA', size: 'large', ratio: 3.0 },
      { level: 'AAA', size: 'normal', ratio: 7.0 },
      { level: 'AAA', size: 'large', ratio: 4.5 }
    ];
  }

  /**
   * Analyze system font usage
   */
  private analyzeSystemFontUsage(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): boolean {
    const fontFamilyEntries = entries.filter(e => e.property === 'font-family');
    const hasSystemFonts = fontFamilyEntries.some(entry => 
      entry.value.resolved.includes('system-ui') ||
      entry.value.resolved.includes('-apple-system') ||
      entry.value.resolved.includes('BlinkMacSystemFont')
    );

    if (!hasSystemFonts) {
      recommendations.push({
        type: 'system-font-usage',
        severity: 'info',
        message: 'Consider using system fonts for better accessibility',
        fix: 'Add system-ui, -apple-system, BlinkMacSystemFont to font stacks'
      });
    }

    return hasSystemFonts;
  }
  /**
   * Analyze web font fallbacks
   */
  private analyzeWebFontFallbacks(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): boolean {
    const fontFamilyEntries = entries.filter(e => e.property === 'font-family');
    
    // Check if any entries are from @font-face declarations (empty selector indicates @font-face context)
    const hasFontFaceDeclarations = fontFamilyEntries.some(entry => entry.selector === '');
    
    // If we have @font-face declarations, consider web font fallbacks as properly handled
    if (hasFontFaceDeclarations) {
      return true;
    }
    
    let hasProperFallbacks = true;

    for (const entry of fontFamilyEntries) {
      const fonts = this.parseFontFamily(entry.value.resolved);
      if (fonts.length === 1 && this.isWebFont(fonts[0])) {
        hasProperFallbacks = false;
        recommendations.push({
          type: 'web-font-fallback',
          severity: 'warning',
          message: `Web font "${fonts[0]}" lacks fallbacks`,
          fix: 'Add system font fallbacks to web font declarations'
        });
      }
    }

    return hasProperFallbacks;
  }

  /**
   * Find dyslexia-friendly fonts
   */
  private findDyslexiaFriendlyFonts(entries: TypographyEntry[]): string[] {
    const dyslexiaFriendlyFonts = [
      'OpenDyslexic', 'Dyslexie', 'Sylexiad', 'Comic Sans MS',
      'Arial', 'Helvetica', 'Verdana', 'Century Gothic'
    ];

    const fontFamilyEntries = entries.filter(e => e.property === 'font-family');
    const foundFonts: string[] = [];

    for (const entry of fontFamilyEntries) {
      const fonts = this.parseFontFamily(entry.value.resolved);
      for (const font of fonts) {
        if (dyslexiaFriendlyFonts.some(df => 
          font.toLowerCase().includes(df.toLowerCase())
        )) {
          foundFonts.push(font);
        }
      }
    }

    return [...new Set(foundFonts)];
  }

  /**
   * Analyze scalable units usage
   */
  private analyzeScalableUnits(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): boolean {
    const fontSizeEntries = entries.filter(e => e.property === 'font-size');
    const scalableUnits = ['rem', 'em', '%', 'vw', 'vh'];
    
    const scalableCount = fontSizeEntries.filter(entry =>
      scalableUnits.some(unit => entry.value.resolved.includes(unit))
    ).length;

    const scalablePercentage = fontSizeEntries.length > 0 
      ? (scalableCount / fontSizeEntries.length) * 100 
      : 0;

    if (scalablePercentage < 50) {
      recommendations.push({
        type: 'scalable-units',
        severity: 'info',
        message: 'Consider using more scalable units (rem, em) for better accessibility',
        fix: 'Replace px units with rem or em where appropriate'
      });
    }

    return scalablePercentage >= 50;
  }

  /**
   * Analyze fluid typography usage
   */
  private analyzeFluidTypography(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): boolean {
    const hasFluid = entries.some(entry =>
      entry.value.resolved.includes('clamp(') ||
      entry.value.resolved.includes('min(') ||
      entry.value.resolved.includes('max(') ||
      entry.value.resolved.includes('vw') ||
      entry.value.resolved.includes('vh')
    );

    if (!hasFluid) {
      recommendations.push({
        type: 'fluid-typography',
        severity: 'info',
        message: 'Consider implementing fluid typography for better responsive design',
        fix: 'Use clamp(), vw units, or CSS calc() for responsive typography'
      });
    }

    return hasFluid;
  }

  /**
   * Analyze zoom support
   */
  private analyzeZoomSupport(
    entries: TypographyEntry[],
    recommendations: AccessibilityRecommendation[]
  ): boolean {
    // Check for relative units that support zoom
    const relativeUnits = ['rem', 'em', '%'];
    const supportiveEntries = entries.filter(entry =>
      relativeUnits.some(unit => entry.value.resolved.includes(unit))
    );

    const zoomSupport = entries.length > 0 
      ? (supportiveEntries.length / entries.length) >= 0.7 
      : false;

    if (!zoomSupport) {
      recommendations.push({
        type: 'zoom-support',
        severity: 'warning',
        message: 'Typography may not scale properly with browser zoom',
        fix: 'Use relative units (rem, em) instead of fixed units (px)'
      });
    }

    return zoomSupport;
  }
  /**
   * Analyze responsive typography patterns
   */
  analyzeResponsiveness(entries: TypographyEntry[]): ResponsivenessReport {
    const responsiveEntries = entries.filter(e => e.metadata.isResponsive);
    const gaps: ResponsiveGap[] = [];
    
    const propertyBreakpoints = this.groupByPropertyAndBreakpoint(responsiveEntries);
    
    // Check for missing responsive coverage
    for (const [property, breakpointMap] of propertyBreakpoints) {
      const breakpoints = Array.from(breakpointMap.keys()).sort();
      const commonBreakpoints = ['mobile', 'tablet', 'desktop'];
      const missingBreakpoints = commonBreakpoints.filter(bp => !breakpoints.includes(bp));
      
      if (missingBreakpoints.length > 0) {
        gaps.push({
          property: property as TypographyProperty,
          missingBreakpoints,
          recommendation: `Consider adding responsive values for ${property} at ${missingBreakpoints.join(', ')} breakpoints`
        });
      }
    }
    
    const breakpointCoverage = this.calculateResponsiveCoverage(entries);
    const fluidTypographyUsage = this.detectFluidTypography(entries);
    const responsiveProperties = responsiveEntries.map(e => e.property);
    
    return {
      breakpointCoverage,
      fluidTypographyUsage,
      responsiveProperties,
      gaps
    };
  }

  /**
   * Group entries by property and breakpoint
   */
  private groupByPropertyAndBreakpoint(entries: TypographyEntry[]): Map<string, Map<string, TypographyEntry[]>> {
    const propertyBreakpoints = new Map<string, Map<string, TypographyEntry[]>>();
    
    for (const entry of entries) {
      const property = entry.property;
      const breakpoint = entry.context.mediaQuery?.breakpoint.type || 'base';
      
      if (!propertyBreakpoints.has(property)) {
        propertyBreakpoints.set(property, new Map());
      }
      
      const breakpointMap = propertyBreakpoints.get(property)!;
      if (!breakpointMap.has(breakpoint)) {
        breakpointMap.set(breakpoint, []);
      }
      
      breakpointMap.get(breakpoint)!.push(entry);
    }
    
    return propertyBreakpoints;
  }

  /**
   * Calculate responsive coverage percentage
   */
  private calculateResponsiveCoverage(entries: TypographyEntry[]): number {
    const totalProperties = entries.length;
    const responsiveProperties = entries.filter(e => e.metadata.isResponsive).length;
    
    return totalProperties > 0 ? (responsiveProperties / totalProperties) * 100 : 0;
  }

  /**
   * Detect fluid typography usage
   */
  private detectFluidTypography(entries: TypographyEntry[]): number {
    const fluidEntries = entries.filter(entry => {
      const value = entry.value.resolved;
      return /clamp\(|min\(|max\(|calc\(.*vw/.test(value);
    });
    
    return entries.length > 0 ? (fluidEntries.length / entries.length) * 100 : 0;
  }

  /**
   * Analyze breakpoint consistency
   */
  private analyzeBreakpointConsistency(entries: TypographyEntry[]): number {
    const breakpoints = new Set<string>();
    
    for (const entry of entries) {
      if (entry.context.mediaQuery) {
        breakpoints.add(entry.context.mediaQuery.breakpoint.type);
      }
    }
    
    // Score based on standard breakpoint usage
    const standardBreakpoints = ['mobile', 'tablet', 'desktop'];
    const matchCount = standardBreakpoints.filter(bp => breakpoints.has(bp)).length;
    
    return (matchCount / standardBreakpoints.length) * 100;
  }

  /**
   * Helper methods
   */
  private groupByProperty(entries: TypographyEntry[]): Map<TypographyProperty, TypographyEntry[]> {
    const map = new Map<TypographyProperty, TypographyEntry[]>();
    for (const entry of entries) {
      if (!map.has(entry.property)) {
        map.set(entry.property, []);
      }
      map.get(entry.property)!.push(entry);
    }
    return map;
  }

  private groupBySelector(entries: TypographyEntry[]): Map<string, TypographyEntry[]> {
    const map = new Map<string, TypographyEntry[]>();
    for (const entry of entries) {
      if (!map.has(entry.selector)) {
        map.set(entry.selector, []);
      }
      map.get(entry.selector)!.push(entry);
    }
    return map;
  }

  private groupByBreakpoint(entries: TypographyEntry[]): Map<string, TypographyEntry[]> {
    const map = new Map<string, TypographyEntry[]>();
    for (const entry of entries) {
      const breakpoint = entry.context.mediaQuery?.breakpoint.value || 'base';
      if (!map.has(breakpoint)) {
        map.set(breakpoint, []);
      }
      map.get(breakpoint)!.push(entry);
    }
    return map;
  }

  private generateSummary(entries: TypographyEntry[]) {
    const uniqueFonts = new Set(
      entries
        .filter(e => e.property === 'font-family')
        .map(e => e.value.resolved)
    ).size;

    const responsiveProperties = entries.filter(e => e.metadata.isResponsive).length;
    const customProperties = entries.filter(e => e.property.startsWith('--')).length;

    return {
      totalProperties: entries.length,
      uniqueFonts,
      responsiveProperties,
      customProperties,
      fontFaceDeclarations: 0 // TODO: Count from fontFaces array
    };
  }

  private extractNumericValue(value: string): number | null {
    const match = value.match(/^(\d*\.?\d+)/);
    return match ? parseFloat(match[1]) : null;
  }

  private reset(): void {
    this.fontSizeValues = [];
    this.lineHeightRatios = [];
    this.fontFamilies.clear();
    this.errors = [];
  }
}
