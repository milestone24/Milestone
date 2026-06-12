import type { Milestone } from "../schema/portfolio-milestone";
import type { UserAssetWithValue } from "../schema/portfolio-assets";

export interface SuggestedMilestone {
  name: string;
  accountType: string | null;
  targetValue: string;
  description: string;
  icon?: string;
}

export function generateMilestoneSuggestions(
  assets: UserAssetWithValue[],
  totalPortfolioValue: number,
  existingMilestones: Milestone[],
): SuggestedMilestone[] {
  const portfolioMetrics = analyzePortfolio(assets, totalPortfolioValue);

  return createSuggestions(
    portfolioMetrics,
    totalPortfolioValue,
    existingMilestones,
  );
}

function analyzePortfolio(assets: UserAssetWithValue[], totalValue: number) {
  const accountTypeTotals: Record<string, number> = {};
  const accountTypeCount: Record<string, number> = {};

  assets.forEach((asset) => {
    const type = asset.accountType;
    if (!accountTypeTotals[type]) {
      accountTypeTotals[type] = 0;
      accountTypeCount[type] = 0;
    }
    accountTypeTotals[type] += Number(asset.currentValue);
    accountTypeCount[type] = accountTypeCount[type] ?? 0;
    accountTypeCount[type]++;
  });

  const accountTypes = ["ISA", "SIPP", "LISA", "GIA"];
  const portfolioGaps = accountTypes.filter((type) => {
    return (
      !accountTypeTotals[type] || accountTypeTotals[type] < totalValue * 0.05
    );
  });

  let largestAccountType = null;
  let largestValue = 0;

  for (const [type, value] of Object.entries(accountTypeTotals)) {
    if (value > largestValue) {
      largestValue = value;
      largestAccountType = type;
    }
  }

  return {
    totalValue,
    accountTypeTotals,
    accountTypeCount,
    portfolioGaps,
    largestAccountType,
    largestValue,
  };
}

function createSuggestions(
  metrics: ReturnType<typeof analyzePortfolio>,
  totalValue: number,
  existingMilestones: Milestone[],
): SuggestedMilestone[] {
  const suggestions: SuggestedMilestone[] = [];
  const nextMilestones = generateNextMilestones(totalValue);

  const existingTargets = new Set(
    existingMilestones.map((m) => `${m.accountType || "ALL"}-${m.targetValue}`),
  );

  nextMilestones.forEach((milestone) => {
    const key = `ALL-${milestone}`;
    if (!existingTargets.has(key)) {
      suggestions.push({
        name: `Reach £${formatNumberShort(milestone)} Portfolio`,
        accountType: null,
        targetValue: milestone.toString(),
        description: `Grow your overall investments to £${formatNumberShort(
          milestone,
        )}.`,
        icon: "💰",
      });
    }
  });

  for (const [type, value] of Object.entries(metrics.accountTypeTotals)) {
    if (value > 1000) {
      const accountNextMilestones = generateNextMilestones(value, 1);

      if (accountNextMilestones.length > 0) {
        const nextMilestone = accountNextMilestones[0];
        const key = `${type}-${nextMilestone}`;

        if (nextMilestone && !existingTargets.has(key)) {
          suggestions.push({
            name: `£${formatNumberShort(nextMilestone)} in ${type}`,
            accountType: type,
            targetValue: nextMilestone.toString(),
            description: `Grow your ${type} account to £${formatNumberShort(
              nextMilestone,
            )}.`,
            icon: getAccountIcon(type),
          });
        }
      }
    }
  }

  metrics.portfolioGaps.forEach((gapType) => {
    if (gapType === "LISA" && !metrics.accountTypeTotals["LISA"]) {
      suggestions.push({
        name: `Start a LISA`,
        accountType: "LISA",
        targetValue: "4000",
        description: `Consider opening a Lifetime ISA and contributing up to £4,000 to get the government bonus.`,
        icon: "🏠",
      });
    } else if (gapType === "SIPP" && !metrics.accountTypeTotals["SIPP"]) {
      suggestions.push({
        name: `Start a Pension (SIPP)`,
        accountType: "SIPP",
        targetValue: "10000",
        description: `Build your retirement savings with a Self-Invested Personal Pension (SIPP) and benefit from tax relief.`,
        icon: "👵",
      });
    } else if (gapType === "ISA" && !metrics.accountTypeTotals["ISA"]) {
      suggestions.push({
        name: `Open a Stocks & Shares ISA`,
        accountType: "ISA",
        targetValue: "5000",
        description: `Start investing in a tax-efficient ISA wrapper with an initial goal of £5,000.`,
        icon: "📈",
      });
    }
  });

  const hasEmergencyFund = existingMilestones.some(
    (m) =>
      m.name.toLowerCase().includes("emergency") ||
      m.name.toLowerCase().includes("rainy day"),
  );

  if (!hasEmergencyFund) {
    suggestions.push({
      name: `Emergency Fund`,
      accountType: "GIA",
      targetValue: "10000",
      description: `Build a 3-6 month emergency fund for unexpected expenses.`,
      icon: "☂️",
    });
  }

  const hasAnnualTarget = existingMilestones.some(
    (m) =>
      m.name.toLowerCase().includes("annual") ||
      m.name.toLowerCase().includes("yearly"),
  );

  if (!hasAnnualTarget) {
    const estimatedAnnualIncome = totalValue * 0.4;
    const contributionTarget = Math.round(estimatedAnnualIncome * 0.12);

    if (contributionTarget > 1000) {
      suggestions.push({
        name: `Annual Contribution Target`,
        accountType: null,
        targetValue: contributionTarget.toString(),
        description: `Aim to invest £${formatNumberShort(
          contributionTarget,
        )} this year to stay on track with your long-term goals.`,
        icon: "📅",
      });
    }
  }

  return suggestions.slice(0, 5);
}

