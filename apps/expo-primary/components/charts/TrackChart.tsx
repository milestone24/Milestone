import { useMemo } from "react";
import { View } from "react-native";
import Svg, { G, Line, Path, Text as SvgText } from "react-native-svg";
import * as d3 from "d3";
import type { FireProjectionData } from "@milestone/js-common/schema/projections";
import { useTrackChartData } from "@milestone/js-common/react/hooks/use-track-chart-data";
import { useTrackChartScales } from "@milestone/js-common/react/hooks/use-track-chart-scales";
import { useChartDimensions } from "@/hooks/use-chart-dimensions";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type TrackChartProps = {
  targetAge: number;
  targetAmount: number;
  currentAge: number;
  currentAmount: number;
  projectionData?: FireProjectionData[];
  className?: string;
};

export default function TrackChart({
  targetAge,
  targetAmount,
  currentAge,
  currentAmount,
  projectionData,
  className,
}: TrackChartProps) {
  const dimensions = useChartDimensions({ height: 240 });
  const processedData = useTrackChartData({
    targetAge,
    targetAmount,
    currentAge,
    currentAmount,
    projectionData,
  });
  const scales = useTrackChartScales(dimensions, processedData);
  const [primaryColor = "#3b82f6", positiveColor = "#22c55e"] = useThemeColors([
    "--primary",
    "--positive",
  ]);

  const projectedPath = useMemo(() => {
    const line = d3
      .line<{ age: number; projected: number }>()
      .x((d) => scales.xScale(d.age))
      .y((d) => scales.yScale(d.projected))
      .curve(d3.curveMonotoneX);

    return line(processedData.chartData) ?? "";
  }, [processedData.chartData, scales]);

  const targetY = scales.yScale(targetAmount);

  return (
    <Card className={cn("w-full", className)}>
      <CardContent>
        <View className="h-[240px] w-full">
          <Svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
            <G x={dimensions.marginLeft} y={dimensions.marginTop}>
              <Line
                x1={0}
                x2={dimensions.boundedWidth}
                y1={targetY}
                y2={targetY}
                stroke={positiveColor}
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
              <Path
                d={projectedPath}
                fill="none"
                stroke={primaryColor}
                strokeWidth={2.5}
              />
              <SvgText
                x={dimensions.boundedWidth - 4}
                y={targetY - 6}
                fontSize={10}
                fill={positiveColor}
                textAnchor="end"
              >
                Target
              </SvgText>
              <SvgText
                x={scales.xScale(currentAge)}
                y={scales.yScale(currentAmount) - 8}
                fontSize={10}
                fill={primaryColor}
                textAnchor="middle"
              >
                Now
              </SvgText>
            </G>
          </Svg>
        </View>
      </CardContent>
    </Card>
  );
}
