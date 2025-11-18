import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type FireSummarySectionProps = {
  currentPortfolioValue: number;
  fireNumber: number;
  annualIncomeGoal: number;
  withdrawalRate: number;
  projectedRetirementAge: number | null;
  targetRetirementAge: number;
  yearsToFire: number;
  statePensionAge: number;
  firstAccessibleAge?: number;
  accessibleValueAtRetirement?: number;
  lockedValueAtRetirement?: number;
  monthlyShortfall?: number;
  progressPercentage: number;
  previewActive: boolean;
  customContributorsActive: boolean;
  contributionBreakdown: Array<{ accountType: string; amount: number }>;
  statePensionIncluded: boolean;
};

const formatYears = (value?: number) =>
  value !== undefined && Number.isFinite(value)
    ? `${Math.round(value)} years`
    : "—";

export function FireSummarySection({
  currentPortfolioValue,
  fireNumber,
  annualIncomeGoal,
  withdrawalRate,
  projectedRetirementAge,
  targetRetirementAge,
  yearsToFire,
  statePensionAge,
  firstAccessibleAge,
  accessibleValueAtRetirement,
  lockedValueAtRetirement,
  monthlyShortfall,
  progressPercentage,
  previewActive,
  customContributorsActive,
  contributionBreakdown,
  statePensionIncluded,
}: FireSummarySectionProps) {
  const variance = projectedRetirementAge
    ? projectedRetirementAge - targetRetirementAge
    : undefined;
  const ahead = variance ? variance < 0 : false;
  const behind = variance ? variance > 0 : false;

  const retirementStatusBadge = ahead
    ? "Ahead"
    : behind
    ? "Behind"
    : "On track";
  const retirementBadgeVariant = ahead
    ? "default"
    : behind
    ? "destructive"
    : "secondary";

  const shortfallBadge =
    monthlyShortfall && monthlyShortfall > 0
      ? {
          label: `Shortfall £${monthlyShortfall.toLocaleString()}/mo`,
          variant: "destructive" as const,
        }
      : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Retirement status
            </CardTitle>
            <Badge variant={retirementBadgeVariant}>
              {retirementStatusBadge}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Projected vs target retirement age with current assumptions.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Projected retirement age</span>
            <span className="font-medium text-foreground">
              {projectedRetirementAge
                ? formatYears(projectedRetirementAge)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Target retirement age</span>
            <span className="font-medium text-foreground">
              {formatYears(targetRetirementAge)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Variance</span>
            <span className="font-medium text-foreground">
              {variance === 0
                ? "On target"
                : `${Math.abs(Math.round(variance ?? 0))} years ${
                    variance ? (variance < 0 ? "earlier" : "later") : "—"
                  }`}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Progress towards FIRE number</span>
              <span className="font-medium text-foreground">
                {progressPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={progressPercentage} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Time to FIRE</span>
            <span className="font-medium text-foreground">
              {yearsToFire > 0
                ? `${Math.round(yearsToFire)} years remaining`
                : yearsToFire < 0
                ? `Ahead by ${Math.abs(Math.round(yearsToFire))} years`
                : "At target"}
            </span>
          </div>
          {previewActive && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-muted-foreground">
              Preview adjustments currently active. Remember to switch back to
              live settings to see your baseline trajectory.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Withdrawal readiness
            </CardTitle>
            {shortfallBadge ? (
              <Badge variant={shortfallBadge.variant}>
                {shortfallBadge.label}
              </Badge>
            ) : (
              <Badge variant="secondary">On track</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Understand when funds become accessible and how sustainable
            withdrawals look.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>First accessible age</span>
            <span className="font-medium text-foreground">
              {firstAccessibleAge
                ? `${firstAccessibleAge} years`
                : "Following account-specific release rules"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>State pension age (est.)</span>
            <span className="font-medium text-foreground">
              {formatYears(statePensionAge)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>State pension included</span>
            <span className="font-medium text-foreground">
              {statePensionIncluded ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Annual income goal</span>
            <span className="font-medium text-foreground">{`£${annualIncomeGoal.toLocaleString()}`}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Safe withdrawal rate</span>
            <span className="font-medium text-foreground">
              {`${withdrawalRate.toFixed(2)}%`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Contribution plan
            </CardTitle>
            <Badge variant="secondary">
              {contributionBreakdown.length > 0
                ? `${contributionBreakdown.length} account${
                    contributionBreakdown.length === 1 ? "" : "s"
                  }`
                : "No data"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Monthly contribution preview grouped by account type (including
            custom scenarios).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {contributionBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contributor data available. Add assets or custom preview
              contributors to see the breakdown.
            </p>
          ) : (
            <ul className="space-y-2">
              {contributionBreakdown.map((item) => (
                <li
                  key={item.accountType}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {item.accountType}
                  </span>
                  <span className="font-semibold text-foreground">
                    £{item.amount.toLocaleString()}/mo
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card> */}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Access breakdown
            </CardTitle>
            <Badge variant="secondary">
              FIRE number {`£${fireNumber.toLocaleString()}`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Snapshot of accessible vs locked value at your projected retirement
            age.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Portfolio today</span>
            <span className="font-medium text-foreground">
              {`£${currentPortfolioValue.toLocaleString()}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Accessible at retirement</span>
            <span className="font-medium text-foreground">
              {`£${accessibleValueAtRetirement?.toLocaleString()}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Locked at retirement</span>
            <span className="font-medium text-foreground">
              {`£${lockedValueAtRetirement?.toLocaleString()}`}
            </span>
          </div>
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 p-3 text-xs text-muted-foreground">
            Locked value covers accounts with age-based release rules (e.g. SIPP
            or LISA). Accessible amounts include unrestricted ISAs, GIAs, and
            cash holdings.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
