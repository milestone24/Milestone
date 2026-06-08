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

export interface NthOccurrenceSelectorProps {
  day: string;
  nth: number;
  onChange: (day: string, nth: number) => void;
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

const nthOptions = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: -1, label: "Last" },
];

export const NthOccurrenceSelector: React.FC<NthOccurrenceSelectorProps> = ({
  day,
  nth,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nth-occurrence">Occurrence</Label>
          <Select
            value={nth.toString()}
            onValueChange={(value) => onChange(day, parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select occurrence" />
            </SelectTrigger>
            <SelectContent>
              {nthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="day-of-week">Day of week</Label>
          <Select value={day} onValueChange={(value) => onChange(value, nth)}>
            <SelectTrigger>
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
