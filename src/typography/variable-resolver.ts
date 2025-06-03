
import {
  VariableResolutionContext,
  ResolvedValue,
  ComputedValue,
  CalcAST,
  EvaluationContext,
  UnitConversionContext,
  ExtractionError,
  ExtractionErrorType
} from './types';

/**
 * Variable resolver for SCSS variables and CSS custom properties
 */
export class VariableResolver {
  private resolving = new Set<string>(); // For circular dependency detection

  /**
   * Resolve a value that may contain variables or functions
   */
  public async resolve(
    value: string,
    context: VariableResolutionContext
  ): Promise<ResolvedValue> {
    const dependencies: string[] = [];
    let resolved = value;
    let confidence: 'exact' | 'approximate' | 'unknown' = 'exact';

    try {
      // Resolve SCSS variables
      resolved = await this.resolveSCSSVariables(resolved, context, dependencies);
      
      // Resolve CSS custom properties
      resolved = await this.resolveCustomProperties(resolved, context, dependencies);
      
      return {
        original: value,
        resolved,
        dependencies,
        confidence
      };

    } catch (error) {
      return {
        original: value,
        resolved: value, // Return original on error
        dependencies,
        confidence: 'unknown'
      };
    }
  }

  /**
   * Resolve SCSS variables in a value
   */
  private async resolveSCSSVariables(
    value: string,
    context: VariableResolutionContext,
    dependencies: string[]
  ): Promise<string> {
    const variablePattern = /\$([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
    let resolved = value;
    let match;

    while ((match = variablePattern.exec(value)) !== null) {
      const varName = `$${match[1]}`;
      
      // Check for circular dependencies
      if (this.resolving.has(varName)) {
        throw new Error(`Circular dependency detected for variable ${varName}`);
      }

      const varValue = await this.resolveSCSSVariable(varName, context);
      if (varValue !== null) {
        dependencies.push(varName);
        resolved = resolved.replace(match[0], varValue);
      }
    }

    return resolved;
  }

  /**
   * Resolve a single SCSS variable
   */
  private async resolveSCSSVariable(
    varName: string,
    context: VariableResolutionContext
  ): Promise<string | null> {
    // Check current scope first
    const currentScopeVar = context.currentScope.variables.get(varName);
    if (currentScopeVar) {
      return currentScopeVar;
    }

    // Check global scope
    const globalVar = context.scssVariables.get(varName);
    if (globalVar) {
      this.resolving.add(varName);
      try {
        // Recursively resolve if the variable value contains other variables
        const resolved = await this.resolve(globalVar.value, context);
        return resolved.resolved;
      } finally {
        this.resolving.delete(varName);
      }
    }

    // Check imported variables
    const importedVar = context.importedVariables.get(varName);
    if (importedVar) {
      return importedVar.value;
    }

    return null;
  }

  /**
   * Resolve CSS custom properties
   */
  private async resolveCustomProperties(
    value: string,
    context: VariableResolutionContext,
    dependencies: string[]
  ): Promise<string> {
    const customPropPattern = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\s*\)/g;
    let resolved = value;
    let match;

    while ((match = customPropPattern.exec(value)) !== null) {
      const propName = match[1];
      const fallback = match[2];
      
      const propValue = this.resolveCustomProperty(propName, context, fallback);
      if (propValue) {
        dependencies.push(propName);
        resolved = resolved.replace(match[0], propValue);
      }
    }

    return resolved;
  }

  /**
   * Resolve a single CSS custom property
   */
  private resolveCustomProperty(
    propertyName: string,
    context: VariableResolutionContext,
    fallback?: string
  ): string {
    const customProp = context.customProperties.get(propertyName);
    if (customProp) {
      return customProp.value;
    }

    // Return fallback if provided
    if (fallback) {
      return fallback.trim();
    }

    // Return the var() expression if we can't resolve it
    return `var(${propertyName})`;
  }

  /**
   * Evaluate mathematical expressions (calc, clamp, etc.)
   */
  public async evaluateExpression(
    expression: string,
    context: VariableResolutionContext
  ): Promise<ComputedValue> {
    try {
      // Handle calc() function
      const calcMatch = expression.match(/calc\(([^)]+)\)/);
      if (calcMatch) {
        return this.evaluateCalc(calcMatch[1], context);
      }

      // Handle clamp() function
      const clampMatch = expression.match(/clamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
      if (clampMatch) {
        return this.evaluateClamp(clampMatch[1], clampMatch[2], clampMatch[3], context);
      }

      // Handle min() function
      const minMatch = expression.match(/min\(([^)]+)\)/);
      if (minMatch) {
        return this.evaluateMinMax('min', minMatch[1], context);
      }

      // Handle max() function
      const maxMatch = expression.match(/max\(([^)]+)\)/);
      if (maxMatch) {
        return this.evaluateMinMax('max', maxMatch[1], context);
      }

      // If no function found, try to parse as simple value
      return this.parseSimpleValue(expression);

    } catch (error) {
      return {
        value: 0,
        unit: '',
        expression,
        confidence: 'unknown'
      };
    }
  }

  /**
   * Evaluate calc() expression
   */
  private evaluateCalc(
    calcExpression: string,
    context: VariableResolutionContext
  ): ComputedValue {
    try {
      const ast = this.parseCalcExpression(calcExpression);
      const evaluationContext: EvaluationContext = {
        variables: new Map(),
        functions: new Map(),
        unitContext: {
          baseFontSize: 16,
          viewportWidth: 1920,
          viewportHeight: 1080,
          dpi: 96
        }
      };

      const result = this.evaluateCalcAST(ast, evaluationContext);
      
      return {
        value: result.value,
        unit: result.unit,
        expression: `calc(${calcExpression})`,
        confidence: result.confidence
      };

    } catch (error) {
      return {
        value: 0,
        unit: '',
        expression: `calc(${calcExpression})`,
        confidence: 'unknown'
      };
    }
  }

  /**
   * Parse calc expression into AST
   */
  private parseCalcExpression(expression: string): CalcAST {
    // Simplified calc parser - would need more sophisticated parsing for production
    const trimmed = expression.trim();
    
    // Handle simple binary operations
    const operators = ['+', '-', '*', '/'];
    for (const op of operators) {
      const parts = trimmed.split(op);
      if (parts.length === 2) {
        return {
          type: 'binary',
          operator: op as any,
          left: this.parseCalcExpression(parts[0].trim()),
          right: this.parseCalcExpression(parts[1].trim())
        };
      }
    }

    // Handle values with units
    const valueMatch = trimmed.match(/^(-?\d*\.?\d+)(.*)$/);
    if (valueMatch) {
      return {
        type: 'value',
        value: parseFloat(valueMatch[1]),
        unit: valueMatch[2].trim()
      };
    }

    // Fallback
    return {
      type: 'value',
      value: 0,
      unit: ''
    };
  }

  /**
   * Evaluate calc AST
   */
  private evaluateCalcAST(
    ast: CalcAST,
    context: EvaluationContext
  ): { value: number; unit: string; confidence: 'exact' | 'approximate' | 'unknown' } {
    switch (ast.type) {
      case 'value':
        return {
          value: ast.value as number,
          unit: ast.unit || '',
          confidence: 'exact'
        };

      case 'binary':
        const left = this.evaluateCalcAST(ast.left!, context);
        const right = this.evaluateCalcAST(ast.right!, context);

        // Handle unit conversions and calculations
        switch (ast.operator) {
          case '+':
          case '-':
            // Addition/subtraction requires compatible units
            if (left.unit === right.unit) {
              const value = ast.operator === '+' 
                ? left.value + right.value 
                : left.value - right.value;
              return { value, unit: left.unit, confidence: 'exact' };
            } else {
              // Try to convert units
              const converted = this.convertUnits(right.value, right.unit, left.unit, context.unitContext);
              if (converted !== null) {
                const value = ast.operator === '+' 
                  ? left.value + converted 
                  : left.value - converted;
                return { value, unit: left.unit, confidence: 'approximate' };
              }
            }
            break;

          case '*':
            // Multiplication - one operand should be unitless
            if (!left.unit) {
              return { value: left.value * right.value, unit: right.unit, confidence: 'exact' };
            } else if (!right.unit) {
              return { value: left.value * right.value, unit: left.unit, confidence: 'exact' };
            }
            break;

          case '/':
            // Division
            if (!right.unit) {
              return { value: left.value / right.value, unit: left.unit, confidence: 'exact' };
            } else if (left.unit === right.unit) {
              return { value: left.value / right.value, unit: '', confidence: 'exact' };
            }
            break;
        }

        return { value: 0, unit: '', confidence: 'unknown' };

      default:
        return { value: 0, unit: '', confidence: 'unknown' };
    }
  }

  /**
   * Evaluate clamp() function
   */
  private evaluateClamp(
    min: string,
    val: string,
    max: string,
    context: VariableResolutionContext
  ): ComputedValue {
    try {
      const minValue = this.parseSimpleValue(min.trim());
      const valValue = this.parseSimpleValue(val.trim());
      const maxValue = this.parseSimpleValue(max.trim());

      // For clamp, we'll return the preferred value with a note
      return {
        value: valValue.value,
        unit: valValue.unit,
        expression: `clamp(${min}, ${val}, ${max})`,
        confidence: 'approximate'
      };

    } catch (error) {
      return {
        value: 0,
        unit: '',
        expression: `clamp(${min}, ${val}, ${max})`,
        confidence: 'unknown'
      };
    }
  }

  /**
   * Evaluate min/max functions
   */
  private evaluateMinMax(
    func: 'min' | 'max',
    args: string,
    context: VariableResolutionContext
  ): ComputedValue {
    try {
      const values = args.split(',').map(arg => this.parseSimpleValue(arg.trim()));
      
      if (values.length === 0) {
        throw new Error('No arguments provided to min/max function');
      }

      // Find min or max value (simplified - assumes same units)
      const result = func === 'min' 
        ? values.reduce((min, curr) => curr.value < min.value ? curr : min)
        : values.reduce((max, curr) => curr.value > max.value ? curr : max);

      return {
        value: result.value,
        unit: result.unit,
        expression: `${func}(${args})`,
        confidence: 'approximate'
      };

    } catch (error) {
      return {
        value: 0,
        unit: '',
        expression: `${func}(${args})`,
        confidence: 'unknown'
      };
    }
  }

  /**
   * Parse simple value with unit
   */
  private parseSimpleValue(value: string): ComputedValue {
    const match = value.trim().match(/^(-?\d*\.?\d+)(.*)$/);
    if (match) {
      return {
        value: parseFloat(match[1]),
        unit: match[2].trim(),
        expression: value,
        confidence: 'exact'
      };
    }

    throw new Error(`Cannot parse value: ${value}`);
  }

  /**
   * Convert between CSS units
   */
  private convertUnits(
    value: number,
    fromUnit: string,
    toUnit: string,
    context: UnitConversionContext
  ): number | null {
    // Simplified unit conversion
    if (fromUnit === toUnit) {
      return value;
    }

    // Convert to px as base unit
    let pxValue: number;
    
    switch (fromUnit) {
      case 'em':
        pxValue = value * context.baseFontSize;
        break;
      case 'rem':
        pxValue = value * context.baseFontSize;
        break;
      case '%':
        // Cannot convert percentage without context
        return null;
      case 'vw':
        pxValue = value * context.viewportWidth / 100;
        break;
      case 'vh':
        pxValue = value * context.viewportHeight / 100;
        break;
      case 'px':
      default:
        pxValue = value;
        break;
    }

    // Convert from px to target unit
    switch (toUnit) {
      case 'em':
      case 'rem':
        return pxValue / context.baseFontSize;
      case 'vw':
        return pxValue / context.viewportWidth * 100;
      case 'vh':
        return pxValue / context.viewportHeight * 100;
      case 'px':
      default:
        return pxValue;
    }
  }
}
