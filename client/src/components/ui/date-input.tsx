import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "./calendar"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { dateToDateInputValue } from "@/lib/form"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value?: Date | null;
  onChange: (date: Date | undefined) => void;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
  className?: string;
}

function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  name,
  onBlur,
  className,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputStr, setInputStr] = React.useState(() => dateToDateInputValue(value));
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setInputStr(dateToDateInputValue(value));
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputStr(val);
    if (!val) {
      onChange(undefined);
      return;
    }
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      onChange(date);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <Input
        type="date"
        name={name}
        value={inputStr}
        onChange={handleInputChange}
        onBlur={onBlur}
        disabled={disabled}
        min={dateToDateInputValue(min) || undefined}
        max={dateToDateInputValue(max) || undefined}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleCalendarSelect}
            fromDate={min}
            toDate={max}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

DateInput.displayName = "DateInput";

export { DateInput };
