import { z } from "zod";

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
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

/**
 * Base configuration for all projections
 */
export const baseProjectionConfigSchema = z.object({
  mode: projectionModeSchema,
  growthModel: growthModelSchema,
  // startDate: z.coerce.date(),
  // endDate: z.coerce.date(),
  interval: projectionIntervalSchema.default("monthly"),
  modifiers: z.array(projectionModifierSchema).default([]),
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
  targetValue: z.number(),
  targetDate: z.coerce.date().optional(), // When user wants to achieve milestone
  accountType: z.string().nullable(), // ISA, SIPP, LISA, GIA, or null for portfolio-wide
});
export type MilestoneTarget = z.infer<typeof milestoneTargetSchema>;

/**
 * FIRE-specific projection configuration
 * Calculates retirement date from user's DOB + target retirement age
 */
export const fireProjectionConfigSchema = z.object({
  dateOfBirth: z.coerce.date(),
  targetRetirementAge: z.number().min(18).max(100),
  annualIncomeGoal: z.number().positive(),
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
  date: z.coerce.date(),
  value: z.number(),
  contributions: z.number(), // Cumulative contributions by this date
  growth: z.number(), // Cumulative growth by this date
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
  currentValue: z.number(),
  projectedEndValue: z.number(),
  timePoints: z.array(projectionTimePointSchema),
});
export type AssetProjection = z.infer<typeof assetProjectionSchema>;

/**
 * Milestone progress result - indicates if user is on track
 */
export const milestoneProgressSchema = z.object({
  milestoneId: z.string().uuid(),
  milestoneName: z.string(),
  targetValue: z.number(),
  targetDate: z.coerce.date().optional(),
  projectedValueAtTarget: z.number(),
  isOnTrack: z.boolean(),
  shortfall: z.number(), // Negative if ahead, positive if behind
  shortfallPercentage: z.number(),
});
export type MilestoneProgress = z.infer<typeof milestoneProgressSchema>;

/**
 * FIRE progress result - retirement feasibility
 */
export const fireProgressSchema = z.object({
  fireNumber: z.number(), // Required portfolio value to retire
  projectedRetirementDate: z.coerce.date(),
  projectedRetirementAge: z.number(),
  targetRetirementAge: z.number(),
  projectedValueAtRetirement: z.number(),
  isOnTrack: z.boolean(),
  yearsAheadOrBehind: z.number(), // Negative if ahead, positive if behind
  monthlyShortfall: z.number().optional(), // Additional monthly contribution needed if behind
});
export type FIREProgress = z.infer<typeof fireProgressSchema>;

/**
 * Complete projection result
 */
export const projectionResultSchema = z.object({
  config: projectionConfigSchema,
  totalCurrentValue: z.number(),
  totalProjectedValue: z.number(),
  totalGrowth: z.number(),
  totalContributions: z.number(),
  timePoints: z.array(projectionTimePointSchema), // Aggregated portfolio-wide
  assetBreakdown: z.array(assetProjectionSchema),
  milestoneProgress: z.array(milestoneProgressSchema).optional(),
  fireProgress: fireProgressSchema.optional(),
  calculatedAt: z.coerce.date(),
  warnings: z.array(z.string()).optional(), // E.g., "Insufficient historical data for asset X"
});
export type ProjectionResult = z.infer<typeof projectionResultSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request body for single asset projection
 */
export const assetProjectionRequestSchema = z.object({
  assetId: z.string().uuid(),
  config: projectionConfigSchema,
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
  fireProgress: fireProgressSchema,
  assetProjectionRequest: assetProjectionRequestSchema,
  portfolioProjectionRequest: portfolioProjectionRequestSchema,
  modifier: projectionModifierSchema,
  taxModifier: taxModifierSchema,
  inflationModifier: inflationModifierSchema,
  contributionScalerModifier: contributionScalerModifierSchema,
  feeModifier: feeModifierSchema,
};
