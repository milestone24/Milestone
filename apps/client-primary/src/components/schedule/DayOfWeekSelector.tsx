import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface DayOfWeekSelectorProps {
  selectedDays: string[];
  onChange: (days: string[]) => void;
}

const dayOptions = [
  { value: "MO", label: "Monday" },
  { value: "TU", label: "Tuesday" },
  { value: "WE", label: "Wednesday" },
  { value: "TH", label: "Thursday" },
  { value: "FR", label: "Friday" },
  { value: "SA", label: "Saturday" },
  { value: "SU", label: "Sunday" },
];

export const DayOfWeekSelector: React.FC<DayOfWeekSelectorProps> = ({
  selectedDays,
  onChange,
}) => {
  const handleDayToggle = (day: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedDays, day]);
    } else {
      onChange(selectedDays.filter((d) => d !== day));
    }
  };

  return (
    <div className="space-y-3">
      <Label>Days of the week</Label>
      <div className="grid grid-cols-2 gap-3">
        {dayOptions.map((day) => (
          <div key={day.value} className="flex items-center space-x-2">
            <Checkbox
              id={day.value}
              checked={selectedDays.includes(day.value)}
              onCheckedChange={(checked) =>
                handleDayToggle(day.value, checked as boolean)
              }
            />
            <Label htmlFor={day.value} className="text-sm font-normal">
              {day.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
};
