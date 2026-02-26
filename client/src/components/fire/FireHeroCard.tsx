import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useChartDimensions } from "@/hooks/use-chart-dimensions";
import { useFireHeroChart } from "@/hooks/use-fire-hero-chart";
import { aggregateContributorBreakdownByAccountType } from "@shared/utils/projection-account-type-breakdown";
import { FireHeroHeader } from "./FireHeroHeader";
import { FireHeroLegend } from "./FireHeroLegend";
import {
  FireScenarioSelector,
  type FireScenario,
} from "./FireScenarioSelector";
import type { ContributorProjection, FireProjectionData } from "@shared/schema/projections";
import type { DecimalValueString } from "@shared/schema";

type FireHeroCardProps = {
  projectedValue: number;
  projectedRetirementAge: number | null;
  targetRetirementAge: number;
  fireNumber: number;
  fireNumberDecimal: DecimalValueString;
  contributorBreakdown: ContributorProjection[];
  dateOfBirth: Date;

  activeScenario: FireScenario | null;
  activeGrowthRate: number | null;
  baseGrowthRate: number;
  onScenarioSelect: (scenario: FireScenario, rate: number) => void;
  onScenarioReset: () => void;

  className?: string;
};

export function FireHeroCard({
  projectedValue,
  projectedRetirementAge,
  targetRetirementAge,
  fireNumber,
  fireNumberDecimal,
  contributorBreakdown,
  dateOfBirth,
  activeScenario,
  activeGrowthRate,
  baseGrowthRate,
  onScenarioSelect,
  onScenarioReset,
  className,
}: FireHeroCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dimensions = useChartDimensions(containerRef, {
    height: 220,
    marginLeft: 8,
    marginRight: 8,
    marginTop: 24,
    marginBottom: 28,
  });

  const chartData: Map<string, FireProjectionData[]> =
    aggregateContributorBreakdownByAccountType(
      contributorBreakdown,
      dateOfBirth,
      fireNumberDecimal
    );

  const legendValues = useFireHeroChart({
    svgRef,
    dimensions,
    chartData,
    fireNumber,
    targetRetirementAge,
    projectedRetirementAge,
  });

  return (
    <Card
      className={cn("overflow-hidden ambient-glow", className)}
      style={{
        background: "linear-gradient(160deg, oklch(0.22 0.04 245) 0%, oklch(0.16 0.04 240) 100%)",
        "--glow-color-a": "rgba(96,165,250,0.35)",
        "--glow-color-b": "rgba(167,139,250,0.28)",
        "--glow-color-c": "rgba(52,211,153,0.22)",
      } as React.CSSProperties}
    >
      <CardContent className="p-4 flex flex-col gap-4">
        <FireHeroHeader
          projectedValue={projectedValue}
          projectedRetirementAge={projectedRetirementAge}
          targetRetirementAge={targetRetirementAge}
        />

        <FireScenarioSelector
          activeScenario={activeScenario}
          activeGrowthRate={activeGrowthRate}
          baseGrowthRate={baseGrowthRate}
          onSelect={onScenarioSelect}
          onReset={onScenarioReset}
        />

        <div ref={containerRef} className="w-full h-[220px]">
          <svg ref={svgRef} width="100%" height="100%" />
        </div>

        <FireHeroLegend legendValues={legendValues} />
      </CardContent>
    </Card>
  );
}
