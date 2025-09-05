import React from "react";
import DateRangeControl from "@/components/ui/DateRangeControl";
import { cn } from "@/lib/utils";

interface DateRangeBarProps {
  className?: string;
}

export default function DateRangeBar({ className }: DateRangeBarProps) {
  return (
    <div className={cn("flex justify-center px-4 ", className)}>
      <DateRangeControl />
    </div>
  );
}
