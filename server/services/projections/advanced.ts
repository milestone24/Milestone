import {
  AdvancedProjectionConfig,
  ProjectionTimePoint,
} from "@shared/schema/projections";
import { RecurringContribution, AssetValue } from "@shared/schema";
import { Database } from "@server/db";
import { assetValues, userAssets, securityDailyHistory } from "@server/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { ModifierChain } from "./modifiers";
import {
  SimpleProjectionInput,
  SimpleProjectionResult,
  generateSimpleProjection,
} from "./simple";

// ============================================================================
// ADVANCED PROJECTION SERVICE
// ============================================================================

/**
 * Input for advanced projections
 */
export interface AdvancedProjectionInput {
  assetId: string;
  currentValue: number;
  currentDate: Date;
  recurringContributions: RecurringContribution[];
  config: AdvancedProjectionConfig;
  modifierChain?: ModifierChain;
  db: Database;
}

/**
 * Historical growth analysis result
 */
export interface HistoricalGrowthAnalysis {
  averageGrowthRate: number;
  volatility: number;
  dataPoints: number;
  period: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// HISTORICAL GROWTH RATE CALCULATION
// ============================================================================

/**
 * Calculate period-over-period growth rates from asset values
 */
function calculateGrowthRates(values: AssetValue[]): number[] {
  const growthRates: number[] = [];

  for (let i = 1; i < values.length; i++) {
    const prevValue = values[i - 1];
    const currValue = values[i];

    if (prevValue && currValue && prevValue.value > 0) {
      const growthRate = (currValue.value - prevValue.value) / prevValue.value;
      growthRates.push(growthRate);
    }
  }

  return growthRates;
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 * Formula: CAGR = (Ending Value / Beginning Value)^(1/years) - 1
 */
function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number
): number {
  if (startValue <= 0 || endValue <= 0 || years <= 0) {
    return 0;
  }

  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/**
 * Calculate average and standard deviation of growth rates
 */
function calculateStatistics(rates: number[]): {
  average: number;
  stdDev: number;
} {
  if (rates.length === 0) {
    return { average: 0, stdDev: 0 };
  }

  const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;

  if (rates.length === 1) {
    return { average: average * 100, stdDev: 0 }; // Convert to percentage
  }

  const squaredDiffs = rates.map((rate) => Math.pow(rate - average, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (rates.length - 1);
  const stdDev = Math.sqrt(variance);

  return {
    average: average * 100, // Convert to percentage
    stdDev: stdDev * 100,
  };
}

// ============================================================================
// HISTORICAL ANALYSIS FROM ASSET VALUES
// ============================================================================

/**
 * Analyze historical growth rate from asset value history
 * Used for manual assets
 */
export async function calculateHistoricalGrowthRateFromAssetValues(
  db: Database,
  assetId: string,
  periodMonths: number
): Promise<HistoricalGrowthAnalysis> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  // Fetch historical asset values
  const values = await db
    .select()
    .from(assetValues)
    .where(
      and(
        eq(assetValues.assetId, assetId),
        gte(assetValues.valueDate, startDate),
        lte(assetValues.valueDate, endDate)
      )
    )
    .orderBy(assetValues.valueDate);

  if (values.length < 2) {
    return {
      averageGrowthRate: 0,
      volatility: 0,
      dataPoints: values.length,
      period: { start: startDate, end: endDate },
    };
  }

  // Calculate CAGR from first to last value
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  
  if (!firstValue || !lastValue) {
    return {
      averageGrowthRate: 0,
      volatility: 0,
      dataPoints: values.length,
      period: { start: startDate, end: endDate },
    };
  }

  const years = (lastValue.valueDate.getTime() - firstValue.valueDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const cagr = calculateCAGR(firstValue.value, lastValue.value, years);

  // Also calculate period-over-period volatility
  const growthRates = calculateGrowthRates(values);
  const stats = calculateStatistics(growthRates);

  return {
    averageGrowthRate: cagr,
    volatility: stats.stdDev,
    dataPoints: values.length,
    period: { start: firstValue.valueDate, end: lastValue.valueDate },
  };
}

/**
 * Analyze historical growth rate from security price history
 * Used for calculated assets (securities)
 */
export async function calculateHistoricalGrowthRateFromSecurityPrices(
  db: Database,
  securityId: string,
  periodMonths: number
): Promise<HistoricalGrowthAnalysis> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  // Fetch historical security prices
  const prices = await db
    .select()
    .from(securityDailyHistory)
    .where(
      and(
        eq(securityDailyHistory.securityId, securityId),
        gte(securityDailyHistory.date, startDate.toISOString()),
        lte(securityDailyHistory.date, endDate.toISOString())
      )
    )
    .orderBy(securityDailyHistory.date);

  if (prices.length < 2) {
    return {
      averageGrowthRate: 0,
      volatility: 0,
      dataPoints: prices.length,
      period: { start: startDate, end: endDate },
    };
  }

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];

  if (!firstPrice || !lastPrice || !firstPrice.close || !lastPrice.close) {
    return {
      averageGrowthRate: 0,
      volatility: 0,
      dataPoints: prices.length,
      period: { start: startDate, end: endDate },
    };
  }

  const firstDate = new Date(firstPrice.date);
  const lastDate = new Date(lastPrice.date);
  const years = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const cagr = calculateCAGR(Number(firstPrice.close), Number(lastPrice.close), years);

  // Calculate volatility from price changes
  const priceChanges: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev && curr && prev.close && curr.close && Number(prev.close) > 0) {
      const change = (Number(curr.close) - Number(prev.close)) / Number(prev.close);
      priceChanges.push(change);
    }
  }

