/**
 * Projection schema: config, results, and supporting types for portfolio and FIRE projections.
 *
 * - **Config**: baseProjectionConfigSchema (interval, growthModel, seriesAlignment, backfillIntervals), simple/advanced mode, date range. Controls how the time series is generated (from_now vs calendar-aligned, backfill for MoM).
 * - **Time points**: ProjectionTimePoint (date, value, contributions, growth, accessible/locked). Date-based series; can be aggregated per contributor or portfolio-wide.
 * - **Results**: ProjectionResult (totals, timePoints, contributorBreakdown), FireProjection (FIRE number, retirement date/age, fireProjectionByTime/ByAge, withdrawal strategy).
 * - **Contributors**: Contributor (currentValue, schedules, valueReleases, bonusValues) and ContributorProjection (per-contributor time series).
 */
import { z } from "zod";
import { AccountType, accountType, UserAsset } from "./portfolio-assets";
import { RecurringContribution } from "./transaction";
import { Milestone } from "./portfolio-milestone";
import { FireSettings, incomeGoalSchema } from "./portfolio-fire";
import { UserProfile } from "./user-account";
import { decimalValueSchema, schedulePatternType } from "@server/db/schema";
import {
  dateTransformedSchema,
  DecimalValueString,
  isDecimalValueString,
} from "./utils";
import Decimal from "decimal.js";

// ============================================================================
// PROJECTION CONFIGURATION
// ============================================================================

/**
 * Projection modes: simple uses user-provided growth rates, advanced uses historical analysis
 */
export const projectionModeSchema = z.enum(["simple", "advanced"]);
export type ProjectionMode = z.infer<typeof projectionModeSchema>;

/**
 * Growth models: linear applies growth only to initial value, compound applies to accumulated value
 */
export const growthModelSchema = z.enum(["linear", "compound"]);
export type GrowthModel = z.infer<typeof growthModelSchema>;

/**
 * Step size for generated time points.
 * With seriesAlignment "from_now", the first point is at startDate and each next point is +1 interval.
 * With "calendar", points align to boundaries (e.g. first of month for monthly, first of year for yearly).
 */
export const projectionIntervalSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
export type ProjectionInterval = z.infer<typeof projectionIntervalSchema>;

// ============================================================================
// MODIFIERS
// ============================================================================

/**
 * Tax Deductor Modifier - Reduces contributions by tax rate
 * Example: 20% tax rate means only 80% of contribution is actually invested
 */
export const taxModifierSchema = z.object({
  type: z.literal("tax"),
  enabled: z.boolean(),
  rate: z.number().min(0).max(100), // Percentage (0-100)
  description: z.string().optional(),
});
export type TaxModifier = z.infer<typeof taxModifierSchema>;

/**
 * Inflation Adjuster Modifier - Adjusts projected values for inflation
 * Typically reduces real value over time
 */
export const inflationModifierSchema = z.object({
  type: z.literal("inflation"),
  enabled: z.boolean(),
  rate: z.number().min(-50).max(50), // Percentage (-50 to 50), typically 2-3%
  description: z.string().optional(),
});
export type InflationModifier = z.infer<typeof inflationModifierSchema>;

/**
 * Contribution Scaler Modifier - Scales recurring contributions by percentage
 * Useful for "what-if" scenarios (e.g., what if I increase contributions by 20%)
 */
export const contributionScalerModifierSchema = z.object({
  type: z.literal("contribution_scaler"),
  enabled: z.boolean(),
  scaleFactor: z.number().min(0).max(10), // Multiplier (0.5 = 50%, 1.0 = 100%, 1.5 = 150%)
  description: z.string().optional(),
});
export type ContributionScalerModifier = z.infer<
  typeof contributionScalerModifierSchema
>;

/**
 * Fee Modifier - Deducts management fees from growth
 * Commonly used for fund management fees (0.5-2% annually)
 */
export const feeModifierSchema = z.object({
  type: z.literal("fee"),
  enabled: z.boolean(),
  annualRate: z.number().min(0).max(10), // Percentage (0-10)
  description: z.string().optional(),
});
export type FeeModifier = z.infer<typeof feeModifierSchema>;

/**
 * Contribution Offset Modifier - Adds or subtracts a fixed amount per contribution.
 * Applied only in contribution context (e.g. +100 to all ISA contributions).
 */
export const contributionOffsetModifierSchema = z.object({
  type: z.literal("contribution_offset"),
  enabled: z.boolean(),
  amount: decimalValueSchema.refine(isDecimalValueString, {
    message: "Amount must be a valid decimal string",
  }),
  description: z.string().optional(),
});
export type ContributionOffsetModifier = z.infer<
  typeof contributionOffsetModifierSchema
>;

