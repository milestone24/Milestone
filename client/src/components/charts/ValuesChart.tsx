import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AssetValueTimePoint,
  AssetValueMetadata,
  Milestone,
  CombinedDayTimePointBase,
  TransactionTimePoint,
} from "shared/schema";
import { useProcesses } from "@/hooks/use-processes";
import numabbr from "numabbr";
import { PosNegNumber } from "../common/PosNegNumber";

type ChartDataBase = CombinedDayTimePointBase;

type AssetValueChartData = AssetValueTimePoint & {
  timestamp: number;
  milestone?: number;
  achievedMilestone?: {
    name: string;
    targetValue: number;
  };
  metadata?: AssetValueMetadata[];
};

type TransactionChartData = TransactionTimePoint & {
  timestamp: number;
};

// Calculate the maximum Y-axis value
const getMaxYValue = (
  chartData: ChartData,
  showMilestonesLocal?: boolean,
  milestones?: Milestone[]
) => {
  const maximums = chartData.map((s) =>
    Math.max(...s.data.map((d) => Number(d.value)))
  );

  return Math.max(...maximums);

  // if (!showMilestonesLocal || !milestones) return maxPortfolioValue;

  // const maxMilestoneValue = Math.max(
  //   ...milestones.map((m) => Number(m.targetValue))
  // );
  // return Math.max(maxPortfolioValue, maxMilestoneValue) * 1.1; // Add 10% padding
};

const valueDateFormatter = (value: string | Date) => {
  const toString = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  return typeof value === "string"
    ? toString(new Date(value))
    : toString(value);
};

// const isCombinedValueHistory = (
//   historyData: CombinedValueHistory | AssetValueTimePoint[]
// ): historyData is CombinedValueHistory => {
//   return (
//     "valueHistory" in historyData &&
//     Array.isArray(historyData.valueHistory) &&
//     "transactions" in historyData &&
//     Array.isArray(historyData.transactions)
//   );
// };

// const isAssetHistoryTimePoint = (
//   historyData: CombinedValueHistory | AssetValueTimePoint[]
// ): historyData is AssetValueTimePoint[] => {
//   return Array.isArray(historyData);
// };

export type ChartDataItem = {
  id: string;
  name: string;
  data: CombinedDayTimePointBase[];
  color: string;
};

export type ChartData = ChartDataItem[];

type ChartMilestone = {
  id: string;
  targetValue: number;
  name: string;
  isCompleted: boolean;
};

type ValuesChartProps = {
  className?: string;
  data: ChartData;
  milestones?: ChartMilestone[];
};

