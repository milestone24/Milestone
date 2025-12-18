import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { WithdrawalStrategy } from "@shared/schema/projections";
import { AccountAccessTimeline } from "./AccountAccessTimeline";
import { AccountAccessCard } from "./AccountAccessCard";
import { WithdrawalPhaseCard } from "./WithdrawalPhaseCard";
import { Separator } from "../ui/separator";

type WithdrawalStrategyCardProps = {
  withdrawalStrategy: WithdrawalStrategy | undefined;
};

export function WithdrawalStrategyCard({
  withdrawalStrategy,
}: WithdrawalStrategyCardProps) {
  if (!withdrawalStrategy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Calendar className="h-5 w-5" />
            Account Access & Withdrawal Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Withdrawal strategy is not available. Please ensure you have
            contributors configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { phases, accountAccessTimeline, warnings } = withdrawalStrategy;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Calendar className="h-5 w-5" />
          Account Access & Withdrawal Strategy
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          When accounts unlock and how you'll draw from them
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account Access Timeline */}
        <section>
          <AccountAccessTimeline entries={accountAccessTimeline} />
        </section>

        <Separator />

        {/* Account Access Cards */}
        <section className="space-y-3">
          {accountAccessTimeline.map((entry, index) => (
            <AccountAccessCard
              key={`${entry.contributorName}-${index}`}
              entry={entry}
            />
          ))}
        </section>

        <Separator />

        {/* Withdrawal Strategy Phases */}
        <section>
          <h3 className="mb-4 text-sm font-medium">Withdrawal Strategy</h3>
          <div className="space-y-6">
            {phases.map((phase, index) => (
              <WithdrawalPhaseCard
                key={`phase-${phase.fromAge}-${index}`}
                phase={phase}
              />
            ))}
          </div>
        </section>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <>
            <Separator />
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-amber-600">Warnings</h3>
              {warnings.map((warning, index) => (
                <p key={index} className="text-sm text-muted-foreground">
                  {warning}
                </p>
              ))}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
