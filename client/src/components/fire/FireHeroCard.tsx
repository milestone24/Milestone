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

  const dimensions = useChartDimensions(containerRef, { height: 220 });

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
        "--glow-color-a": "color-mix(in oklch, var(--color-sipp) 15%, transparent)",
        "--glow-color-b": "color-mix(in oklch, var(--color-isa) 12%, transparent)",
        "--glow-color-c": "color-mix(in oklch, var(--color-lisa) 10%, transparent)",
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
