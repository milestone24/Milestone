import { TrendingUp } from "lucide-react";
import { WithdrawalPhase } from "@shared/schema/projections";

type WithdrawalPhaseCardProps = {
  phase: WithdrawalPhase;
};

const formatCurrency = (value: string | number) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(numValue);
};

// Account type colors — preset from Tailwind theme (same as FireAccountsSummaryCard, FireAccountTypeContributionAdjuster)
const ACCOUNT_TYPE_BG: Record<string, string> = {
  ISA: "bg-isa",
  SIPP: "bg-sipp",
  LISA: "bg-lisa",
  GIA: "bg-gia",
  OTHER: "bg-other",
  PENSION: "bg-pension",
};

const FALLBACK_BG = "bg-primary";

const getAccountTypeBg = (accountType: string): string =>
  ACCOUNT_TYPE_BG[accountType?.toUpperCase() ?? ""] ?? FALLBACK_BG;

export function WithdrawalPhaseCard({ phase }: WithdrawalPhaseCardProps) {
  const ageRange = phase.toAge
    ? `Age ${phase.fromAge}-${phase.toAge}`
    : `Age ${phase.fromAge}+`;

  const isBuildingPhase = phase.phaseType === "building";
  const totalAllocation = phase.allocations.reduce(
    (sum, a) => sum + parseFloat(a.annualAmount),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{ageRange}</span>
        {isBuildingPhase ? (
          <span className="text-sm text-muted-foreground">Building phase</span>
        ) : (
          <span className="text-sm font-medium">
            {formatCurrency(phase.annualIncomeTarget)}/year
          </span>
        )}
      </div>

      {isBuildingPhase ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Accumulating</span>
        </div>
      ) : (
        <>
          {/* Stacked allocation bar */}
          <div className="flex h-10 w-full overflow-hidden rounded-md">
            {phase.allocations.map((allocation, index) => {
              const percentage =
                (parseFloat(allocation.annualAmount) / totalAllocation) * 100;
              return (
                <div
                  key={`${allocation.contributorName}-${index}`}
                  className={`${getAccountTypeBg(allocation.accountType)} flex items-center justify-center text-xs font-medium text-white`}
                  style={{ width: `${percentage}%` }}
                  title={`${allocation.accountType}: ${formatCurrency(
                    allocation.annualAmount
                  )}`}
                >
                  {percentage > 15 && (
                    <span>
                      {allocation.accountType}:{" "}
                      {formatCurrency(allocation.annualAmount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend for small segments */}
          {phase.allocations.some(
            (a) => (parseFloat(a.annualAmount) / totalAllocation) * 100 <= 15
          ) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {phase.allocations.map((allocation, index) => (
                <div
                  key={`legend-${allocation.contributorName}-${index}`}
                  className="flex items-center gap-1"
                >
                  <div
                    className={`h-3 w-3 rounded-sm ${getAccountTypeBg(allocation.accountType)}`}
                  />
                  <span>
                    {allocation.accountType}:{" "}
                    {formatCurrency(allocation.annualAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {phase.warnings && phase.warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {phase.warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}