export default memo(({ className, data, milestones }: ValuesChartProps) => {
  const [chartVisible, setChartVisible] = useState(true);
  const [showMilestonesLocal, setShowMilestonesLocal] = useState(true);
  const [selectedPoints, setSelectedPoints] = useState<
    CombinedDayTimePointBase[] | null
  >(null);

  const maxValue = useMemo(
    () => getMaxYValue(data),
    [data, showMilestonesLocal, milestones]
  );

  return (
    <div
      className={cn("w-full md:bg-white md:border md:rounded-lg", className)}
    >
      <div className="">
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-3">
            {/* <div className="flex items-center">
              <span className="text-sm text-neutral-700 mr-2">Chart</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  id="toggle-chart"
                  checked={chartVisible}
                  onChange={() => setChartVisible(!chartVisible)}
                  className="sr-only"
                />
                <label
                  htmlFor="toggle-chart"
                  className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                >
                  <span
                    className={cn(
                      "block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out",
                      chartVisible ? "translate-x-4" : ""
                    )}
                  ></span>
                </label>
              </div>
            </div> */}
            {/* {chartVisible && (
              <div className="flex items-center">
                <span className="text-sm text-neutral-700 mr-2">
                  Milestones
                </span>
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-milestones"
                    checked={showMilestonesLocal}
                    onChange={() =>
                      setShowMilestonesLocal(!showMilestonesLocal)
                    }
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-milestones"
                    className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out",
                        showMilestonesLocal ? "translate-x-4" : ""
                      )}
                    ></span>
                  </label>
                </div>
              </div>
            )} */}
          </div>
        </div>

        {chartVisible && (
          <>
            <div className="chart-container w-full mb-5 px-2">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  onClick={(data) => {
                    if (data && data.activePayload) {
                      setSelectedPoints(
                        data.activePayload.map(
                          (p) => p.payload as CombinedDayTimePointBase
                        )
                      );
                    }
                  }}


                  // onClick={(data) => {
                  //   if (data && data.activePayload) {
                  //     alert(JSON.stringify(data.activePayload));
                  //   }
                  // }}
                  //data={multiChartData}
                  //data={transactionChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f0f0f0"

                  />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    axisLine={false}
                    tickLine={false}

                    tick={{ fontSize: 10 }}
                    domain={["dataMin", "dataMax"]}
                    allowDuplicatedCategory={false}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })
                    }
                  />
                  {/* <YAxis
                    tickFormatter={(value) => `£${numabbr(value)}`}
                    axisLine={false}
                    tickLine={false}
                    accentHeight={0.5}
                    tick={{ fontSize: 10 }}
                    domain={[
                      0,
                      getMaxYValue(
                        valuesChartData,
                        showMilestonesLocal,
                        milestones
                      ),
                    ]}
                  /> */}
                  {/* <XAxis
                    dataKey="valueDate"
                    type="number"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })
                    }
                    domain={["dataMin", "dataMax"]}
                    //domain={["auto", "auto"]}
                    //allowDuplicatedCategory={false}
                  /> */}
                  <YAxis
                    dataKey="value"
                    tickFormatter={(value) => `£${numabbr(value)}`}
                    domain={[0, maxValue]}
                  />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      const data = props.payload as ChartDataBase;

                      const items = [
                        [`£${value.toLocaleString()}`, "Portfolio Value"],
                      ];

                      // if (data.achievedMilestone) {
                      //   items.push([
                      //     `£${data.achievedMilestone.targetValue.toLocaleString()}`,
                      //     `Milestone: ${data.achievedMilestone.name}`,
                      //   ]);
                      // }

                      return items;
                    }}
                    cursor={{
                      stroke: "#3B82F6",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                    isAnimationActive={false}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      padding: "0.5rem",
                    }}
                    labelStyle={{
                      color: "#374151",
                      fontWeight: 500,
                    }}
                    content={({ active, payload }) => {
                      return active && payload && payload.length ? (
                        <>
                          {payload.map((p, index) => {
                            const data = p.payload as ChartDataBase;
                            const date = new Date(data.valueDate);
                            return (
                              <div
                                className="bg-gray-100 border-none rounded-lg p-2 shadow-sm"
                                key={index}
                              >
                                {/* <p className="font-medium text-gray-900">
                                {data.valueDate.}
                              </p> */}
                                <p className="text-gray-700">
                                  £{data.value.toLocaleString()}
                                </p>
                                <p className="text-gray-700">
                                  {valueDateFormatter(data.valueDate)}
                                </p>
                                <p className="text-gray-700">
                                  {/* @ts-ignore */}
                                  {data.recordType}
                                </p>
                                {/* {data.achievedMilestone && (
                                <p className="text-green-600 font-medium flex items-center gap-1">
                                  <Check className="h-4 w-4" />
                                  {data.achievedMilestone.name}
                                </p>
                              )} */}
                              </div>
                            );
                          })}
                        </>
                      ) : null;
                    }}
                  />
                  {showMilestonesLocal &&
                    milestones &&
                    milestones.map((milestone) => (
                      <ReferenceLine
                        key={milestone.id}
                        y={Number(milestone.targetValue)}
                        stroke="#F59E0B"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        label={{
                          value: `£${Number(
                            milestone.targetValue
                          ).toLocaleString()}`,
                          position: "right",
                          fill: "#F59E0B",
                          fontSize: 12,
                        }}
                      />
                    ))}
                  {data.map((s) => (
                    <Line
                      dataKey="value"
                      data={s.data}
                      name={s.name}
                      key={s.name}
                      stroke={s.color}
                      animateNewValues={false}
                      animationDuration={0}
                      animationBegin={0}
                      dot={false}
                      activeDot={true}
                    />
                  ))}
                  {/* {dummyData.map((s) => (
                    <Line
                      dataKey="value"
                      data={s.data}
                      name={s.name}
                      key={s.name}
                    />
                  ))} */}
                  {/* <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#3B82F6" }}
                    activeDot={{ r: 5, fill: "#2563EB" }}
                    isAnimationActive={false}
                  /> */}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-row items-center justify-center gap-2">
                {data.map((s) => (
                  <div className="flex items-center" key={s.id}>
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <p className="text-xs text-gray-600">{s.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Date range controls are now provided globally by DateRangeContext */}

            {selectedPoints &&
              selectedPoints.map((point) => (
                <div
                  className="mt-4 p-4 bg-gray-50 rounded-lg border"
                  key={new Date(point.valueDate).getTime()}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      {/* <h3 className="font-medium text-lg">
                        {selectedPoint.date}
                      </h3> */}
                      <p className="text-sm text-gray-600">
                        Total Portfolio Value: £{point.value.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedPoints(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>

                  {/* {selectedPoint.achievedMilestone && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <h4 className="text-sm font-medium text-green-800 mb-1">
                        Milestone Achieved!
                      </h4>
                      <p className="text-sm text-green-700">
                        {selectedPoint.achievedMilestone.name} (£
                        {selectedPoint.achievedMilestone.targetValue.toLocaleString()}
                        )
                      </p>
                    </div>
                  )} */}

                  {point.changes && point.changes.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Account Changes
                      </h4>
                      <div className="space-y-2">
                        {point.changes.map((change, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center text-sm"
                          >
                            {/* <span className="text-gray-600 font-medium">
                              {getAccountName(change.assetId || "")}
                            </span> */}
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-500">
                                £{change.previousValue.toLocaleString()} → £
                                {change.newValue.toLocaleString()}
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

                  {/* {selectedPoint.metadata &&
                  selectedPoint.metadata.length > 0 && (
                    <>
                      <Accordion type="single" collapsible className="mt-4">
                        <AccordionItem value="metadata">
                          <AccordionTrigger>Metadata</AccordionTrigger>
                          <AccordionContent>
                            <div className="mt-4 p-3">
                              <pre className="text-sm text-gray-600 overflow-x-scroll">
                                {JSON.stringify(
                                  selectedPoint.metadata,
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </>
                  )} */}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
});
