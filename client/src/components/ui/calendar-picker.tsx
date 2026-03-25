import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CalendarPickerProps {
  value?: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

type View = "days" | "months" | "years";

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDisabledDate(date: Date, minDate?: Date, maxDate?: Date): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (minDate) {
    const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (d < min) return true;
  }
  if (maxDate) {
    const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    if (d > max) return true;
  }
  return false;
}

function buildDayGrid(year: number, month: number): Array<{ date: Date; currentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  // Mon-based offset: Mon=0 … Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: Array<{ date: Date; currentMonth: boolean }> = [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(prevYear, prevMonth, daysInPrevMonth - i), currentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), currentMonth: true });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ date: new Date(nextYear, nextMonth, d), currentMonth: false });
  }

  return cells;
}

export function CalendarPicker({ value, onChange, minDate, maxDate }: CalendarPickerProps) {
  const today = new Date();

  const [view, setView] = React.useState<View>("days");
  const [activeYear, setActiveYear] = React.useState(
    () => (value ?? today).getFullYear()
  );
  const [activeMonth, setActiveMonth] = React.useState(
    () => (value ?? today).getMonth()
  );
  const [yearRangeStart, setYearRangeStart] = React.useState(() => {
    const y = (value ?? today).getFullYear();
    return Math.floor(y / 12) * 12;
  });

  const handlePrev = () => {
    if (view === "days") {
      if (activeMonth === 0) { setActiveYear(y => y - 1); setActiveMonth(11); }
      else setActiveMonth(m => m - 1);
    } else if (view === "months") {
      setActiveYear(y => y - 1);
    } else {
      setYearRangeStart(s => s - 12);
    }
  };

  const handleNext = () => {
    if (view === "days") {
      if (activeMonth === 11) { setActiveYear(y => y + 1); setActiveMonth(0); }
      else setActiveMonth(m => m + 1);
    } else if (view === "months") {
      setActiveYear(y => y + 1);
    } else {
      setYearRangeStart(s => s + 12);
    }
  };

  const handleHeaderClick = () => {
    if (view === "days") setView("years");
    else if (view === "months") setView("years");
  };

  const handleSelectMonth = (month: number) => {
    setActiveMonth(month);
    setView("days");
  };

  const handleSelectYear = (year: number) => {
    setActiveYear(year);
    setYearRangeStart(Math.floor(year / 12) * 12);
    setView("months");
  };

  const handleSelectDay = (date: Date) => {
    if (!isDisabledDate(date, minDate, maxDate)) {
      onChange(date);
    }
  };

  const headerLabel =
    view === "days"
      ? `${MONTH_NAMES[activeMonth]} ${activeYear}`
      : view === "months"
      ? `${activeYear}`
      : `${yearRangeStart} – ${yearRangeStart + 11}`;

  const navBtn = cn(
    "flex items-center justify-center h-7 w-7 rounded-md text-sm",
    "opacity-70 hover:opacity-100 hover:bg-accent hover:text-accent-foreground",
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  );

  const tile = cn(
    "flex items-center justify-center rounded-md text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  );

  return (
    <div className="p-3 w-[280px] select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={handlePrev} className={navBtn} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleHeaderClick}
          disabled={view === "years"}
          className={cn(
            "text-sm font-medium px-2 py-1 rounded-md transition-colors",
            view !== "years"
              ? "hover:bg-accent hover:text-accent-foreground cursor-pointer"
              : "cursor-default"
          )}
        >
          {headerLabel}
        </button>

        <button type="button" onClick={handleNext} className={navBtn} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Days view */}
      {view === "days" && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map(d => (
              <div key={d} className="flex items-center justify-center h-8 text-xs text-muted-foreground font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {buildDayGrid(activeYear, activeMonth).map(({ date, currentMonth }, i) => {
              const disabled = isDisabledDate(date, minDate, maxDate);
              const selected = value ? isSameDay(date, value) : false;
              const isNow = isSameDay(date, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectDay(date)}
                  disabled={disabled}
                  aria-label={date.toLocaleDateString()}
                  aria-selected={selected}
                  className={cn(
                    tile,
                    "h-9 w-full text-sm",
                    disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    !currentMonth && !selected && "text-muted-foreground opacity-50",
                    isNow && !selected && "bg-accent text-accent-foreground font-semibold",
                    selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Months view */}
      {view === "months" && (
        <div className="grid grid-cols-3 gap-2">
          {MONTH_ABBR.map((name, i) => {
            const selected = value != null && value.getMonth() === i && value.getFullYear() === activeYear;
            const isNow = today.getMonth() === i && today.getFullYear() === activeYear;
            return (
              <button
                key={name}
                type="button"
                onClick={() => handleSelectMonth(i)}
                className={cn(
                  tile,
                  "h-10",
                  "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  isNow && !selected && "bg-accent text-accent-foreground font-semibold",
                  selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Years view */}
      {view === "years" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(year => {
            const selected = value != null && value.getFullYear() === year;
            const isNow = today.getFullYear() === year;
            return (
              <button
                key={year}
                type="button"
                onClick={() => handleSelectYear(year)}
                className={cn(
                  tile,
                  "h-10",
                  "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  isNow && !selected && "bg-accent text-accent-foreground font-semibold",
                  selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold"
                )}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
