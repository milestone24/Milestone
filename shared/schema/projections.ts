import { z } from "zod";
import { AccountType, accountType, UserAsset } from "./portfolio-assets";
import { RecurringContribution } from "./transaction";
import { Milestone } from "./portfolio-milestone";
import { FireSettings } from "./portfolio-fire";
import { UserProfile } from "./user-account";
import { decimalValueSchema, schedulePatternType } from "@server/db/schema";
import {
  dateTransformedSchema,
  DecimalValueString,
  isDecimalValueString,
} from "./utils";

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
 * Projection interval for generated time points
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
 * Union of all modifier types
 */
export const projectionModifierSchema = z.discriminatedUnion("type", [
  taxModifierSchema,
  inflationModifierSchema,
  contributionScalerModifierSchema,
  feeModifierSchema,
]);
export type ProjectionModifier = z.infer<typeof projectionModifierSchema>;

// ============================================================================
// PROJECTION CONFIGURATION
// ============================================================================

export const configDateRangeSchema = z.object({
  startDate: dateTransformedSchema,
  endDate: dateTransformedSchema,
});

/**
 * Base configuration for all projections
 */
export const baseProjectionConfigSchema = z.object({
  growthModel: growthModelSchema,
  interval: projectionIntervalSchema.default("monthly"),
  modifiers: z.array(projectionModifierSchema).default([]),
  useContributorSpecificGrowthRates: z.boolean().optional().default(false),
});

/**
 * Simple mode configuration - user provides growth rate
 */
export const simpleProjectionConfigSchema = baseProjectionConfigSchema.extend({
  mode: z.literal("simple"),
  growthRate: z.number().min(-100).max(1000), // Annual percentage (-100% to +1000%)
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
 * Advanced mode configuration - uses historical analysis
 */
export const advancedProjectionConfigSchema = baseProjectionConfigSchema.extend(
  {
    mode: z.literal("advanced"),
    historicalPeriodMonths: z.number().min(1).max(120).default(36), // 1-120 months (up to 10 years)
    anticipatedGrowthRate: z.number().min(-100).max(1000).optional(), // Blend with historical if provided
    blendRatio: z.number().min(0).max(1).default(0.5), // 0 = all historical, 1 = all anticipated
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
 * Union of all projection config types
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

const c: ProjectionConfigWithDateRange = {
  mode: "simple",
  growthRate: 7.0,
  growthModel: "compound",
  startDate: new Date(),
  endDate: new Date(),
  interval: "yearly",
  modifiers: [],
  useContributorSpecificGrowthRates: false,
};

// ============================================================================
// MILESTONE & FIRE INTEGRATION
// ============================================================================

/**
 * Milestone target configuration for projection-based milestone tracking
 * NOTE: Current milestones table doesn't have targetDate field. This would require schema addition.
 * For now, targetDate is passed as parameter to projection endpoint.
 */
export const milestoneTargetSchema = z.object({
  milestoneId: z.string().uuid(),
  milestoneName: z.string(),
  targetValue: z.string().refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
  targetDate: dateTransformedSchema.optional(), // When user wants to achieve milestone
  accountType: z.string().nullable(), // ISA, SIPP, LISA, GIA, or null for portfolio-wide
});
export type MilestoneTarget = z.infer<typeof milestoneTargetSchema>;

/**
 * FIRE-specific projection configuration
 * Calculates retirement date from user's DOB + target retirement age
 */
export const fireProjectionConfigSchema = z.object({
  dateOfBirth: dateTransformedSchema,
  targetRetirementAge: z.number().min(18).max(100),
  annualIncomeGoal: z.string().refine(isDecimalValueString, {
    message: "Annual income goal must be a valid decimal string",
  }),
  safeWithdrawalRate: z.number().min(0).max(100), // Percentage (typically 3-4%)
  adjustForInflation: z.boolean().default(true),
  statePensionAge: z.number().min(60).max(70).default(66),
});
export type FIREProjectionConfig = z.infer<typeof fireProjectionConfigSchema>;

// ============================================================================
// PROJECTION RESULTS
// ============================================================================

/**
 * Single time point in a projection
 * Similar to AssetValueTimePoint but for projected future values
 */
export const projectionTimePointSchema = z.object({
  date: z.coerce
    .date()
    .transform((val) => (typeof val === "string" ? new Date(val) : val))
    .describe("The date of the time point"),
  value: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Value must be a valid decimal string",
    })
    .describe("The value of the time point"),
  contributions: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Contributions must be a valid decimal string",
    })
    .describe("The contributions of the time point"),
  growth: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Growth must be a valid decimal string",
    })
    .describe("The growth of the time point"), // Cumulative growth by this date
  bonuses: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Bonuses must be a valid decimal string",
    })
    .optional(), // Total bonuses applied by this date
  accessibleValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Accessible value must be a valid decimal string",
    })
    .optional(), // Value accessible without penalty at this date
  lockedValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Locked value must be a valid decimal string",
    })
    .optional(), // Value locked until release point(s)
  appliedModifiers: z.record(z.number()).optional(), // Modifier impacts
  projectedValue: z.boolean().default(true), // True for projected, false for actual historical
});
export type ProjectionTimePoint = z.infer<typeof projectionTimePointSchema>;

