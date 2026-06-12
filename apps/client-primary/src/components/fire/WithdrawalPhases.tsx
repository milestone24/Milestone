import type { WithdrawalPhase } from "@milestone/js-common/schema/projections";
import { WithdrawalPhaseCard } from "./WithdrawalPhaseCard";

type WithdrawalPhasesProps = {
  phases: WithdrawalPhase[];
  showPhaseLegends?: boolean;
  showBuildPhase?: boolean;
};

export function WithdrawalPhases({
  phases,
  showPhaseLegends = false,
  showBuildPhase = false,
}: WithdrawalPhasesProps) {
  if (!phases.length) return null;

  const visiblePhases = showBuildPhase
    ? phases
    : phases.filter((phase) => phase.phaseType !== "building");

  return (
    <section>
      <h3 className="mb-4 text-sm font-medium">Withdrawal Strategy</h3>
      <div className="space-y-6">
        {visiblePhases.map((phase, index) => (
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
