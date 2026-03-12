import type { WithdrawalPhase } from "@shared/schema/projections";
import { WithdrawalPhaseCard } from "./WithdrawalPhaseCard";

type WithdrawalPhasesProps = {
  phases: WithdrawalPhase[];
  showPhaseLegends?: boolean;
};

export function WithdrawalPhases({ phases, showPhaseLegends = false }: WithdrawalPhasesProps) {
  if (!phases.length) return null;

  return (
    <section>
      <h3 className="mb-4 text-sm font-medium">Withdrawal Strategy</h3>
      <div className="space-y-6">
        {phases.map((phase, index) => (
          <WithdrawalPhaseCard
            key={`phase-${phase.fromAge}-${index}`}
            phase={phase}
            showLegend={showPhaseLegends}
          />
        ))}
      </div>
    </section>
  );
}
