import * as React from "react"
import IMask from "imask"
import { IMaskInput } from "react-imask"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "./calendar"
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

const parseDateFromMask = (str: string): Date => {
  const [day, month, year] = str.split("/");
  return new Date(Number(year), Number(month) - 1, Number(day));
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAccept = (val: string, mask: any) => {
    if (!val) {
      onChange(undefined);
      return;
    }
    const typed: unknown = mask.typedValue;
    if (typed instanceof Date && !isNaN(typed.getTime())) {
      onChange(typed);
    }
    // partial input: silently do nothing — preserve last valid RHF value
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    setDisplayValue(formatDateForMask(date));
    onChange(date);
    setOpen(false);
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <IMaskInput
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mask={Date as any}
        pattern="d{/}`m{/}`Y"
        blocks={{
          d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
          m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
          Y: { mask: IMask.MaskedRange, from: 1900, to: 2999, maxLength: 4 },
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