/**
 * Per-asset projection breakdown
 */
export const assetProjectionSchema = z.object({
  assetId: z.string().uuid(),
  assetName: z.string(),
  accountType: z.string(),
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  projectedEndValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected end value must be a valid decimal string",
  }),
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
  "custom",
] as const;

export const contributorProjectionSchema = z.object({
  contributorReferenceId: z.string().uuid().optional(),
  contributorName: z.string(),
  accountType: z.string(),
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  projectedEndValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected end value must be a valid decimal string",
  }),
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

export const contributorScheduleSchema = z.object({
  patternConfig: schedulePatternSchema,
  value: decimalValueSchema.refine(isDecimalValueString, {
    message: "Value must be a valid decimal string",
  }),
  startDate: dateTransformedSchema,
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

export const contributorSchema = z.object({
  referenceId: z.string().uuid().optional(),
  accountType: z.enum(contributorType),
  name: z.string(),
  type: z.enum(contributionTypes),
  expectedGrowthRate: z.number().min(-100).max(1000).optional(),
  valueReleases: z.array(valueReleasePointInTimeSchema).optional(),
  bonusValues: z.array(bonusValueSchema).optional(),
  limitations: z.array(limitationSchema).optional(),
  currentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Current value must be a valid decimal string",
  }),
  schedules: z.array(contributorScheduleSchema),
  taxes: z.array(taxSchema).optional(),
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
 * Milestone progress result - indicates if user is on track
 */
export const milestoneProgressSchema = z.object({
  milestoneId: z.string().uuid(),
  milestoneName: z.string(),
  targetValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
  targetDate: dateTransformedSchema.optional(),
  projectedValueAtTarget: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected value at target must be a valid decimal string",
  }),
  isOnTrack: z.boolean(),
  shortfall: decimalValueSchema.refine(isDecimalValueString, {
    message: "Shortfall must be a valid decimal string",
  }),
  shortfallPercentage: z.number(),
});
export type MilestoneProgress = z.infer<typeof milestoneProgressSchema>;

/**
 * Complete projection result
 */
export const projectionResultSchema = z.object({
  config: projectionConfigSchema,
  totalCurrentValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total current value must be a valid decimal string",
  }),
  totalProjectedValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total projected value must be a valid decimal string",
  }),
  totalGrowth: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total growth must be a valid decimal string",
  }),
  totalContributions: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total contributions must be a valid decimal string",
  }),
  totalBonuses: decimalValueSchema.refine(isDecimalValueString, {
    message: "Total bonuses must be a valid decimal string",
  }), // Total bonuses applied across all contributors (zero if no bonuses)
  timePoints: z.array(projectionTimePointSchema), // Aggregated portfolio-wide
  contributorBreakdown: z.array(contributorProjectionSchema),
  milestoneProgress: z.array(milestoneProgressSchema).optional(),
  //fireProgress: fireProgressSchema.optional(),
  computedAt: dateTransformedSchema,
  warnings: z.array(z.string()).optional(), // E.g., "Insufficient historical data for asset X"
  // NEW: Context for client-side recomputation
  computationContext: computationContextSchema.optional(),
});
export type ProjectionResult = z.infer<typeof projectionResultSchema>;

