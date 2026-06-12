import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FrequencySelectorProps {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  onFrequencyChange: (
    frequency: "daily" | "weekly" | "monthly" | "yearly"
  ) => void;
  onIntervalChange: (interval: number) => void;
}

const periodPlural = (period: "daily" | "weekly" | "monthly" | "yearly") => {
  return period === "daily"
    ? "days"
    : period === "weekly"
    ? "weeks"
    : period === "monthly"
    ? "months"
    : period === "yearly"
    ? "years"
    : "invalid";
};

const periodSingular = (period: "daily" | "weekly" | "monthly" | "yearly") => {
  return period === "daily"
    ? "day"
    : period === "weekly"
    ? "week"
    : period === "monthly"
    ? "month"
    : period === "yearly"
    ? "year"
    : "invalid";
};

export const FrequencySelector: React.FC<FrequencySelectorProps> = ({
  frequency,
  interval,
  onFrequencyChange,
  onIntervalChange,
}) => {
  const frequencyOptions = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="frequency">Frequency</Label>
          <Select value={frequency} onValueChange={onFrequencyChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="interval">Every</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="interval"
              type="number"
              min="1"
              max="99"
              value={interval}
              onChange={(e) => onIntervalChange(parseInt(e.target.value) || 1)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              {interval === 1
                ? periodSingular(frequency)
                : periodPlural(frequency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
