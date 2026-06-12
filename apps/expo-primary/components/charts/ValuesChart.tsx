import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Svg, { G, Line, Path, Text as SvgText } from "react-native-svg";
import * as d3 from "d3";
import {
  useChartData,
  type ChartData,
} from "@milestone/js-common/react/hooks/use-chart-data";
import { useChartScales } from "@milestone/js-common/react/hooks/use-chart-scales";
import { useChartDimensions } from "@/hooks/use-chart-dimensions";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type { ChartData };

type ValuesChartProps = {
  className?: string;
  data: ChartData;
};

function buildLinePath(
  seriesData: { timestamp?: number; valueDate: string | Date; value: string | number }[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>
): string {
  const line = d3
    .line<{ timestamp?: number; valueDate: string | Date; value: string | number }>()
    .x((d) => {
      const ts =
        d.timestamp ?? new Date(d.valueDate).getTime();
      return xScale(ts);
    })
    .y((d) => yScale(Number(d.value)))
    .curve(d3.curveMonotoneX);

  return line(seriesData) ?? "";
}

export default function ValuesChart({ className, data }: ValuesChartProps) {
  const dimensions = useChartDimensions({ height: 240 });
  const processedData = useChartData(data);
  const scales = useChartScales(dimensions, processedData);
  const isAnyDatasetLoading = data.some((s) => s.isLoading);

  const seriesPaths = useMemo(() => {
    return data
      .filter((series) => series.data && series.data.length > 0)
      .map((series) => ({
        id: series.id,
        color: series.color,
        path: buildLinePath(series.data!, scales.xScale, scales.yScale),
      }));
  }, [data, scales]);

  const yTicks = scales.yScale.ticks(5);
  const xTicks = scales.xScale.ticks(5);

  return (
    <Card className={cn("w-full", className)}>
      <CardContent>
        {isAnyDatasetLoading ? (
          <View className="h-[240px] items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <View className="h-[240px] w-full">
            <Svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
              <G x={dimensions.marginLeft} y={dimensions.marginTop}>
                {yTicks.map((tick) => (
                  <G key={`y-${tick}`}>
                    <Line
                      x1={0}
                      x2={dimensions.boundedWidth}
                      y1={scales.yScale(tick)}
                      y2={scales.yScale(tick)}
                      stroke="#e4e4e7"
                      strokeDasharray="4 4"
                    />
                    <SvgText
                      x={-8}
                      y={scales.yScale(tick)}
                      fontSize={10}
                      fill="#71717a"
                      textAnchor="end"
                      alignmentBaseline="middle"
                    >
                      £{(tick / 1000).toFixed(0)}k
                    </SvgText>
                  </G>
                ))}
                {xTicks.map((tick) => (
                  <SvgText
                    key={`x-${tick}`}
                    x={scales.xScale(tick)}
                    y={dimensions.boundedHeight + 16}
                    fontSize={10}
                    fill="#71717a"
                    textAnchor="middle"
                  >
                    {new Date(tick).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "2-digit",
                    })}
                  </SvgText>
                ))}
                {seriesPaths.map((series) => (
                  <Path
                    key={series.id}
                    d={series.path}
                    fill="none"
                    stroke={series.color || "#3b82f6"}
                    strokeWidth={2}
                  />
                ))}
              </G>
            </Svg>
          </View>
        )}
        <View className="flex-row flex-wrap gap-3 mt-3">
          {data.map((series) => (
            <View key={series.id} className="flex-row items-center gap-2">
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: series.color || "#3b82f6" }}
              />
              <Text className="text-xs text-muted-foreground">{series.name}</Text>
              {"error" in series && series.error ? (
                <Text className="text-xs text-destructive">Error</Text>
              ) : null}
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}
