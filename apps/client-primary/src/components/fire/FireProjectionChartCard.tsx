import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import FireChart from "@/components/charts/FireChart";
import FireChart from "@/components/charts/FireChartD3";
import type { FireProjectionData } from "@milestone/js-common/schema/projections";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";

type FireProjectionChartCardProps = {
  showChart: boolean;
  onToggle: () => void;
  projectionData: FireProjectionData[];
  yearsToFire: number;
  chartConfig: ComponentProps<typeof FireChart>["config"];
  targetRetirementAge: number;
  projectedRetirementAge: number | null;
};

export function FireProjectionChartCard({
  showChart,
  onToggle,
  projectionData,
  yearsToFire,
  chartConfig,
  targetRetirementAge,
  projectedRetirementAge,
}: FireProjectionChartCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-medium">
            Projection Chart
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualise your portfolio growth, retirement target, and
            accessibility.
          </p>
          {!showChart && (
            <Badge variant="secondary">Hidden by preference</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {showChart ? "Hide Chart" : "Show Chart"}
        </Button>
      </CardHeader>
      <CardContent>
        <div
          className={`transition-all duration-300 ${
            showChart
              ? "opacity-100 translate-y-0 max-h-[1200px] mt-4"
              : "opacity-0 -translate-y-2 max-h-0 mt-0 pointer-events-none"
          }`}
        >
          {showChart && projectedRetirementAge !== null ? (
            <FireChart
              projectionData={projectionData}
              yearsToFire={yearsToFire}
              config={chartConfig}
              targetRetirementAge={targetRetirementAge}
              projectedRetirementAge={projectedRetirementAge}
              className="mb-6"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