/**
 * Union of all modifier types
 */
export const projectionModifierSchema = z.discriminatedUnion("type", [
  taxModifierSchema,
  inflationModifierSchema,
  contributionScalerModifierSchema,
  feeModifierSchema,
  contributionOffsetModifierSchema,
]);
export type ProjectionModifier = z.infer<typeof projectionModifierSchema>;

/**
 * Optional predicate on a modifier: which contributors the modifier applies to.
 * Absent = applies to all contributors.
 */
export const contributorMatchPredicateSchema = z.object({
  accountType: z
    .union([z.string(), z.array(z.string())])
    .optional(),
  contributorType: z
    .union([z.string(), z.array(z.string())])
    .optional(),
  referenceId: z.string().uuid().optional(),
});
export type ContributorMatchPredicate = z.infer<
  typeof contributorMatchPredicateSchema
>;

/**
 * Modifier config with optional match: each entry in config.modifiers
 * can optionally restrict which contributors it applies to.
 */
export const modifierWithOptionalMatchSchema = z.intersection(
  projectionModifierSchema,
  z.object({
    match: contributorMatchPredicateSchema.optional(),
  })
);
export type ModifierWithOptionalMatch = z.infer<
  typeof modifierWithOptionalMatchSchema
>;

// ============================================================================
// PROJECTION CONFIGURATION
// ============================================================================

/**
 * Date range applied to a projection run.
 * All generated time points fall within [startDate, endDate].
 */
export const configDateRangeSchema = z.object({
  /** First date of the projection; first time point is at or after this date. */
  startDate: dateTransformedSchema,
  /** Last date of the projection; the series does not extend beyond this date. */
  endDate: dateTransformedSchema,
});

/**
 * How projection dates are aligned when generating the time series.
 * - **from_now**: Start at `startDate` and step forward by `interval`. First point is `startDate` (e.g. "today").
 * - **calendar**: Align to interval boundaries (e.g. first day of each month for monthly). Use with `backfillIntervals` to include points before the natural start (e.g. "last month") for month-over-month comparison.
 */
export const seriesAlignmentSchema = z.enum(["from_now", "calendar"]);
export type SeriesAlignment = z.infer<typeof seriesAlignmentSchema>;

/**
 * Base configuration shared by all projection modes (simple and advanced).
 * When merged with configDateRangeSchema, provides the full input for a projection run.
 */
export const baseProjectionConfigSchema = z.object({
  /** How growth is applied: linear (to initial value only) or compound (to accumulated value). */
  growthModel: growthModelSchema,
  /** Step size for generated time points: daily, weekly, monthly, or yearly. */
  interval: projectionIntervalSchema.default("monthly"),
  /** Modifiers applied during projection (tax, inflation, fees, contribution scaler/offset). */
  modifiers: z.array(modifierWithOptionalMatchSchema).default([]),
  /** If true, include portfolio-level recurring contributions in addition to per-contributor schedules. */
  usePortfolioRecurringContributions: z.boolean().optional().default(false),
  /** If true, use each contributor's expectedGrowthRate when set; otherwise use the config growth rate. */
  useContributorSpecificGrowthRates: z.boolean().optional().default(false),
  /** When set to "calendar", time points align to interval boundaries (e.g. first of month) and optional backfill applies. Omit or "from_now" for legacy behaviour (first point = startDate). */
  seriesAlignment: seriesAlignmentSchema.optional(),
  /** Number of intervals to include before the aligned start when seriesAlignment is "calendar". E.g. 1 with monthly gives one extra month (e.g. "last month") for MoM comparison. Note: currently backfill points are emitted with a placeholder value (current value); correct behaviour requires passing historical portfolio/contributor values at each backfill date (see projection-simple backfill comments). */
  backfillIntervals: z.number().int().min(0).optional(),
});

/**
 * Simple mode configuration: user supplies a single annual growth rate.
 * No historical analysis; growth and contributions are projected from the given rate.
 */
export const simpleProjectionConfigSchema = baseProjectionConfigSchema.extend({
  mode: z.literal("simple"),
  /** Annual growth rate as a percentage (e.g. 8 for 8%). Applied according to growthModel. */
  growthRate: z.number().min(-100).max(1000),
});

export type SimpleProjectionConfig = z.infer<
  typeof simpleProjectionConfigSchema
>;

export const simpleProjectionConfigSchemaWithDateRange =
  simpleProjectionConfigSchema.merge(configDateRangeSchema);

export type SimpleProjectionConfigWithDateRange = z.infer<
  typeof simpleProjectionConfigSchemaWithDateRange
>;

/**
 * Advanced mode configuration: blends historical performance with an optional anticipated rate.
 * Used when projection should be driven by past returns (e.g. from asset history) rather than a fixed rate.
 */
