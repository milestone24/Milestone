import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DayOfMonthSelectorProps {
  day: number;
  onChange: (day: number) => void;
}

export const DayOfMonthSelector: React.FC<DayOfMonthSelectorProps> = ({
  day,
  onChange,
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="day-of-month">Day of month</Label>
      <div className="flex items-center space-x-2">
        <Input
          id="day-of-month"
          type="number"
          min="1"
          max="31"
          value={day}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="w-20"
        />
        <span className="text-sm text-muted-foreground">
          {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"}
        </span>
      </div>
    </div>
  );
};