  const stats = calculateStatistics(priceChanges);

  return {
    averageGrowthRate: cagr,
    volatility: stats.stdDev,
    dataPoints: prices.length,
    period: { start: firstDate, end: lastDate },
  };
}

// ============================================================================
// BLEND GROWTH RATES
// ============================================================================

/**
 * Blend historical growth rate with user-anticipated rate
 * Uses blendRatio: 0 = all historical, 1 = all anticipated
 */
export function blendGrowthRates(
  historicalRate: number,
  anticipatedRate: number | undefined,
  blendRatio: number
): number {
  if (anticipatedRate === undefined) {
    return historicalRate;
  }

  // blendRatio of 0 means all historical
  // blendRatio of 1 means all anticipated
  return historicalRate * (1 - blendRatio) + anticipatedRate * blendRatio;
}

// ============================================================================
// MAIN ADVANCED PROJECTION FUNCTION
// ============================================================================

/**
 * Generate advanced projection using historical analysis
 */
export async function generateAdvancedProjection(
  input: AdvancedProjectionInput
): Promise<SimpleProjectionResult & { analysis: HistoricalGrowthAnalysis }> {
  const { assetId, config, db } = input;

  // Determine if this is a manual or calculated asset
  const asset = await db.query.userAssets.findFirst({
    where: eq(userAssets.id, assetId),
    with: { securities: true },
  });

  if (!asset) {
    throw new Error(`Asset ${assetId} not found`);
  }

  // Calculate historical growth rate
  let historicalAnalysis: HistoricalGrowthAnalysis;

  if (asset.valueMethod === "calculated" && asset.securities.length > 0) {
    // For calculated assets, use security price history
    // TODO: If multiple securities, calculate weighted average or use first
    const firstSecurity = asset.securities[0];
    if (!firstSecurity) {
      throw new Error("No securities found for calculated asset");
    }

    historicalAnalysis = await calculateHistoricalGrowthRateFromSecurityPrices(
      db,
      firstSecurity.securityId,
      config.historicalPeriodMonths
    );
  } else {
    // For manual assets, use asset value history
    historicalAnalysis = await calculateHistoricalGrowthRateFromAssetValues(
      db,
      assetId,
      config.historicalPeriodMonths
    );
  }

  // Blend historical with anticipated if provided
  const projectionGrowthRate = blendGrowthRates(
    historicalAnalysis.averageGrowthRate,
    config.anticipatedGrowthRate,
    config.blendRatio
  );

  // Use simple projection with calculated growth rate
  const simpleInput: SimpleProjectionInput = {
    currentValue: input.currentValue,
    currentDate: input.currentDate,
    recurringContributions: input.recurringContributions,
    config: {
      mode: "simple" as const,
      growthModel: config.growthModel,
      growthRate: projectionGrowthRate,
      startDate: config.startDate,
      endDate: config.endDate,
      interval: config.interval,
      modifiers: config.modifiers,
    },
    modifierChain: input.modifierChain,
  };

  const result = generateSimpleProjection(simpleInput);

  return {
    ...result,
    analysis: historicalAnalysis,
  };
}

// ============================================================================
// VOLATILITY METRICS (FUTURE ENHANCEMENT)
// ============================================================================

/**
 * Calculate confidence bands based on volatility
 * Future enhancement for showing projection uncertainty
 */
export function calculateConfidenceBands(
  projectedValue: number,
  volatility: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  // Using normal distribution approximation
  // 95% confidence ≈ 1.96 standard deviations
  // 68% confidence ≈ 1.00 standard deviations
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.0;
  const margin = projectedValue * (volatility / 100) * zScore;

  return {
    lower: Math.max(0, projectedValue - margin),
    upper: projectedValue + margin,
  };
}

