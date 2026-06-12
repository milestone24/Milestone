import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { WithdrawalStrategy } from "@milestone/js-common/schema/projections";
import { WithdrawalPhases } from "./WithdrawalPhases";

type WithdrawalStrategyCardProps = {
  withdrawalStrategy: WithdrawalStrategy | undefined;
  showPhaseLegends?: boolean;
  showBuildPhase?: boolean;
};

export function WithdrawalStrategyCard({
  withdrawalStrategy,
  showPhaseLegends = false,
  showBuildPhase = false,
}: WithdrawalStrategyCardProps) {
  const { phases = [], warnings = [] } = withdrawalStrategy ?? {};

  if (!withdrawalStrategy) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Withdrawal strategy is not available. Please ensure you have
            contributors configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <WithdrawalPhases
          phases={phases}
          showPhaseLegends={showPhaseLegends}
          showBuildPhase={showBuildPhase}
        />

        {warnings.length > 0 && (
          <>
            <Separator />
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-amber-600">Warnings</h3>
              {warnings.map((warning, index) => (
                <p
                  key={index}
                  className="text-sm text-muted-foreground"
                >
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