export const fireProjectionDataSchema = z.object({
  age: z.number(),
  portfolio: decimalValueSchema.refine(isDecimalValueString, {
    message: "Portfolio value must be a valid decimal string",
  }),
  target: decimalValueSchema.refine(isDecimalValueString, {
    message: "Target value must be a valid decimal string",
  }),
  lockedValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Locked value must be a valid decimal string",
    })
    .optional(),
  accessibleValue: decimalValueSchema
    .refine(isDecimalValueString, {
      message: "Accessible value must be a valid decimal string",
    })
    .optional(),
});
export type FireProjectionData = z.infer<typeof fireProjectionDataSchema>;

export const fireProjectionResultSchema = z.object({
  projectionData: z.array(fireProjectionDataSchema),
  yearsToFire: z.number(),
});

export type FireProjectionResult = z.infer<typeof fireProjectionResultSchema>;

export const monthlyContributionDifferenceSchema = z.object({
  approximateMonthlyContribution: decimalValueSchema.refine(
    isDecimalValueString,
    {
      message:
        "Approximate monthly contribution must be a valid decimal string",
    }
  ),
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
 * FIRE progress result - retirement feasibility
 */
export const fireProjectionSchema = z.object({
  fireNumber: z.number(), // Required portfolio value to retire
  projectedRetirementDate: dateTransformedSchema.nullable(),
  projectedRetirementAge: z.number().nullable(),
  targetRetirementAge: z.number(),
  projectedValueAtRetirement: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected value at retirement must be a valid decimal string",
  }),
  isOnTrack: z.boolean(),
  yearsAheadOrBehind: z.number().nullable(),
  yearsRemainingToFireTarget: z.number().nullable(), // Negative if ahead, positive if behind
  monthlyContributionDifference: monthlyContributionDifferenceSchema,
  projectionResult: projectionResultSchema,
  fireProjection: z.array(fireProjectionDataSchema),
  withdrawalStrategy: z.lazy(() => withdrawalStrategySchema).optional(), // Forward reference, added after schema definition
  warnings: z.array(z.string()).optional(),
});
export type FireProjection = z.infer<typeof fireProjectionSchema>;

// ============================================================================
// WITHDRAWAL STRATEGY SCHEMAS
// ============================================================================

/**
 * Income goal - defines target income from a specific age
 * Used to define income targets across retirement phases
 */
export const incomeGoalSchema = z.object({
  fromAge: z.number(),
  incomeGoal: decimalValueSchema.refine(isDecimalValueString, {
    message: "Income goal must be a valid decimal string",
  }),
});
export type IncomeGoal = z.infer<typeof incomeGoalSchema>;

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
  age: z.number().nullable(),
  accountType: z.enum(contributorType),
  contributorName: z.string(),
  contributorReferenceId: z.string().uuid().optional(),
  projectedValue: decimalValueSchema.refine(isDecimalValueString, {
    message: "Projected value must be a valid decimal string",
  }),
  taxCharacteristics: z.string(),
  isAccessible: z.boolean(),
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
  taxModifier: taxModifierSchema,
  inflationModifier: inflationModifierSchema,
  contributionScalerModifier: contributionScalerModifierSchema,
  feeModifier: feeModifierSchema,
};

export type ProjectionOrchestratorAssetInput = {
  id: string;
  currentValue: DecimalValueString;
  name: string;
  accountType: AccountType;
  recurringContributions: RecurringContribution[];
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

export type ProjectionOrchestratorInput = {
  contributors: Contributor[];
  //assets: ProjectionOrhesratorAssetInput[];
  //recurringContributions: RecurringContribution[]; // All contributions for all assets
  config: ProjectionConfigWithDateRange;
  dateOfBirth?: Date; // For age-based value release calculations
  //db: Database;
  milestoneTarget?: MilestoneTarget;
};