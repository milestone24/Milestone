import { createDecimalValueString, DecimalValueString } from "../schema";
import {
  ProjectionModifier,
  TaxModifier,
  InflationModifier,
  ContributionScalerModifier,
  FeeModifier,
  ContributionOffsetModifier as ContributionOffsetModifierConfig,
  Contributor,
  ModifierWithOptionalMatch,
  ContributorMatchPredicate,
} from "../schema/projections";
import Decimal from "decimal.js";

// ============================================================================
// MODIFIER CONTEXT
// ============================================================================

/**
 * Context provided to modifiers for calculations
 */
export interface ModifierContext {
  currentValue: DecimalValueString;
  contributionAmount?: DecimalValueString;
  projectionStartDate: Date;
  currentDate: Date;
  yearsElapsed: number;
}

/**
 * Base interface for applying modifiers
 */
export interface ApplicableModifier {
  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString;
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

  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString {
    if (!this.config.enabled || !context.contributionAmount) {
      return value;
    }

    // Tax is deducted from contributions
    // If value is a contribution, reduce it by tax rate
    const taxRate = this.config.rate / 100;
    const taxAmount = Decimal(value).mul(taxRate);
    return createDecimalValueString(Decimal(value).sub(taxAmount).toString());
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

  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString {
    if (!this.config.enabled) {
      return value;
    }
    const inflationRate = this.config.rate / 100;
    const adjustmentFactor = Decimal(1)
      .add(inflationRate)
      .pow(context.yearsElapsed);
    return createDecimalValueString(
      Decimal(value).div(adjustmentFactor).toString()
    );
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

  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString {
    if (!this.config.enabled || !context.contributionAmount) {
      return value;
    }
    return createDecimalValueString(
      Decimal(value).mul(this.config.scaleFactor).toString()
    );
  }

  getName(): string {
    const percentageValue = (this.config.scaleFactor - 1) * 100;
    const percentage = createDecimalValueString(
      Decimal(percentageValue).toFixed(0)
    );
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

  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString {
    if (!this.config.enabled) {
      return value;
    }

    // Fees are deducted from the portfolio value annually
    // Calculate fee for the time period
    const annualFeeRate = this.config.annualRate / 100;
    const feeForPeriod = Decimal(value)
      .mul(annualFeeRate)
      .mul(context.yearsElapsed);

    return createDecimalValueString(
      Decimal(value).sub(feeForPeriod).toString()
    );
  }

  getName(): string {
    return `Management Fees (${this.config.annualRate}% p.a.)`;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// CONTRIBUTION OFFSET MODIFIER
// ============================================================================

/**
 * Adds or subtracts a fixed amount per contribution.
 * Applied only in contribution context (e.g. +100 to all ISA contributions).
 */
export class ContributionOffsetModifier implements ApplicableModifier {
  constructor(private config: ContributionOffsetModifierConfig) {}

  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString {
    if (!this.config.enabled || !context.contributionAmount) {
      return value;
    }
    return createDecimalValueString(
      Decimal(value).add(this.config.amount).toString()
    );
  }

  getName(): string {
    const amount = Decimal(this.config.amount);
    const sign = amount.gte(0) ? "+" : "";
    return `Contribution Offset (${sign}${this.config.amount})`;
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
  apply(
    value: DecimalValueString,
    context: ModifierContext
  ): DecimalValueString {
    return this.modifiers.reduce(
      (currentValue, modifier) => modifier.apply(currentValue, context),
      createDecimalValueString(value)
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
    value: DecimalValueString,
    context: ModifierContext
  ): Record<string, number> {
    const impacts: Record<string, number> = {};
    let currentValue = value;

    for (const modifier of this.modifiers) {
      const newValue = modifier.apply(currentValue, context);
      impacts[modifier.getName()] = Decimal(newValue)
        .sub(Decimal(currentValue))
        .toNumber();
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
// MODIFIER PREDICATE & UNIFY
// ============================================================================

/**
 * Returns true if the contributor is matched by the predicate.
 * If match is undefined, returns true (modifier applies to all).
 */
export function contributorMatches(
  contributor: Contributor,
  match: ContributorMatchPredicate | undefined
): boolean {
  if (!match) return true;

  if (match.accountType !== undefined) {
    const allowed = Array.isArray(match.accountType)
      ? match.accountType
      : [match.accountType];
    if (
      contributor.accountType == null ||
      !allowed.includes(contributor.accountType)
    ) {
      return false;
    }
  }

  if (match.contributorType !== undefined) {
    const allowed = Array.isArray(match.contributorType)
      ? match.contributorType
      : [match.contributorType];
    if (!allowed.includes(contributor.type)) return false;
  }

  if (match.referenceId !== undefined) {
    if (contributor.referenceId !== match.referenceId) return false;
  }

  return true;
}

/**
 * Modifier types where only the first occurrence is kept when unifying.
 * Subsequent duplicates of these types are discarded.
 */
const SINGULAR_MODIFIER_TYPES: ReadonlySet<ProjectionModifier["type"]> =
  new Set(["inflation"]);

function deduplicateModifiers(
  modifiers: ProjectionModifier[]
): ProjectionModifier[] {
  const seen = new Set<ProjectionModifier["type"]>();
  return modifiers.filter((modifier) => {
    if (!SINGULAR_MODIFIER_TYPES.has(modifier.type)) return true;
    if (seen.has(modifier.type)) return false;
    seen.add(modifier.type);
    return true;
  });
}

/**
 * Builds the list of modifiers that apply to a contributor from config.modifiers.
 * Filters by optional match, strips match from entries, deduplicates singular types.
 */
export function unifyModifiersForContributor(
  contributor: Contributor,
  modifierEntries: ModifierWithOptionalMatch[]
): ProjectionModifier[] {
  const filtered = modifierEntries.filter((entry) =>
    contributorMatches(contributor, entry.match)
  );
  const stripped: ProjectionModifier[] = filtered.map(
    ({ match: _match, ...modifier }) => modifier
  );
  return deduplicateModifiers(stripped);
}

/**
 * Returns modifiers as a plain list (strip match, dedupe). Use when there is no
 * contributor context and all config modifiers should apply (e.g. fire calculator).
 */
export function getModifiersAsGlobalList(
  modifierEntries: ModifierWithOptionalMatch[]
): ProjectionModifier[] {
  const stripped: ProjectionModifier[] = modifierEntries.map(
    ({ match: _match, ...modifier }) => modifier
  );
  return deduplicateModifiers(stripped);
}

// ============================================================================
// MODIFIER MERGE (legacy – prefer unifyModifiersForContributor for config.modifiers)
// ============================================================================

/**
 * Merges one or more modifier config arrays into a single ordered list.
 * Modifiers are applied in the order the arrays are provided.
 * For singular modifier types (e.g. inflation), only the first occurrence is
 * kept — subsequent duplicates are discarded.
 * @deprecated Use unifyModifiersForContributor when building chain from config.modifiers with optional match.
 */
export function mergeModifiers(
  ...modifierSets: (ProjectionModifier[] | undefined)[]
): ProjectionModifier[] {
  return deduplicateModifiers(modifierSets.flatMap((set) => set ?? []));
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
      case "contribution_offset":
        chain.addModifier(new ContributionOffsetModifier(config));
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
  return Math.round((currentDate.getTime() - startDate.getTime()) / msPerYear);
}

/**
 * Create modifier context
 */
export function createModifierContext(
  currentValue: DecimalValueString,
  projectionStartDate: Date,
  currentDate: Date,
  contributionAmount?: DecimalValueString
): ModifierContext {
  return {
    currentValue,
    contributionAmount,
    projectionStartDate,
    currentDate,
    yearsElapsed: calculateYearsElapsed(projectionStartDate, currentDate),
  };
}
