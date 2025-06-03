
import {
  MediaQueryContext,
  MediaCondition,
  BreakpointCascade,
  ViewportSize,
  TypographyEntry,
  ResponsiveTypographyMap,
  TypographyProperties,
  TypographyCascade
} from './types';

/**
 * Media query analyzer for responsive typography
 */
export class MediaQueryAnalyzer {

  /**
   * Parse media query string into context object
   */
  public parseMediaQuery(mediaQueryString: string): MediaQueryContext | null {
    try {
      const trimmed = mediaQueryString.trim();
      if (!trimmed) {
        return null;
      }

      const conditions = this.parseMediaConditions(trimmed);
      const breakpoint = this.extractBreakpoint(conditions);
      
      if (!breakpoint) {
        return null;
      }

      return {
        breakpoint,
        conditions,
        typographyOverrides: [],
        specificity: this.calculateMediaQuerySpecificity(conditions),
        order: 0 // Will be set by the caller based on order in stylesheet
      };

    } catch (error) {
      console.warn(`Failed to parse media query: ${mediaQueryString}`, error);
      return null;
    }
  }

  /**
   * Parse media conditions from query string
   */
  private parseMediaConditions(queryString: string): MediaCondition[] {
    const conditions: MediaCondition[] = [];
    
    // Remove 'screen and' or similar media types
    let cleanQuery = queryString.replace(/^\s*(screen|print|all)\s+(and\s+)?/i, '');
    
    // Split by 'and' to get individual conditions
    const conditionStrings = cleanQuery.split(/\s+and\s+/i);
    
    for (const condStr of conditionStrings) {
      const condition = this.parseCondition(condStr.trim());
      if (condition) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  /**
   * Parse individual media condition
   */
  private parseCondition(conditionString: string): MediaCondition | null {
    // Remove parentheses if present
    const cleaned = conditionString.replace(/^\(|\)$/g, '');
    
    // Handle min-width, max-width, width conditions
    const widthMatch = cleaned.match(/^(min-width|max-width|width)\s*:\s*(.+)$/);
    if (widthMatch) {
      return {
        feature: widthMatch[1],
        operator: ':',
        value: widthMatch[2].trim()
      };
    }

    // Handle other conditions (orientation, resolution, etc.)
    const generalMatch = cleaned.match(/^([a-z-]+)\s*:\s*(.+)$/);
    if (generalMatch) {
      return {
        feature: generalMatch[1],
        operator: ':',
        value: generalMatch[2].trim()
      };
    }

    // Handle feature-only conditions (like 'hover')
    if (/^[a-z-]+$/.test(cleaned)) {
      return {
        feature: cleaned,
        operator: undefined,
        value: undefined
      };
    }

    return null;
  }

  /**
   * Extract breakpoint information from conditions
   */
  private extractBreakpoint(conditions: MediaCondition[]): MediaQueryContext['breakpoint'] | null {
    for (const condition of conditions) {
      if (condition.feature === 'min-width' || condition.feature === 'max-width') {
        const value = condition.value;
        if (!value) continue;

        const { numericValue, unit } = this.parseValueWithUnit(value);
        
        return {
          type: condition.feature === 'min-width' ? 'min-width' : 'max-width',
          value,
          unit: unit as 'px' | 'em' | 'rem' | 'vw',
          numericValue
        };
      }
    }

    // Check for width ranges
    const minWidth = conditions.find(c => c.feature === 'min-width');
    const maxWidth = conditions.find(c => c.feature === 'max-width');
    
    if (minWidth && maxWidth) {
      const minValue = this.parseValueWithUnit(minWidth.value || '0');
      const maxValue = this.parseValueWithUnit(maxWidth.value || '0');
      
      return {
        type: 'range',
        value: `${minWidth.value} - ${maxWidth.value}`,
        unit: minValue.unit as 'px' | 'em' | 'rem' | 'vw',
        numericValue: minValue.numericValue
      };
    }

    return null;
  }

  /**
   * Parse value with unit (e.g., "768px" -> {numericValue: 768, unit: "px"})
   */
  private parseValueWithUnit(value: string): { numericValue: number; unit: string } {
    const match = value.trim().match(/^(-?\d*\.?\d+)(.*)$/);
    if (match) {
      return {
        numericValue: parseFloat(match[1]),
        unit: match[2].trim() || 'px'
      };
    }
    return { numericValue: 0, unit: 'px' };
  }

  /**
   * Calculate media query specificity
   */
  private calculateMediaQuerySpecificity(conditions: MediaCondition[]): number {
    // Basic specificity calculation for media queries
    // More conditions = higher specificity
    let specificity = conditions.length;
    
    // Add weight for specific features
    for (const condition of conditions) {
      switch (condition.feature) {
        case 'min-width':
        case 'max-width':
          specificity += 10;
          break;
        case 'orientation':
          specificity += 5;
          break;
        case 'resolution':
          specificity += 3;
          break;
        default:
          specificity += 1;
          break;
      }
    }

    return specificity;
  }

  /**
   * Build cascade order for breakpoints
   */
  public buildCascade(mediaQueries: MediaQueryContext[]): BreakpointCascade {
    // Sort by order first, then by specificity
    const orderedBySpecificity = [...mediaQueries].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return b.specificity - a.specificity;
    });

    return {
      breakpoints: mediaQueries,
      orderedBySpecificity
    };
  }

