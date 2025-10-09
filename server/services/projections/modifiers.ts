import {
  ProjectionModifier,
  TaxModifier,
  InflationModifier,
  ContributionScalerModifier,
  FeeModifier,
} from "@shared/schema/projections";

// ============================================================================
// MODIFIER CONTEXT
// ============================================================================

/**
 * Context provided to modifiers for calculations
 */
export interface ModifierContext {
  currentValue: number;
  contributionAmount?: number;
  projectionStartDate: Date;
  currentDate: Date;
  yearsElapsed: number;
}

/**
 * Base interface for applying modifiers
 */
export interface ApplicableModifier {
  apply(value: number, context: ModifierContext): number;
  getName(): string;
  isEnabled(): boolean;
}

// ============================================================================
// TAX MODIFIER
// ============================================================================

/**
 * Reduces contributions by tax rate
 * Example: 20% tax rate means only 80% of contribution is actually invested
 */
export class TaxDeductorModifier implements ApplicableModifier {
  constructor(private config: TaxModifier) {}

  apply(value: number, context: ModifierContext): number {
    if (!this.config.enabled || !context.contributionAmount) {
      return value;
    }

    // Tax is deducted from contributions
    // If value is a contribution, reduce it by tax rate
    const taxRate = this.config.rate / 100;
    const taxAmount = value * taxRate;
    return value - taxAmount;
  }

  getName(): string {
    return `Tax Deduction (${this.config.rate}%)`;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// INFLATION MODIFIER
// ============================================================================

/**
 * Adjusts projected values for inflation over time
 * Reduces real value as time progresses
 */
export class InflationAdjusterModifier implements ApplicableModifier {
  constructor(private config: InflationModifier) {}

  apply(value: number, context: ModifierContext): number {
    if (!this.config.enabled) {
      return value;
    }

    // Apply inflation adjustment based on years elapsed
    // Real Value = Nominal Value / (1 + inflation rate)^years
    const inflationRate = this.config.rate / 100;
    const adjustmentFactor = Math.pow(1 + inflationRate, context.yearsElapsed);

    // Reduce value by inflation
    return value / adjustmentFactor;
  }

  getName(): string {
    return `Inflation Adjustment (${this.config.rate}%)`;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// CONTRIBUTION SCALER MODIFIER
// ============================================================================

/**
 * Scales recurring contributions by a factor
 * Useful for "what-if" scenarios (e.g., what if I increase contributions by 20%)
 */
export class ContributionScaler implements ApplicableModifier {
  constructor(private config: ContributionScalerModifier) {}

  apply(value: number, context: ModifierContext): number {
    if (!this.config.enabled || !context.contributionAmount) {
      return value;
    }

    // Only scale if this is a contribution value
    return value * this.config.scaleFactor;
  }

  getName(): string {
    const percentageValue = (this.config.scaleFactor - 1) * 100;
    const percentage = percentageValue.toFixed(0);
    return `Contribution Adjustment (${
      percentageValue > 0 ? "+" : ""
    }${percentage}%)`;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// FEE MODIFIER
// ============================================================================

/**
 * Deducts management fees from growth
 * Commonly used for fund management fees (0.5-2% annually)
 */
export class FeeDeductorModifier implements ApplicableModifier {
  constructor(private config: FeeModifier) {}

  apply(value: number, context: ModifierContext): number {
    if (!this.config.enabled) {
      return value;
    }

    // Fees are deducted from the portfolio value annually
    // Calculate fee for the time period
    const annualFeeRate = this.config.annualRate / 100;
    const feeForPeriod = value * annualFeeRate * context.yearsElapsed;

    return value - feeForPeriod;
  }

  getName(): string {
    return `Management Fees (${this.config.annualRate}% p.a.)`;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// MODIFIER CHAIN
// ============================================================================

/**
 * Composes multiple modifiers and applies them in sequence
 * Order matters! Modifiers are applied in the order they're added
 */
export class ModifierChain {
  private modifiers: ApplicableModifier[] = [];

  addModifier(modifier: ApplicableModifier): this {
    if (modifier.isEnabled()) {
      this.modifiers.push(modifier);
    }
    return this;
  }

  /**
   * Apply all modifiers in sequence
   */
  apply(value: number, context: ModifierContext): number {
    return this.modifiers.reduce(
      (currentValue, modifier) => modifier.apply(currentValue, context),
      value
    );
  }

  /**
   * Get all enabled modifier names
   */
  getModifierNames(): string[] {
    return this.modifiers.map((m) => m.getName());
  }

  /**
   * Get impact of each modifier
   */
  getModifierImpacts(
    value: number,
    context: ModifierContext
  ): Record<string, number> {
    const impacts: Record<string, number> = {};
    let currentValue = value;

    for (const modifier of this.modifiers) {
      const newValue = modifier.apply(currentValue, context);
      impacts[modifier.getName()] = newValue - currentValue;
      currentValue = newValue;
    }

    return impacts;
  }

  /**
   * Check if any modifiers are enabled
   */
  hasModifiers(): boolean {
    return this.modifiers.length > 0;
  }
}

// ============================================================================
// MODIFIER FACTORY
// ============================================================================

/**
 * Factory for creating modifier instances from config
 */
export function createModifierChain(
  modifiers: ProjectionModifier[]
): ModifierChain {
  const chain = new ModifierChain();

  for (const config of modifiers) {
    switch (config.type) {
      case "tax":
        chain.addModifier(new TaxDeductorModifier(config));
        break;
      case "inflation":
        chain.addModifier(new InflationAdjusterModifier(config));
        break;
      case "contribution_scaler":
        chain.addModifier(new ContributionScaler(config));
        break;
      case "fee":
        chain.addModifier(new FeeDeductorModifier(config));
        break;
    }
  }

  return chain;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate years elapsed between two dates
 */
export function calculateYearsElapsed(
  startDate: Date,
  currentDate: Date
): number {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return (currentDate.getTime() - startDate.getTime()) / msPerYear;
}

/**
 * Create modifier context
 */
export function createModifierContext(
  currentValue: number,
  projectionStartDate: Date,
  currentDate: Date,
  contributionAmount?: number
): ModifierContext {
  return {
    currentValue,
    contributionAmount,
    projectionStartDate,
    currentDate,
    yearsElapsed: calculateYearsElapsed(projectionStartDate, currentDate),
  };
}
