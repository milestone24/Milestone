import React, { useState, useEffect, useRef } from "react";
import { RRulePattern, createRRulePattern } from "@shared/utils/scheduling";
import { FrequencySelector } from "./FrequencySelector";
import { DayOfWeekSelector } from "./DayOfWeekSelector";
import { DayOfMonthSelector } from "./DayOfMonthSelector";
import { NthOccurrenceSelector } from "./NthOccurrenceSelector";
import { RRulePreview } from "./RRulePreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "../ui/date-input";

export interface RRuleSchedulerProps {
  value?: string;
  onChange?: (rrule: string) => void;
  className?: string;
  showGeneratedRule?: boolean;
}

export type FrequencyType = "daily" | "weekly" | "monthly" | "yearly";

export type ScheduleConfig = {
  frequency: FrequencyType;
  interval: number;
  byDay?: string[]; // For weekly: ["MO", "TU"] etc.
  byMonthDay?: number; // For monthly: 1-31
  byDayOfMonth?: {
    // For monthly nth day: { day: "TU", nth: 2 }
    day: string;
    nth: number;
  };
  byMonth?: number; // For yearly: 1-12
  byMonthDayYearly?: number; // For yearly: 1-31
  endType: "never" | "on-date" | "after-executions";
  endDate?: Date;
  count?: number;
};

const defaultConfig: ScheduleConfig = {
  frequency: "monthly",
  interval: 1,
  endType: "never",
};

