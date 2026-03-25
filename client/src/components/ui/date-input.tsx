import * as React from "react"
import { MaskedRange } from "imask"
import { IMaskInput } from "react-imask"
import { CalendarIcon } from "lucide-react"
import { CalendarPicker } from "./calendar-picker"
import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value?: Date | null;
  onChange: (date: Date | undefined) => void;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  name?: string;
  id?: string;
  onBlur?: () => void;
  className?: string;
}

const formatDateForMask = (date: Date | null | undefined): string => {
  if (!date || isNaN(date.getTime())) return "";
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateFromMask = (str: string): Date | null => {
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year ||
      day.includes("_") || month.includes("_") || year.includes("_")) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return isNaN(date.getTime()) ? null : date;
};

function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  name,
  id,
  onBlur,
  className,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [displayValue, setDisplayValue] = React.useState(() =>
    formatDateForMask(value)
  );
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setDisplayValue(formatDateForMask(value));
    }
  }, [value]);

  const handleAccept = (val: string) => {
    setDisplayValue(val);
    const digits = val.replace(/\D/g, "");
    if (!digits) {
      if (value != null) onChange(undefined);
      return;
    }
    const date = parseDateFromMask(val);
    if (date !== null) onChange(date);
  };

  const handleCalendarSelect = (date: Date) => {
    setDisplayValue(formatDateForMask(date));
    onChange(date);
    setOpen(false);
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <IMaskInput
        mask={Date}
        pattern="d{/}`m{/}`Y"
        blocks={{
          d: { mask: MaskedRange, from: 1, to: 31, maxLength: 2 },
          m: { mask: MaskedRange, from: 1, to: 12, maxLength: 2 },
          Y: { mask: MaskedRange, from: 1900, to: 2999, maxLength: 4 },
        }}
        min={min}
        max={max}
        format={formatDateForMask}
        parse={parseDateFromMask}
        lazy={false}
        autoComplete="off"
        id={id}
        name={name}
        value={displayValue}
        onAccept={handleAccept}
        onBlur={onBlur}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
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
          <CalendarPicker
            value={value}
            onChange={handleCalendarSelect}
            minDate={min}
            maxDate={max}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

DateInput.displayName = "DateInput";

export { DateInput };
