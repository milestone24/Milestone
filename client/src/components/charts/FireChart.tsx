import { useState, useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea, Scatter } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FireProjectionData } from "@shared/schema/projections";

type FireProjectionConfig = {
  currentAmount: number;
  monthlyInvestment: number;
  expectedReturn: number;
  targetAmount: number;
  currentAge: number;
};

type FireChartProps = {
  targetRetirementAge: number;
  projectedRetirementAge: number;
  projectionData: FireProjectionData[];
  yearsToFire: number;
  config: FireProjectionConfig;
  className?: string;
};

export default function FireChart({
  targetRetirementAge,
  projectedRetirementAge,
  projectionData,
  yearsToFire,
  config,
  className,
}: FireChartProps) {
  const { currentAge } = config;
  const [showAccessibleValue, setShowAccessibleValue] = useState(true);

  // Check if any data points have accessibleValue
  const hasAccessibleValue = useMemo(() => {
    return projectionData.some((point) => point.accessibleValue !== undefined);
  }, [projectionData]);

  // Transform data to convert DecimalValueString to numbers for Recharts
  const chartData = useMemo(() => {
    return projectionData.map((point) => ({
      age: point.age,
      portfolio: Number(point.portfolio),
      target: Number(point.target),
      accessibleValue: point.accessibleValue ? Number(point.accessibleValue) : undefined,
      lockedValue: point.lockedValue ? Number(point.lockedValue) : undefined,
    }));
  }, [projectionData]);

  // console.log("cuurentAge", currentAge);
  // console.log("projectionData", projectionData);
  // console.log("yearsToFire", yearsToFire);
  // console.log("targetAmount", targetAmount);
  // console.log("expectedReturn", expectedReturn);
  // console.log("monthlyInvestment", monthlyInvestment);
  // console.log("currentAmount", currentAmount);

  // Format currency values
  const formatCurrency = (value: number) => {
    return `£${value.toLocaleString()}`;
  };

  // Determine retirement age based on when FIRE is achieved or user's target age (whichever comes first)
  const fireAchievedAge = Math.ceil(currentAge + yearsToFire);
  // Use the target retirement age if provided, otherwise use the calculated FIRE achievement age
  const retirementAge = targetRetirementAge || fireAchievedAge;

  // Find the exact retirement point or the closest one
  let retirementPoint = chartData.find(
    (point) => point.age === retirementAge
  );

  // If we don't have an exact match, find the closest point
  if (!retirementPoint && chartData.length > 0) {
    // Find the closest age point to the retirement age
    const closest = chartData.reduce((prev, curr) => {
      if (!prev) return curr;
      return Math.abs(curr.age - retirementAge) <
        Math.abs(prev.age - retirementAge)
        ? curr
        : prev;
    }, chartData[0] as typeof chartData[0] | undefined);

    // Create an interpolated point at the retirement age
    if (closest) {
      retirementPoint = {
        age: retirementAge,
        portfolio: closest.portfolio,
        target: closest.target,
        accessibleValue: closest.accessibleValue,
        lockedValue: closest.lockedValue,
      };
    }
  }

  // Create marker data for the retirement point
  // Scatter requires x, y coordinates
  const retirementMarker = retirementPoint
    ? [
        {
          x: retirementAge,
          y: retirementPoint.portfolio,
          // Keep these for tooltip formatting
          age: retirementAge,
          portfolio: retirementPoint.portfolio,
        },
      ]
    : [];

  // Generate reasonable ticks for the X axis (age)
  const xAxisTicks = [];
  // Start with current age
  xAxisTicks.push(currentAge);

  // Add the retirement age
  if (!xAxisTicks.includes(retirementAge)) {
    xAxisTicks.push(retirementAge);
  }

  // Add regular intervals up to projectedRetirementAge
  for (
    let age = Math.ceil(currentAge / 10) * 10;
    age <= projectedRetirementAge;
    age += 10
  ) {
    if (!xAxisTicks.includes(age)) {
      xAxisTicks.push(age);
    }
  }

  // Add age projectedRetirementAge if not already included
  if (!xAxisTicks.includes(projectedRetirementAge)) {
    xAxisTicks.push(projectedRetirementAge);
  }

  // Sort the ticks in ascending order
  xAxisTicks.sort((a, b) => a - b);

  // Calculate max value for Y axis formatting
  const maxValue = Math.max(...chartData.map((d) => d.portfolio));

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        {/* Toggle for accessible value if available */}
        {hasAccessibleValue && (
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
        <div className="chart-container h-[240px] w-full mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />

              {/* Add a reference area for the retirement phase */}
              <ReferenceArea
                x1={retirementAge}
                x2={projectedRetirementAge}
                fill="#f2f9ff"
                fillOpacity={0.9}
                strokeOpacity={0.8}
              />

              <XAxis
                dataKey="age"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                label={{ value: "Age", position: "insideBottom", offset: -5 }}
                ticks={xAxisTicks}
                domain={[currentAge, projectedRetirementAge]}
                allowDecimals={false}
                type="number"
              />
              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1000000) {
                    return `£${(value / 1000000).toFixed(1)}M`;
                  } else {
                    return `£${(value / 1000).toFixed(0)}k`;
                  }
                }}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name) => {
                  let formattedValue = "";
                  if (value >= 1000000) {
                    formattedValue = `£${(value / 1000000).toFixed(2)}M`;
                  } else {
                    formattedValue = `£${value.toLocaleString()}`;
                  }

                  // Customize label based on data series
                  let label = name;
                  if (name === "portfolio") {
                    label = "Total Portfolio";
                  } else if (name === "accessibleValue") {
                    label = "Accessible Value";
                  } else if (name === "target") {
                    label = "FIRE Target";
                  } else if (name === "marker") {
                    label = "Retirement Point";
                  }

                  return [formattedValue, label];
                }}
                labelFormatter={(age) => {
                  // Add special indicator if this is the retirement age
                  if (age === retirementAge) {
                    return `Age: ${age} (Retirement)`;
                  }
                  return `Age: ${age}`;
                }}
              />

              {/* Add a reference line for retirement age */}
              <ReferenceLine
                x={retirementAge}
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: targetRetirementAge
                    ? `Retirement at ${retirementAge}`
                    : `FIRE at ${retirementAge}`,
                  position: "top",
                  fill: "#10b981",
                  fontSize: 12,
                  fontWeight: "bold",
                }}
              />

              {/* Portfolio growth line - ending at retirement age */}
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="#3B82F6"
                strokeWidth={2}
                activeDot={{ r: 5 }}
                name="Total Portfolio"
                // Filter data points to only show up to retirement age
                data={chartData.filter(
                  (point) => point.age <= retirementAge
                )}
                dot={false}
              />
              {/* Accessible value line - shown if toggle is on and data exists */}
              {showAccessibleValue && hasAccessibleValue && (
                <Line
                  type="monotone"
                  dataKey="accessibleValue"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  activeDot={{ r: 5 }}
                  name="Accessible Value"
                  data={chartData.filter(
                    (point) => point.age <= retirementAge
                  )}
                  dot={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="target"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="FIRE Target"
              />

              {/* Add a Line specifically for the retirement point - as a single dot */}
              {retirementMarker.length > 0 && (
                <Line
                  name="Retirement Point"
                  data={retirementMarker}
                  dataKey="portfolio"
                  dot={{
                    r: 8,
                    fill: "#10b981",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 10 }}
                  stroke="none"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