export const advancedProjectionConfigSchema = baseProjectionConfigSchema.extend(
  {
    mode: z.literal("advanced"),
    /** Number of months of history to use for the historical growth component (1–120). */
    historicalPeriodMonths: z.number().min(1).max(120).default(36),
    /** Optional forward-looking rate to blend with historical; when set, blendRatio controls the mix. */
    anticipatedGrowthRate: z.number().min(-100).max(1000).optional(),
    /** Blend of historical vs anticipated: 0 = all historical, 1 = all anticipated, 0.5 = equal. */
    blendRatio: z.number().min(0).max(1).default(0.5),
  }
);

export type AdvancedProjectionConfig = z.infer<
  typeof advancedProjectionConfigSchema
>;

export const advancedProjectionConfigSchemaWithDateRange =
  advancedProjectionConfigSchema.merge(configDateRangeSchema);

export type AdvancedProjectionConfigWithDateRange = z.infer<
  typeof advancedProjectionConfigSchemaWithDateRange
>;

/**
 * Union of projection config types (no date range).
 * Use projectionConfigWithDateRangeSchema when startDate and endDate are set (e.g. for running a projection).
 */
export const projectionConfigSchema = z.discriminatedUnion("mode", [
  simpleProjectionConfigSchema,
  advancedProjectionConfigSchema,
]);

export type ProjectionConfig = z.infer<typeof projectionConfigSchema>;

export const projectionConfigWithDateRangeSchema = z.discriminatedUnion(
  "mode",
  [
    simpleProjectionConfigSchema.merge(configDateRangeSchema),
    advancedProjectionConfigSchema.merge(configDateRangeSchema),
  ]
);

export type ProjectionConfigWithDateRange = z.infer<
  typeof projectionConfigWithDateRangeSchema
>;

// ============================================================================
// MILESTONE & FIRE INTEGRATION
// ============================================================================

/**
 * Milestone target configuration for projection-based milestone tracking.
 * Passed when running a projection to evaluate progress toward a specific milestone.
 * NOTE: Current milestones table doesn't have targetDate; it is supplied at request time.
 */
export const milestoneTargetSchema = z.object({
  /** Unique id of the milestone record. */
  milestoneId: z.string().uuid(),
  /** Display name of the milestone. */
  milestoneName: z.string(),
  /** Target portfolio value for this milestone (decimal string, e.g. "1000000"). */
  targetValue: z.string().refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
  /** Optional date by which the user wants to achieve the target; when omitted, progress uses final projected value. */
  targetDate: dateTransformedSchema.optional(),
  /** Account type filter for the milestone (ISA, SIPP, etc.) or null for portfolio-wide. */
  accountType: z.string().nullable(),
});
export type MilestoneTarget = z.infer<typeof milestoneTargetSchema>;

/**
 * FIRE-specific projection configuration.
 * Drives retirement date (DOB + target retirement age), FIRE number (income goal / SWR), and optional state pension / income goals.
 */
export const fireProjectionConfigSchema = z.object({
  /** User date of birth; used to compute age at each time point and retirement date. */
  dateOfBirth: dateTransformedSchema,
  /** Age at which the user aims to retire; retirement date = DOB + this age. */
  targetRetirementAge: z.number().min(18).max(100),
  /** Desired annual income in retirement (decimal string); FIRE number = this / (SWR/100). */
  annualIncomeGoal: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual income goal must be a valid decimal string",
  }),
  /** Safe withdrawal rate as a percentage (e.g. "4" for 4%); FIRE number = annualIncomeGoal / (SWR/100). */
  safeWithdrawalRate: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Safe withdrawal rate must be a valid decimal string",
    })
    .refine((val) => Decimal(val).gt(0) && Decimal(val).lt(100), {
      message: "Safe withdrawal rate must be between 0 and 100",
    }),
  /** Whether to adjust projected values for inflation. */
  adjustForInflation: z.boolean().default(true),
  /** Whether to include state pension as a contributor in the projection. */
  includeStatePension: z.boolean().default(false),
  /** Age-based income goals (e.g. reduced spending at 75). */
  incomeGoals: incomeGoalSchema.array(),
});
export type FIREProjectionConfig = z.infer<typeof fireProjectionConfigSchema>;

// ============================================================================
// PROJECTION RESULTS
// ============================================================================

/**
 * Single time point in a date-based projection series.
 * Each point represents portfolio (or contributor) state at one date: value, cumulative contributions, growth, and optional accessible/locked split.
 */