  /**
   * Aggregate responsive typography entries
   */
  public aggregateResponsiveTypography(entries: TypographyEntry[]): ResponsiveTypographyMap {
    const base: TypographyProperties = {};
    const breakpoints = new Map<string, TypographyProperties>();
    const cascade: TypographyCascade[] = [];

    // Separate base and responsive entries
    const baseEntries = entries.filter(e => !e.metadata.isResponsive);
    const responsiveEntries = entries.filter(e => e.metadata.isResponsive);

    // Build base properties
    for (const entry of baseEntries) {
      base[entry.property] = entry.value.resolved;
    }

    // Group responsive entries by breakpoint
    const breakpointGroups = new Map<string, TypographyEntry[]>();
    
    for (const entry of responsiveEntries) {
      if (entry.context.mediaQuery) {
        const breakpointKey = this.getBreakpointKey(entry.context.mediaQuery);
        if (!breakpointGroups.has(breakpointKey)) {
          breakpointGroups.set(breakpointKey, []);
        }
        breakpointGroups.get(breakpointKey)!.push(entry);
      }
    }

    // Build breakpoint properties and cascade
    for (const [breakpointKey, breakpointEntries] of breakpointGroups) {
      const properties: TypographyProperties = {};
      
      for (const entry of breakpointEntries) {
        properties[entry.property] = entry.value.resolved;
      }
      
      breakpoints.set(breakpointKey, properties);
      
      // Add to cascade
      if (breakpointEntries.length > 0 && breakpointEntries[0].context.mediaQuery) {
        const mediaQuery = breakpointEntries[0].context.mediaQuery;
        cascade.push({
          mediaQuery: this.buildMediaQueryString(mediaQuery),
          properties,
          specificity: mediaQuery.specificity,
          order: mediaQuery.order
        });
      }
    }

    // Sort cascade by specificity and order
    cascade.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return b.specificity - a.specificity;
    });

    return {
      base,
      breakpoints,
      cascade
    };
  }

  /**
   * Compute effective styles for a specific viewport
   */
  public computeEffectiveStyles(
    viewport: ViewportSize,
    responsiveMap: ResponsiveTypographyMap
  ): TypographyProperties {
    const effective: TypographyProperties = { ...responsiveMap.base };

    // Apply cascade rules that match the viewport
    for (const cascadeEntry of responsiveMap.cascade) {
      if (this.matchesViewport(cascadeEntry.mediaQuery, viewport)) {
        Object.assign(effective, cascadeEntry.properties);
      }
    }

    return effective;
  }

  /**
   * Check if media query matches viewport
   */
  private matchesViewport(mediaQuery: string, viewport: ViewportSize): boolean {
    // Simplified viewport matching
    // In a real implementation, this would be more sophisticated
    
    const widthPx = this.convertToPx(viewport.width, viewport.unit);
    
    // Check for min-width
    const minWidthMatch = mediaQuery.match(/min-width:\s*(\d+)(px|em|rem)/);
    if (minWidthMatch) {
      const minWidth = parseInt(minWidthMatch[1]);
      const unit = minWidthMatch[2];
      const minWidthPx = this.convertToPx(minWidth, unit as any);
      
      if (widthPx < minWidthPx) {
        return false;
      }
    }

    // Check for max-width
    const maxWidthMatch = mediaQuery.match(/max-width:\s*(\d+)(px|em|rem)/);
    if (maxWidthMatch) {
      const maxWidth = parseInt(maxWidthMatch[1]);
      const unit = maxWidthMatch[2];
      const maxWidthPx = this.convertToPx(maxWidth, unit as any);
      
      if (widthPx > maxWidthPx) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert value to pixels for comparison
   */
  private convertToPx(value: number, unit: string): number {
    switch (unit) {
      case 'em':
      case 'rem':
        return value * 16; // Assume 16px base font size
      case 'vw':
        return value * 19.2; // Assume 1920px viewport width
      case 'vh':
        return value * 10.8; // Assume 1080px viewport height
      case 'px':
      default:
        return value;
    }
  }

  /**
   * Build media query string from context
   */
  private buildMediaQueryString(context: MediaQueryContext): string {
    const conditions = context.conditions.map(condition => {
      if (condition.operator && condition.value) {
        return `(${condition.feature}${condition.operator} ${condition.value})`;
      } else {
        return `(${condition.feature})`;
      }
    });

    return conditions.join(' and ');
  }

  /**
   * Get breakpoint key from media query context
   */
  private getBreakpointKey(context: MediaQueryContext): string {
    return `${context.breakpoint.type}:${context.breakpoint.value}`;
  }
}