function generateNextMilestones(currentValue: number, count = 3): number[] {
  const milestones = [];
  let nextMilestone;

  if (currentValue < 1000) {
    nextMilestone = 1000;
  } else if (currentValue < 5000) {
    nextMilestone = 5000;
  } else if (currentValue < 10000) {
    nextMilestone = 10000;
  } else if (currentValue < 25000) {
    nextMilestone = 25000;
  } else if (currentValue < 50000) {
    nextMilestone = 50000;
  } else if (currentValue < 100000) {
    nextMilestone = 100000;
  } else if (currentValue < 250000) {
    nextMilestone = 250000;
  } else if (currentValue < 500000) {
    nextMilestone = 500000;
  } else if (currentValue < 1000000) {
    nextMilestone = 1000000;
  } else {
    nextMilestone = Math.ceil(currentValue / 1000000) * 1000000;
  }

  milestones.push(nextMilestone);

  for (let i = 1; i < count; i++) {
    if (!milestones[i - 1]) {
      continue;
    }
    let nextValue: number = milestones[i - 1]!;

    if (nextValue < 10000) {
      nextValue += 5000;
    } else if (nextValue < 100000) {
      nextValue += 25000;
    } else if (nextValue < 1000000) {
      nextValue += 100000;
    } else {
      nextValue += 500000;
    }

    milestones.push(nextValue);
  }

  return milestones;
}

function formatNumberShort(num: number): string {
  if (num >= 1000000) {
    return (
      (num / 1000000).toLocaleString(undefined, {
        maximumFractionDigits: 1,
      }) + "M"
    );
  }
  if (num >= 1000) {
    return (
      (num / 1000).toLocaleString(undefined, {
        maximumFractionDigits: 1,
      }) + "k"
    );
  }
  return num.toLocaleString();
}

function getAccountIcon(accountType: string): string {
  switch (accountType) {
    case "ISA":
      return "🛡️";
    case "SIPP":
      return "🧓";
    case "LISA":
      return "🏠";
    case "GIA":
      return "💼";
    default:
      return "💰";
  }
}

export const getNextMilestone = (
  milestones: Milestone[],
  totalPortfolioValue: number,
) => {
  return milestones
    .filter((m) => !m.accountType && !m.isCompleted)
    .sort((a, b) => Number(a.targetValue) - Number(b.targetValue))
    .find((m) => Number(m.targetValue) > totalPortfolioValue);
};