export const projectionTimePointSchema = z.object({
  /** Date of this time point. When seriesAlignment is "calendar", points align to interval boundaries (e.g. first of month). */
  date: z.coerce
    .date()
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  /** Total portfolio (or contributor) value at this date after growth, contributions, and modifiers. */
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  /** Cumulative user contributions up to and including this date (excludes bonuses). */
  contributions: decimalValueSchema.refine(isDecimalValueString, {
    message: "Contributions must be a valid decimal string",
  }),
  /** Cumulative growth component up to this date (from growth model). */
  growth: decimalValueSchema.refine(isDecimalValueString, {
    message: "Growth must be a valid decimal string",
  }),
  /** Total bonuses applied by this date (e.g. LISA government bonus). */
  bonuses: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Bonuses must be a valid decimal string",
    })
    .optional(),
  /** Portion of value that can be withdrawn without penalty at this date (e.g. after unlock age). */
  accessibleValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Accessible value must be a valid decimal string",
    })
    .optional(),
  /** Portion of value locked until release point(s) (e.g. pension before minimum pension age). */
  lockedValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Locked value must be a valid decimal string",
    })
    .optional(),
  /** Per-modifier impact on value at this point (e.g. inflation, fees). */
  appliedModifiers: z.record(z.number()).optional(),
  /** True if this point is projected; false if it comes from historical data (e.g. backfill). */
  projectedValue: z.boolean().default(true),
});
export type ProjectionTimePoint = z.infer<typeof projectionTimePointSchema>;

/**
 * Per-asset projection breakdown: one asset's trajectory over the projection window.
 */
export const assetProjectionSchema = z.object({
  /** Asset id (UUID). */
  assetId: z.string().uuid(),
  /** Display name of the asset. */
  assetName: z.string(),
  /** Account type (ISA, SIPP, LISA, GIA, etc.). */
  accountType: z.string(),
  /** Value at projection start (e.g. today). */
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  /** Projected value at the end date of the projection. */
  projectedEndValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected end value must be a valid decimal string",
  }),
  /** Time series of (date, value, contributions, growth, …) for this asset. */
  timePoints: z.array(projectionTimePointSchema),
});
export type AssetProjection = z.infer<typeof assetProjectionSchema>;

/**
 * Contributor
 */

export const contributionTypes = [
  "asset",
  "state_pension",
  "workplace_pension",
  "adjustment",
  "fire-setting",
] as const;

/**
 * Per-contributor projection breakdown.
 * A contributor can be an asset, state pension, adjustment, or other source; each has its own time series.
 */
export const contributorProjectionSchema = z.object({
  /** Optional reference id linking to the contributor (e.g. asset id). */
  contributorReferenceId: z.string().uuid().optional(),
  /** Display name of the contributor. */
  contributorName: z.string(),
  /** Platform or provider name if applicable. */
  platformName: z.string().optional(),
  /** Account type (ISA, SIPP, etc.) or null. */
  accountType: z.string().nullable(),
  /** Value at projection start. */
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  /** Projected value at projection end date. */
  projectedEndValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected end value must be a valid decimal string",
  }),
  /** Time series for this contributor on the same date grid as the portfolio. */
  timePoints: z.array(projectionTimePointSchema),
});
export type ContributorProjection = z.infer<typeof contributorProjectionSchema>;

export type ContributionTypes = (typeof contributionTypes)[number];

/**
 * Bonus value for a contributor
 * A bonus value are bonuses that may be applied to each contibution.
 * For example in the UK the government will provide bonuses for contributions to a pension schemes such as the Lifetime ISA.
 * examples:
 * For a Lifetime ISA, the government will provide a bonus of 25% on the first £4,000 of contributions.
 *
 */
export const bonusValueSchema = z.object({
  name: z.string(),
  valueType: z.enum(["percentage", "fixed"]),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  annualLimit: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Annual limit must be a valid decimal string",
    })
    .optional(), // Maximum bonus amount per tax year (e.g., £1,000 for LISA)
  annualContributionLimit: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Annual contribution limit must be a valid decimal string",
    })
    .optional(), // Maximum contributions eligible for bonus per tax year (e.g., £4,000 for LISA)
  priority: z.number().int().min(0).optional(), // Lower number = higher priority when multiple bonuses apply
});

export type BonusValue = z.infer<typeof bonusValueSchema>;

/**
 * This needs refining
 */
export const taxSchema = z.object({
  name: z.string(),
  predicates: z.array(
    z.object({
      type: z.enum(["age", "date"]),
      value: z.string(),
    })
  ),
  valueType: z.enum(["percentage", "fixed"]),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
});

export type ContributorTax = z.infer<typeof taxSchema>;

