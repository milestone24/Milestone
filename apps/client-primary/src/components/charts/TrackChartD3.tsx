import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FireProjectionData } from "@milestone/js-common/schema/projections";
import { useChartDimensions } from "@/hooks/use-chart-dimensions";
import { useTrackChartData } from "@/hooks/use-track-chart-data";
import { useTrackChartScales } from "@/hooks/use-track-chart-scales";
import { useTrackChartRender } from "@/hooks/use-track-chart-render";

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

export type TrackChartD3Props = {
  targetAge: number;
  targetAmount: number;
  currentAge: number;
  currentAmount: number;
  projectionData?: FireProjectionData[];
  className?: string;
  curve?: CurveType;
};

export default function TrackChartD3({
  targetAge,
  targetAmount,
  currentAge,
  currentAmount,
  projectionData,
  className,
  curve = "monotoneX",
}: TrackChartD3Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dimensions = useChartDimensions(containerRef);
  const processedData = useTrackChartData({
    targetAge,
    targetAmount,
    currentAge,
    currentAmount,
    projectionData,
  });
  const scales = useTrackChartScales(dimensions, processedData);

  useTrackChartRender({
    svgRef,
    dimensions,
    scales,
    processedData,
    curve,
  });

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
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