export const RRuleScheduler: React.FC<RRuleSchedulerProps> = ({
  value = "",
  onChange,
  className = "",
  showGeneratedRule = false,
}) => {
  const initialConfig = value ? parseRRuleToConfig(value) : defaultConfig;
  const [config, setConfig] = useState<ScheduleConfig>(initialConfig);

  // Track the last rrule string this component generated internally so Effect 1
  // can distinguish between external resets (e.g. edit mode form populate) and
  // echoes of our own onChange calls bouncing back through the parent form.
  const internalRRuleRef = useRef(generateRRuleFromConfig(initialConfig));

  // Re-sync config only when value changes to something we did not produce.
  useEffect(() => {
    if (value && value !== internalRRuleRef.current) {
      try {
        const parsed = parseRRuleToConfig(value);
        setConfig(parsed);
        internalRRuleRef.current = generateRRuleFromConfig(parsed);
      } catch (error) {
        console.warn("Failed to parse RRule:", error);
      }
    }
  }, [value]);

  const updateConfig = (updates: Partial<ScheduleConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    const newRRule = generateRRuleFromConfig(newConfig);
    internalRRuleRef.current = newRRule;
    onChange?.(newRRule);
  };

  return (
    <div className={`space-y-10 ${className}`}>
      <FrequencySelector
        frequency={config.frequency}
        interval={config.interval}
        onFrequencyChange={(frequency: FrequencyType) =>
          updateConfig({ frequency })
        }
        onIntervalChange={(interval: number) => updateConfig({ interval })}
      />

      {config.frequency === "weekly" && (
        <DayOfWeekSelector
          selectedDays={config.byDay || []}
          onChange={(byDay: string[]) => updateConfig({ byDay })}
        />
      )}

      {config.frequency === "monthly" && (
        <>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="monthly-day"
                name="monthly-type"
                checked={!config.byDayOfMonth}
                onChange={() => updateConfig({ byDayOfMonth: undefined })}
                className="h-4 w-4"
              />
              <label htmlFor="monthly-day" className="text-sm font-medium">
                On specific day of month
              </label>
            </div>
            {!config.byDayOfMonth && (
              <DayOfMonthSelector
                day={config.byMonthDay || 1}
                onChange={(byMonthDay: number) => updateConfig({ byMonthDay })}
              />
            )}

            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="monthly-nth"
                name="monthly-type"
                checked={!!config.byDayOfMonth}
                onChange={() =>
                  updateConfig({ byDayOfMonth: { day: "MO", nth: 1 } })
                }
                className="h-4 w-4"
              />
              <label htmlFor="monthly-nth" className="text-sm font-medium">
                On specific day of week (e.g., 2nd Tuesday)
              </label>
            </div>
            {config.byDayOfMonth && (
              <NthOccurrenceSelector
                day={config.byDayOfMonth.day}
                nth={config.byDayOfMonth.nth}
                onChange={(day: string, nth: number) =>
                  updateConfig({ byDayOfMonth: { day, nth } })
                }
              />
            )}
          </div>
        </>
      )}

      {config.frequency === "yearly" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Month</label>
              <select
                value={config.byMonth || 1}
                onChange={(e) =>
                  updateConfig({ byMonth: parseInt(e.target.value) })
                }
                className="w-full mt-1 p-2 border rounded-md"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Day</label>
              <input
                type="number"
                min="1"
                max="31"
                value={config.byMonthDayYearly || 1}
                onChange={(e) =>
                  updateConfig({
                    byMonthDayYearly: parseInt(e.target.value),
                  })
                }
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-sm font-medium">End Condition</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="end-never"
              name="end-type"
              checked={config.endType === "never"}
              onChange={() => updateConfig({ endType: "never" })}
              className="h-4 w-4"
            />
            <label htmlFor="end-never" className="text-sm">
              Never
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="end-date"
              name="end-type"
              checked={config.endType === "on-date"}
              onChange={() => updateConfig({ endType: "on-date" })}
              className="h-4 w-4"
            />
            <label htmlFor="end-date" className="text-sm">
              On date
            </label>
          </div>
          {config.endType === "on-date" && (
            <div className="ml-6">
              <DateInput
                value={config.endDate ?? null}
                onChange={(date) => updateConfig({ endDate: date ?? undefined })}
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="end-count"
              name="end-type"
              checked={config.endType === "after-executions"}
              onChange={() => updateConfig({ endType: "after-executions" })}
              className="h-4 w-4"
            />
            <label htmlFor="end-count" className="text-sm">
              After executions
            </label>
          </div>
          {config.endType === "after-executions" && (
            <input
              type="number"
              min="1"
              value={config.count || 10}
              onChange={(e) =>
                updateConfig({ count: parseInt(e.target.value) })
              }
              className="ml-6 p-2 border rounded-md w-24"
            />
          )}
        </div>
      </div>
      {showGeneratedRule && <RRulePreview rrule={generateRRuleFromConfig(config)} />}
    </div>
  );
};

// Helper function to generate RRule from config
function generateRRuleFromConfig(config: ScheduleConfig): string {
  const parts: string[] = [];

  // Frequency
  parts.push(`FREQ=${config.frequency.toUpperCase()}`);

  // Interval
  if (config.interval > 1) {
    parts.push(`INTERVAL=${config.interval}`);
  }

  // Weekly: BYDAY
  if (
    config.frequency === "weekly" &&
    config.byDay &&
    config.byDay.length > 0
  ) {
    parts.push(`BYDAY=${config.byDay.join(",")}`);
  }

  // Monthly: BYMONTHDAY or BYDAY
  if (config.frequency === "monthly") {
    if (config.byDayOfMonth) {
      parts.push(`BYDAY=${config.byDayOfMonth.nth}${config.byDayOfMonth.day}`);
    } else if (config.byMonthDay) {
      parts.push(`BYMONTHDAY=${config.byMonthDay}`);
    }
  }

  // Yearly: BYMONTH and BYMONTHDAY
  if (config.frequency === "yearly") {
    if (config.byMonth) {
      parts.push(`BYMONTH=${config.byMonth}`);
    }
    if (config.byMonthDayYearly) {
      parts.push(`BYMONTHDAY=${config.byMonthDayYearly}`);
    }
  }

  // End conditions
  if (config.endType === "on-date" && config.endDate) {
    const until =
      config.endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    parts.push(`UNTIL=${until}`);
  } else if (config.endType === "after-executions" && config.count) {
    parts.push(`COUNT=${config.count}`);
  }

  return parts.join(";");
}

// Helper function to parse RRule back to config
function parseRRuleToConfig(rrule: string): ScheduleConfig {
  const config: ScheduleConfig = { ...defaultConfig };

  if (!rrule) return config;

  const parts = rrule.split(";");

  for (const part of parts) {
    const [key, value] = part.split("=");

    if (!key || !value) continue;

    switch (key) {
      case "FREQ":
        config.frequency = value.toLowerCase() as FrequencyType;
        break;
      case "INTERVAL":
        config.interval = parseInt(value) || 1;
        break;
      case "BYDAY":
        if (config.frequency === "weekly") {
          config.byDay = value.split(",");
        } else if (config.frequency === "monthly") {
          // Check if it's nth day format (e.g., "2TU")
          const match = value.match(/^(\d+)([A-Z]+)$/);
          if (match && match[1] && match[2]) {
            config.byDayOfMonth = {
              day: match[2],
              nth: parseInt(match[1]) || 1,
            };
          }
        }
        break;
      case "BYMONTHDAY":
        const dayValue = parseInt(value);
        if (config.frequency === "monthly") {
          config.byMonthDay = dayValue;
        } else if (config.frequency === "yearly") {
          config.byMonthDayYearly = dayValue;
        }
        break;
      case "BYMONTH":
        config.byMonth = parseInt(value) || 1;
        break;
      case "UNTIL":
        config.endType = "on-date";
        config.endDate = new Date(value);
        break;
      case "COUNT":
        config.endType = "after-executions";
        config.count = parseInt(value) || 1;
        break;
    }
  }

  return config;
}