export const valueReleasePointInTimeSchema = z.object({
  valueType: z.enum(["age", "date"]),
  value: z.string(), // Age as string (e.g., "60") or ISO date string (e.g., "2025-04-06")
  //Applying penalties suggests that the value can be accessed before the value is reached but with a penalty.
  //If no penalties are applied does it suggest the value is explicity locked and there are no exceptions?
  penalties: z
    .array(
      z.object({
        rule: z.object({
          comparator: z.enum(["lt", "lte", "gt", "gte", "eq", "neq"]),
          value: z.string(), // Age or date string to compare against
        }),
        penalty: z.object({
          valueType: z.enum(["percentage", "fixed"]), // Percentage (e.g., "0.25" = 25%) or fixed amount
          value: decimalValueSchema.refine(isDecimalValueString, {
            message: "Penalty value must be a valid decimal string",
          }),
        }),
      })
    )
    .optional(),
  exceptions: z.array(z.string()).optional(), // Special cases that qualify (e.g., ["first_home", "terminal_illness"] for LISA)
});

export type ValueReleasePointInTime = z.infer<
  typeof valueReleasePointInTimeSchema
>;

export const schedulePatternSchema = z.object({
  type: z.enum(schedulePatternType),
  expression: z.string(),
  timezone: z.string().optional(),
});

/**
 * Recurring contribution schedule for a contributor: pattern (e.g. monthly on 1st), amount, and date range.
 */
export const contributorScheduleSchema = z.object({
  /** When to apply the contribution (cron/rrule pattern, timezone). */
  patternConfig: schedulePatternSchema,
  /** Contribution amount per occurrence (decimal string). */
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  /** First date the schedule is active. */
  startDate: dateTransformedSchema,
  /** Last date the schedule is active, or null for open-ended. */
  endDate: dateTransformedSchema.nullable(),
});

export type ContributorSchedule = z.infer<typeof contributorScheduleSchema>;

export const limitationSchema = z.object({
  name: z.string(),
  valueType: z.enum(["percentage", "fixed"]),
  predicates: z.array(
    z.object({
      type: z.enum(["age", "date", "period"]),
      value: z.string(),
    })
  ),
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
});

export type Limitation = z.infer<typeof limitationSchema>;

const contributorType = [...accountType, "PENSION"] as const;

export type ContributorType = (typeof contributorType)[number];

/**
 * Contributor: a single source of value and/or contributions in a projection (asset, state pension, adjustment, etc.).
 * Each contributor has a current value, optional schedules (recurring contributions), and optional release/bonus/tax rules.
 */
export const contributorSchema = z.object({
  /** Unique id for this contributor instance. */
  id: z.string().uuid(),
  /** Optional reference to an entity (e.g. asset id). */
  referenceId: z.string().uuid().optional(),
  /** Account type (ISA, SIPP, LISA, GIA, PENSION) or null. */
  accountType: z.enum(contributorType).nullable(),
  /** Display name. */
  name: z.string(),
  /** Platform or provider name. */
  platformName: z.string().optional(),
  /** Contributor kind: asset, state_pension, workplace_pension, adjustment, fire-setting. */
  type: z.enum(contributionTypes),
  /** Optional per-contributor growth rate (used when useContributorSpecificGrowthRates is true). */
  expectedGrowthRate: z.number().min(-100).max(1000).optional(),
  /** When value becomes accessible (e.g. age 55 for pension) and any penalties. */
  valueReleases: z.array(valueReleasePointInTimeSchema).optional(),
  /** Bonuses (e.g. LISA 25%) applied to contributions. */
  bonusValues: z.array(bonusValueSchema).optional(),
  /** Contribution limits (e.g. annual cap). */
  limitations: z.array(limitationSchema).optional(),
  /** Value at projection start (e.g. today). */
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  /** Recurring contribution schedules (pattern, value, start/end date). */
  schedules: z.array(contributorScheduleSchema),
  /** Optional tax rules applied to this contributor. */
  taxes: z.array(taxSchema).optional(),
  /** If true, this contributor's value is included in portfolio totals. */
  includeValue: z.boolean(),
  /** If true, this contributor's schedules are included in the projection. */
  includeContributions: z.boolean(),
});

export type Contributor = z.infer<typeof contributorSchema>;

export const computationContextSchema = z.object({
  contributors: z.array(contributorSchema),
});
export type ComputationContext = z.infer<typeof computationContextSchema>;

export type ContributorRules = Pick<
  Contributor,
  "valueReleases" | "bonusValues" | "expectedGrowthRate" | "taxes"
>;

/**
 * Milestone progress: comparison of projected value at target date (or end) vs milestone target.
 */
