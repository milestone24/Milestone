import { useRef } from "react";
import { cn } from "@/lib/utils";
import { PosNegNumber } from "../common/PosNegNumber";
import { useChartDimensions } from "@/hooks/use-chart-dimensions";
import { useChartData, type ChartData } from "@/hooks/use-chart-data";
import { useChartScales } from "@/hooks/use-chart-scales";
import { useChartInteractions } from "@/hooks/use-chart-interactions";
import { useD3Render } from "@/hooks/use-d3-render";

// Re-export types for convenience
export type { ChartData, ChartDataItem } from "@/hooks/use-chart-data";

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

type ChartMilestone = {
  id: string;
  targetValue: number;
  name: string;
  isCompleted: boolean;
};

type ValuesChartD3Props = {
  className?: string;
  data: ChartData;
  milestones?: ChartMilestone[];
  curve?: CurveType;
};

const valueDateFormatter = (value: string | Date) => {
  const toString = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  return typeof value === "string" ? toString(new Date(value)) : toString(value);
};

export default function ValuesChartD3({
  className,
  data,
  milestones,
  curve = "monotoneX",
}: ValuesChartD3Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dimensions = useChartDimensions(containerRef);
  const processedData = useChartData(data);
  const scales = useChartScales(dimensions, processedData);
  const {
    tooltipData,
    selectedPoints,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    clearSelectedPoints,
  } = useChartInteractions(svgRef, data, scales, dimensions);

  useD3Render({
    svgRef,
    data,
    dimensions,
    scales,
    milestones,
    showMilestones: true,
    tooltipData,
    curve,
  });

  return (
    <div
      className={cn("w-full md:bg-card md:border md:rounded-lg", className)}
    >
      <div className="">
        <div className="chart-container w-full mb-5 px-2 relative" ref={containerRef}>
          <svg
            ref={svgRef}
            width="100%"
            height={240}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: "crosshair" }}
          />

          {/* Tooltip */}
          {tooltipData && (
            <div
              className="absolute bg-card border-none rounded-lg p-2 shadow-sm pointer-events-none"
              style={{
                left: tooltipData.x + 10,
                top: tooltipData.y - 10,
                transform: "translate(0, -100%)",
              }}
            >
              {tooltipData.points.map((point, index) => (
                <div key={index}>
                  <p className="text-foreground">
                    £{Number(point.data.value).toLocaleString()}
                  </p>
                  <p className="text-foreground">
                    {valueDateFormatter(point.data.valueDate)}
                  </p>
                  <p className="text-foreground">
                    {/* @ts-ignore */}
                    {point.data.recordType}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-row items-center justify-center gap-2">
          {data.map((s) => (
            <div className="flex items-center" key={s.id}>
              <div
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <p className="text-xs text-muted-foreground">{s.name}</p>
            </div>
          ))}
        </div>

        {/* Selected points detail panel */}
        {selectedPoints &&
          selectedPoints.map((point) => (
            <div
              className="mt-4 p-4 bg-muted rounded-lg border"
              key={new Date(point.valueDate).getTime()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Portfolio Value: £{Number(point.value).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={clearSelectedPoints}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>

              {point.changes && point.changes.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Account Changes
                  </h4>
                  <div className="space-y-2">
                    {point.changes.map((change, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center text-sm"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">
                            £{Number(change.previousValue).toLocaleString()} → £
                            {Number(change.newValue).toLocaleString()}
                          </span>
                          <PosNegNumber
                            value={Number(change.change)}
                            displayInPercentage={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
