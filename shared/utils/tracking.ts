export const calculateAge = (dateOfBirth: Date) => {
  const today = new Date();
  const dob = new Date(dateOfBirth);

  console.log("today", today);
  console.log("dob", dob);

  let age = today.getFullYear() - dob.getFullYear();

  const monthDifference = today.getMonth() - dob.getMonth();

  // Adjust age if birthday hasn't occurred yet this year
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age;
};

// Finance utility functions for the investment tracker

/**
 * Calculate future value using compound interest formula
 * FV = PV * (1 + r)^n
 */
export function calculateFutureValue(
  presentValue: number,
  rate: number,
  years: number
): number {
  return presentValue * Math.pow(1 + rate / 100, years);
}

/**
 * Calculate future value with regular contributions
 * FV = PV * (1 + r)^n + PMT * ((1 + r)^n - 1) / r
 */
export function calculateFutureValueWithContributions(
  presentValue: number,
  monthlyContribution: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;

  const baseGrowth = presentValue * Math.pow(1 + monthlyRate, months);
  const contributionGrowth =
    (monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1)) /
    monthlyRate;

  return baseGrowth + contributionGrowth;
}

/**
 * Calculate years until reaching target amount
 * n = log(FV/PV) / log(1 + r)
 */
export function calculateYearsToTarget(
  presentValue: number,
  monthlyContribution: number,
  annualRate: number,
  targetValue: number
): number {
  const monthlyRate = annualRate / 100 / 12;

  // Handle edge cases
  if (presentValue >= targetValue) return 0;
  if (monthlyRate === 0 && monthlyContribution === 0) return Infinity;
  if (monthlyRate === 0)
    return (targetValue - presentValue) / (monthlyContribution * 12);

  // Use numerical approximation for complex calculations with contributions
  let months = 0;
  let currentValue = presentValue;

  while (currentValue < targetValue && months < 1200) {
    // Cap at 100 years
    currentValue = currentValue * (1 + monthlyRate) + monthlyContribution;
    months++;
  }

  return months / 12;
}

/**
 * Calculate FIRE number based on desired annual income and withdrawal rate
 */
export function calculateFireNumber(
  desiredAnnualIncome: number,
  withdrawalRate: number
): number {
  return desiredAnnualIncome / (withdrawalRate / 100);
}


export type FireProjectionConfig = {
  currentAmount: number;
  monthlyInvestment: number;
  expectedReturn: number;
  targetAmount: number;
  currentAge: number;
};

export type FireProjectionData = {
  age: number;
  portfolio: number;
  target: number;
};

export type FireProjectionResult = {
  config: FireProjectionConfig;
  projectionData: FireProjectionData[];
  yearsToFire: number;
};

/**
 * Generate FIRE projection data for chart
 */
export function calculateFireProjection(
  config: FireProjectionConfig
): FireProjectionResult {
  const {
    currentAmount,
    monthlyInvestment,
    expectedReturn,
    targetAmount,
    currentAge,
  } = config;

  const yearsToFire = calculateYearsToTarget(
    currentAmount,
    monthlyInvestment,
    expectedReturn,
    targetAmount
  );

  const projectionData: FireProjectionData[] = [];

  let currentValue = currentAmount;

  // Calculate until age 87 or until we reach a sensible maximum
  const maxAge = 87;
  const maxYearsToCalculate = maxAge - currentAge;

  for (let year = 0; year <= maxYearsToCalculate; year++) {
    const age = currentAge + year;

    if (year > 0) {
      currentValue = calculateFutureValueWithContributions(
        currentValue,
        monthlyInvestment,
        expectedReturn,
        1 // 1 year at a time
      );
    }

    projectionData.push({
      age,
      portfolio: Math.round(currentValue),
      target: targetAmount,
    });

    // Stop if we've reached max age
    if (age >= maxAge) break;
  }

  return { config, projectionData, yearsToFire };
}

/**
 * Calculate the impact of changing monthly contribution
 */
export function calculateContributionImpact({
  currentAmount,
  currentMonthlyInvestment,
  newMonthlyInvestment,
  expectedReturn,
  targetAmount,
  currentAge,
}: {
  currentAmount: number;
  currentMonthlyInvestment: number;
  newMonthlyInvestment: number;
  expectedReturn: number;
  targetAmount: number;
  currentAge: number;
}): {
  originalYears: number;
  newYears: number;
  yearsDifference: number;
  monthsDifference: number;
} {
  const originalYears = calculateYearsToTarget(
    currentAmount,
    currentMonthlyInvestment,
    expectedReturn,
    targetAmount
  );

  const newYears = calculateYearsToTarget(
    currentAmount,
    newMonthlyInvestment,
    expectedReturn,
    targetAmount
  );

  const yearsDifference = originalYears - newYears;
  const monthsDifference = Math.round(yearsDifference * 12);

  return {
    originalYears,
    newYears,
    yearsDifference,
    monthsDifference,
  };
}

/**
 * Calculate if someone is on track for their retirement goals
 */
export function calculateOnTrackStatus({
  currentAge,
  targetAge,
  currentAmount,
  targetAmount,
}: {
  currentAge: number;
  targetAge: number;
  currentAmount: number;
  targetAmount: number;
}): {
  expectedCurrentAmount: number;
  difference: number;
  isOnTrack: boolean;
  percentageOfTarget: number;
} {
  const totalYears = targetAge - currentAge;
  const growthFactor = Math.pow(targetAmount / 100000, 1 / totalYears);

  // What the amount should be at the current age to stay on track
  const expectedCurrentAmount =
    100000 * Math.pow(growthFactor, currentAge - 30);

  const difference = currentAmount - expectedCurrentAmount;
  const isOnTrack = difference >= 0;
  const percentageOfTarget = (currentAmount / targetAmount) * 100;

  return {
    expectedCurrentAmount,
    difference,
    isOnTrack,
    percentageOfTarget,
  };
}