export const milestoneProgressSchema = z.object({
  /** Milestone id. */
  milestoneId: z.string().uuid(),
  /** Milestone display name. */
  milestoneName: z.string(),
  /** Target value for the milestone. */
  targetValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
  /** Target date if specified; otherwise progress uses end-of-projection value. */
  targetDate: dateTransformedSchema.optional(),
  /** Projected portfolio value at target date (or at projection end). */
  projectedValueAtTarget: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected value at target must be a valid decimal string",
  }),
  /** True if projected value meets or exceeds target. */
  isOnTrack: z.boolean(),
  /** targetValue minus projectedValueAtTarget (positive = shortfall). */
  shortfall: decimalValueSchema.refine(isDecimalValueString, {
    message: "Shortfall must be a valid decimal string",
  }),
  /** Shortfall as percentage of target (0–100). */
  shortfallPercentage: z.number(),
});
export type MilestoneProgress = z.infer<typeof milestoneProgressSchema>;

/**
 * Complete projection result: portfolio-level totals, aggregated time series, and per-contributor breakdown.
 * Returned by the projection orchestrator for a given config and date range.
 */
export const projectionResultSchema = z.object({
  /** Config used for this run (mode, interval, date range, seriesAlignment, etc.). Includes startDate/endDate so the client can reuse them for preview (lock). */
  config: projectionConfigWithDateRangeSchema,
  /** Sum of all contributors' values at projection start. */
  totalCurrentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total current value must be a valid decimal string",
  }),
  /** Projected portfolio value at the end date (last time point). */
  totalProjectedValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total projected value must be a valid decimal string",
  }),
  /** Total growth component across the projection (from growth model). */
  totalGrowth: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total growth must be a valid decimal string",
  }),
  /** Total user contributions (excluding bonuses) over the projection. */
  totalContributions: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total contributions must be a valid decimal string",
  }),
  /** Total bonuses applied (e.g. LISA) across the projection. */
  totalBonuses: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total bonuses must be a valid decimal string",
  }),
  /** Aggregated portfolio-wide time series; same date grid as each contributor. Month-over-month delta can be derived from the last two points when interval is monthly and seriesAlignment is calendar. */
  timePoints: z.array(projectionTimePointSchema),
  /** Per-contributor time series and end values. */
  contributorBreakdown: z.array(contributorProjectionSchema),
  /** When a milestone target was supplied, progress (shortfall, on track) per milestone. */
  milestoneProgress: z.array(milestoneProgressSchema).optional(),
  /** Server time when the projection was computed. */
  computedAt: dateTransformedSchema,
  /** Warnings (e.g. insufficient historical data, invalid config). */
  warnings: z.array(z.string()).optional(),
  /** Optional context for client-side recomputation (contributors, etc.). */
  computationContext: computationContextSchema.optional(),
});
export type ProjectionResult = z.infer<typeof projectionResultSchema>;

/**
 * Single point in the FIRE age-based projection (fireProjectionByAge).
 * Same information as ProjectionTimePoint but keyed by user age for FIRE charts and comparisons.
 */
export const fireProjectionDataSchema = z.object({
  /** User age at this point (derived from date and DOB). */
  age: z.number(),
  /** Portfolio value at this age. */
  portfolio: decimalValueSchema.refine(isDecimalValueString, {
    message: "Portfolio value must be a valid decimal string",
  }),
  /** FIRE number (target) at this age; used for gap and chart. */
  target: decimalValueSchema.refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
  /** Locked value at this age (e.g. pension before unlock). */
  lockedValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Locked value must be a valid decimal string",
    })
    .optional(),
  /** Accessible value at this age. */
  accessibleValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Accessible value must be a valid decimal string",
    })
    .optional(),
});
export type FireProjectionData = z.infer<typeof fireProjectionDataSchema>;

/**
 * Legacy FIRE projection result shape (projectionData + yearsToFire).
 * Prefer fireProjectionSchema for the full FIRE result.
 */
export const fireProjectionResultSchema = z.object({
  /** Age-based projection data (portfolio, target per age). */
  projectionData: z.array(fireProjectionDataSchema),
  /** Years until portfolio reaches FIRE number. */
  yearsToFire: z.number(),
});

export type FireProjectionResult = z.infer<typeof fireProjectionResultSchema>;

/**
 * Approximate monthly contribution to reach target and the difference vs current total contributions.
 */
export const monthlyContributionDifferenceSchema = z.object({
  /** Approximate monthly contribution needed to be on track (decimal string). */
  approximateMonthlyContribution: decimalValueSchema.refine(
    isDecimalValueString,
    {
      message:
        "Approximate monthly contribution must be a valid decimal string",
    }
  ),
  /** Difference between approximate and current monthly contributions (positive = need to contribute more). */
  monthlyContributionDifference: decimalValueSchema.refine(
    isDecimalValueString,
    {
      message: "Monthly contribution difference must be a valid decimal string",
    }
  ),
});
export type MonthlyContributionDifference = z.infer<
  typeof monthlyContributionDifferenceSchema
>;

