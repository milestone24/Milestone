import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FireProjectionData } from "@milestone/js-common/schema/projections";
import { useChartDimensions } from "@/hooks/use-chart-dimensions";
import { useFireChartData } from "@/hooks/use-fire-chart-data";
import { useFireChartScales } from "@/hooks/use-fire-chart-scales";
import { useFireChartRender } from "@/hooks/use-fire-chart-render";

export type CurveType =
  | "linear"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step"
  | "stepBefore"
  | "stepAfter"
  | "basis"
  | "cardinal"
  | "catmullRom";

type FireProjectionConfig = {
  currentAmount: number;
  monthlyInvestment: number;
  expectedReturn: number;
  targetAmount: number;
  currentAge: number;
};

export type FireChartD3Props = {
  targetRetirementAge: number;
  projectedRetirementAge: number;
  projectionData: FireProjectionData[];
  yearsToFire: number;
  config: FireProjectionConfig;
  className?: string;
  curve?: CurveType;
};

export default function FireChartD3({
  targetRetirementAge,
  projectedRetirementAge,
  projectionData,
  yearsToFire,
  config,
  className,
  curve = "monotoneX",
}: FireChartD3Props) {
  const { currentAge } = config;
  const [showAccessibleValue, setShowAccessibleValue] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dimensions = useChartDimensions(containerRef);
  const processedData = useFireChartData({
    projectionData,
    currentAge,
    targetRetirementAge,
    projectedRetirementAge,
    yearsToFire,
  });
  const scales = useFireChartScales(dimensions, processedData);

  useFireChartRender({
    svgRef,
    dimensions,
    scales,
    processedData,
    showAccessibleValue,
    targetRetirementAge,
    curve,
  });

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        {/* Toggle for accessible value if available */}
        {processedData.hasAccessibleValue && (
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccessibleValue(!showAccessibleValue)}
              className="text-xs"
            >
              {showAccessibleValue ? "Hide" : "Show"} Accessible Value
            </Button>
          </div>
        )}
        <div className="chart-container h-[240px] w-full mb-5" ref={containerRef}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ cursor: "default" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