/**
 * FIRE projection result: retirement feasibility, on-track metrics, and date/age-based series.
 * Combines the generic projection result with FIRE-specific outputs (retirement date/age, FIRE number, withdrawal strategy).
 */
export const fireProjectionSchema = z.object({
  /** Required portfolio value to support target income at safe withdrawal rate (FIRE number). */
  fireNumber: decimalValueSchema.refine(isDecimalValueString, {
    message: "Fire number must be a valid decimal string",
  }),
  /** Date when the projected portfolio first reaches the FIRE number; null if never. */
  projectedRetirementDate: dateTransformedSchema.nullable(),
  /** Age at projected retirement (from DOB and projectedRetirementDate); null if never. */
  projectedRetirementAge: z.number().nullable(),
  /** User's target retirement age from FIRE settings. */
  targetRetirementAge: z.number(),
  /** Projected portfolio value at the end of the projection (typically at target retirement age). */
  projectedValueAtRetirement: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected value at retirement must be a valid decimal string",
  }),
  /** Current portfolio as percentage of FIRE number (e.g. "0.45" = 45%). */
  progressPercentage: decimalValueSchema.refine(isDecimalValueString, {
    message: "Progress percentage must be a valid decimal string",
  }),
  /** True if projected to reach FIRE number by target retirement age. */
  isOnTrack: z.boolean(),
  /** Years ahead (negative) or behind (positive) target retirement age; e.g. -2 = retire 2 years early. */
  yearsAheadOrBehind: z.number(),
  /** Years remaining until portfolio reaches FIRE number; negative if ahead, positive if behind. */
  yearsRemainingToFireTarget: z.number(),
  /** Approximate monthly contribution and difference vs current to stay on track. */
  monthlyContributionDifference: monthlyContributionDifferenceSchema,
  /** Underlying projection result (timePoints, contributorBreakdown, config). */
  projectionResult: projectionResultSchema,
  /** Date-based series (same as projectionResult.timePoints) for FIRE charts. */
  fireProjectionByTime: z.array(projectionTimePointSchema),
  /** Age-based series (portfolio, target per age) for FIRE charts and contribution adjuster. */
  fireProjectionByAge: z.array(fireProjectionDataSchema),
  /** Optional withdrawal strategy (phases, account access timeline) when computed. */
  withdrawalStrategy: z.lazy(() => withdrawalStrategySchema).optional(),
  /** Warnings from projection or FIRE calculation. */
  warnings: z.array(z.string()).optional(),
});
export type FireProjection = z.infer<typeof fireProjectionSchema>;

// ============================================================================
// WITHDRAWAL STRATEGY SCHEMAS
// ============================================================================

/**
 * Single account allocation within a withdrawal phase
 */
export const withdrawalAllocationSchema = z.object({
  contributorName: z.string(),
  contributorReferenceId: z.string().uuid().optional(),
  accountType: z.enum(contributorType),
  annualAmount: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual amount must be a valid decimal string",
  }),
  taxCharacteristics: z.string(),
});
export type WithdrawalAllocation = z.infer<typeof withdrawalAllocationSchema>;

/**
 * A withdrawal phase (triggered by account unlock events)
 */
export const withdrawalPhaseSchema = z.object({
  phaseType: z.enum(["building", "withdrawal"]),
  fromAge: z.number(),
  toAge: z.number().nullable(),
  annualIncomeTarget: decimalValueSchema.refine(isDecimalValueString, {
    message: "Annual income target must be a valid decimal string",
  }),
  allocations: z.array(withdrawalAllocationSchema),
  warnings: z.array(z.string()).optional(),
});
export type WithdrawalPhase = z.infer<typeof withdrawalPhaseSchema>;

/**
 * Account access timeline entry
 */
export const accountAccessTimelineEntrySchema = z.object({
  contributorId: z.string().uuid(),
  age: z.number().nullable(),
  accountType: z.enum(contributorType),
  contributorName: z.string(),
  contributorReferenceId: z.string().uuid().optional(),
  projectedValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected value must be a valid decimal string",
  }),
  taxCharacteristics: z.string(),
  isAccessible: z.boolean(),
  type: z.enum(contributionTypes),
});
export type AccountAccessTimelineEntry = z.infer<
  typeof accountAccessTimelineEntrySchema
>;

/**
 * Complete withdrawal strategy result
 */
export const withdrawalStrategySchema = z.object({
  phases: z.array(withdrawalPhaseSchema),
  accountAccessTimeline: z.array(accountAccessTimelineEntrySchema),
  warnings: z.array(z.string()).optional(),
});
export type WithdrawalStrategy = z.infer<typeof withdrawalStrategySchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request body for single asset projection
 */
export const assetProjectionRequestSchema = z.object({
  assetId: z.string().uuid(),
  config: projectionConfigWithDateRangeSchema,
  milestoneTarget: milestoneTargetSchema.optional(),
});
export type AssetProjectionRequest = z.infer<
  typeof assetProjectionRequestSchema
>;

/**
 * Request body for portfolio projection
 */
export const portfolioProjectionRequestSchema = z.object({
  config: projectionConfigWithDateRangeSchema,
  accountTypeFilter: z.string().nullable().optional(), // Filter by account type (for milestone)
  assetIds: z.array(z.string().uuid()).optional(), // Specific assets, or null for all
  milestoneTarget: milestoneTargetSchema.optional(),
  fireConfig: fireProjectionConfigSchema.optional(),
});
export type PortfolioProjectionRequest = z.infer<
  typeof portfolioProjectionRequestSchema
>;

// ============================================================================
// DATABASE SCHEMA CONSIDERATIONS (FUTURE)
// ============================================================================

/**
 * NOTE: For future database persistence
 *
 * Potential tables to add:
 *
 * 1. projected_values_cache (TTL-based temporary storage)
 *    - id, user_account_id, cache_key (hash of config), result (jsonb), expires_at, created_at
 *
 * 2. projection_configurations (saved user preferences)
 *    - id, user_account_id, name, config (jsonb), is_default, created_at, updated_at
 *
 * 3. milestone enhancements (requires migration)
 *    - Add target_date field to milestones table
 *    - Add asset_ids array field or create milestone_assets junction table
 *
 * Current implementation: All calculations on-demand, no persistence
 */

// ============================================================================
// EXPORTS
// ============================================================================

export const ProjectionSchemas = {
  config: projectionConfigSchema,
  simpleConfig: simpleProjectionConfigSchema,
  advancedConfig: advancedProjectionConfigSchema,
  result: projectionResultSchema,
  timePoint: projectionTimePointSchema,
  assetProjection: assetProjectionSchema,
  milestoneTarget: milestoneTargetSchema,
  milestoneProgress: milestoneProgressSchema,
  fireConfig: fireProjectionConfigSchema,
  fireProgress: fireProjectionResultSchema,
  assetProjectionRequest: assetProjectionRequestSchema,
  portfolioProjectionRequest: portfolioProjectionRequestSchema,
  modifier: projectionModifierSchema,
  modifierWithOptionalMatch: modifierWithOptionalMatchSchema,
  contributorMatchPredicate: contributorMatchPredicateSchema,
  taxModifier: taxModifierSchema,
  inflationModifier: inflationModifierSchema,
  contributionScalerModifier: contributionScalerModifierSchema,
  feeModifier: feeModifierSchema,
  contributionOffsetModifier: contributionOffsetModifierSchema,
};

export type ProjectionOrchestratorAssetInput = {
  id: string;
  currentValue: DecimalValueString;
  name: string;
  accountType: AccountType;
  recurringContributions: RecurringContribution[];
  platformName?: string;
};

/**
 * The contract here provides means of obtaining data for purpose of projections.
 * The scope will always be that of a user account.
 */
export type ProjectionDataSource = {
  getAssetById: (
    assetId: string
  ) => Promise<ProjectionOrchestratorAssetInput | null>;
  getAssets: () => Promise<ProjectionOrchestratorAssetInput[]>;
  getContributionsForAssets: (
    assetIds: string[]
  ) => Promise<RecurringContribution[]>;
  getMilestones: () => Promise<Milestone[]>;
  getMilestoneById: (milestoneId: string) => Promise<Milestone | null>;
  getFireSettings: () => Promise<FireSettings | null>;
  getUserProfile: () => Promise<UserProfile | null>;
};

/**
 * Input for orchestrating projections
 */
// export interface ProjectionOrchestratorInput {
//   assets: ProjectionOrhesratorAssetInput[];
//   recurringContributions: RecurringContribution[]; // All contributions for all assets
//   config: ProjectionConfigWithDateRange;
//   //db: Database;
//   milestoneTarget?: MilestoneTarget;
// }

/**
 * Input for the projection orchestrator: contributors (assets, pensions, adjustments), config with date range, and optional FIRE/milestone context.
 */
export type ProjectionOrchestratorInput = {
  /** Contributors to project (each with currentValue, schedules, optional growth/release/bonus rules). */
  contributors: Contributor[];
  /** Projection config including startDate, endDate, interval, seriesAlignment, backfillIntervals, and mode (simple/advanced). */
  config: ProjectionConfigWithDateRange;
  /** Used for age-based value release (e.g. pension unlock age) and FIRE age series. */
  dateOfBirth?: Date;
  /** When provided, progress toward this milestone is computed and attached to the result. */
  milestoneTarget?: MilestoneTarget;
};