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

const DAY_HEADER_LABELS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

const NAV_BTN = cn(
  "flex items-center justify-center h-7 w-7 rounded-md text-sm",
  "opacity-70 hover:opacity-100 hover:bg-accent hover:text-accent-foreground",
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

const TILE = cn(
  "flex items-center justify-center rounded-md text-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildDayGrid(year: number, month: number): Array<{ date: Date; currentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
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

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function weekEnd(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
  return d;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function CalendarPicker({ value, onChange, minDate, maxDate }: CalendarPickerProps) {
  const today = React.useMemo(() => new Date(), []);

  const [view, setView] = React.useState<View>("days");
  const [activeYear, setActiveYear] = React.useState(() => (value ?? today).getFullYear());
  const [activeMonth, setActiveMonth] = React.useState(() => (value ?? today).getMonth());
  const [yearRangeStart, setYearRangeStart] = React.useState(() => {
    const y = (value ?? today).getFullYear();
    return Math.floor(y / 12) * 12;
  });
  const [focusedDate, setFocusedDate] = React.useState<Date>(() => value ?? today);

  const gridRef = React.useRef<HTMLDivElement>(null);

  const normalizedMin = React.useMemo(
    () => minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : undefined,
    [minDate]
  );
  const normalizedMax = React.useMemo(
    () => maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : undefined,
    [maxDate]
  );

  const isDisabled = React.useCallback(
    (date: Date) => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (normalizedMin && d < normalizedMin) return true;
      if (normalizedMax && d > normalizedMax) return true;
      return false;
    },
    [normalizedMin, normalizedMax]
  );

  const isMonthDisabled = React.useCallback(
    (month: number, year: number) => {
      if (normalizedMin && new Date(year, month + 1, 0) < normalizedMin) return true;
      if (normalizedMax && new Date(year, month, 1) > normalizedMax) return true;
      return false;
    },
    [normalizedMin, normalizedMax]
  );

  const isYearDisabled = React.useCallback(
    (year: number) => {
      if (normalizedMin && year < normalizedMin.getFullYear()) return true;
      if (normalizedMax && year > normalizedMax.getFullYear()) return true;
      return false;
    },
    [normalizedMin, normalizedMax]
  );

  const isPrevDisabled = React.useMemo(() => {
    if (view === "days") {
      if (!normalizedMin) return false;
      const pm = activeMonth === 0 ? 11 : activeMonth - 1;
      const py = activeMonth === 0 ? activeYear - 1 : activeYear;
      return new Date(py, pm + 1, 0) < normalizedMin;
    }
    if (view === "months") {
      if (!normalizedMin) return false;
      return new Date(activeYear - 1, 11, 31) < normalizedMin;
    }
    if (!normalizedMin) return false;
    return yearRangeStart - 1 < normalizedMin.getFullYear();
  }, [view, activeYear, activeMonth, yearRangeStart, normalizedMin]);

  const isNextDisabled = React.useMemo(() => {
    if (view === "days") {
      if (!normalizedMax) return false;
      const nm = activeMonth === 11 ? 0 : activeMonth + 1;
      const ny = activeMonth === 11 ? activeYear + 1 : activeYear;
      return new Date(ny, nm, 1) > normalizedMax;
    }
    if (view === "months") {
      if (!normalizedMax) return false;
      return new Date(activeYear + 1, 0, 1) > normalizedMax;
    }
    if (!normalizedMax) return false;
    return yearRangeStart + 12 > normalizedMax.getFullYear();
  }, [view, activeYear, activeMonth, yearRangeStart, normalizedMax]);

  const dayGrid = React.useMemo(
    () => buildDayGrid(activeYear, activeMonth),
    [activeYear, activeMonth]
  );

  const dayRows = React.useMemo(() => {
    const rows: Array<typeof dayGrid> = [];
    for (let i = 0; i < dayGrid.length; i += 7) {
      rows.push(dayGrid.slice(i, i + 7));
    }
    return rows;
  }, [dayGrid]);

  // Move focus to the focused date button after any state change that affects it
  React.useEffect(() => {
    if (view !== "days" || !gridRef.current) return;
    const key = dateKey(focusedDate);
    const btn = gridRef.current.querySelector<HTMLButtonElement>(`[data-date="${key}"]`);
    btn?.focus({ preventScroll: true });
  }, [focusedDate, view]);

  const handlePrev = () => {
    if (view === "days") {
      const newMonth = activeMonth === 0 ? 11 : activeMonth - 1;
      const newYear = activeMonth === 0 ? activeYear - 1 : activeYear;
      setActiveMonth(newMonth);
      setActiveYear(newYear);
      setFocusedDate(clampDay(newYear, newMonth, focusedDate.getDate()));
    } else if (view === "months") {
      setActiveYear(y => y - 1);
    } else {
      setYearRangeStart(s => s - 12);
    }
  };

  const handleNext = () => {
    if (view === "days") {
      const newMonth = activeMonth === 11 ? 0 : activeMonth + 1;
      const newYear = activeMonth === 11 ? activeYear + 1 : activeYear;
      setActiveMonth(newMonth);
      setActiveYear(newYear);
      setFocusedDate(clampDay(newYear, newMonth, focusedDate.getDate()));
    } else if (view === "months") {
      setActiveYear(y => y + 1);
    } else {
      setYearRangeStart(s => s + 12);
    }
  };

  const handleHeaderClick = () => setView("years");

  const handleSelectMonth = (month: number) => {
    setActiveMonth(month);
    setFocusedDate(clampDay(activeYear, month, focusedDate.getDate()));
    setView("days");
  };

  const handleSelectYear = (year: number) => {
    setActiveYear(year);
    setYearRangeStart(Math.floor(year / 12) * 12);
    setView("months");
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: Date | null = null;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        next = addDays(focusedDate, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        next = addDays(focusedDate, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        next = addDays(focusedDate, -7);
        break;
      case "ArrowDown":
        e.preventDefault();
        next = addDays(focusedDate, 7);
        break;
      case "Home":
        e.preventDefault();
        next = e.ctrlKey
          ? new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1)
          : weekStart(focusedDate);
        break;
      case "End":
        e.preventDefault();
        next = e.ctrlKey
          ? new Date(focusedDate.getFullYear(), focusedDate.getMonth() + 1, 0)
          : weekEnd(focusedDate);
        break;
      case "PageUp": {
        e.preventDefault();
        const prevM = focusedDate.getMonth() === 0 ? 11 : focusedDate.getMonth() - 1;
        const prevY = focusedDate.getMonth() === 0 ? focusedDate.getFullYear() - 1 : focusedDate.getFullYear();
        next = e.shiftKey
          ? clampDay(focusedDate.getFullYear() - 1, focusedDate.getMonth(), focusedDate.getDate())
          : clampDay(prevY, prevM, focusedDate.getDate());
        break;
      }
      case "PageDown": {
        e.preventDefault();
        const nextM = focusedDate.getMonth() === 11 ? 0 : focusedDate.getMonth() + 1;
        const nextY = focusedDate.getMonth() === 11 ? focusedDate.getFullYear() + 1 : focusedDate.getFullYear();
        next = e.shiftKey
          ? clampDay(focusedDate.getFullYear() + 1, focusedDate.getMonth(), focusedDate.getDate())
          : clampDay(nextY, nextM, focusedDate.getDate());
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        if (!isDisabled(focusedDate)) onChange(focusedDate);
        return;
      default:
        return;
    }

    if (next) {
      if (next.getMonth() !== activeMonth || next.getFullYear() !== activeYear) {
        setActiveMonth(next.getMonth());
        setActiveYear(next.getFullYear());
      }
      setFocusedDate(next);
    }
  };

  const headerLabel =
    view === "days"
      ? `${MONTH_NAMES[activeMonth]} ${activeYear}`
      : view === "months"
      ? `${activeYear}`
      : `${yearRangeStart} – ${yearRangeStart + 11}`;

  return (
    <div className="p-3 w-70 max-w-[calc(100vw-1rem)] select-none min-h-82 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={isPrevDisabled}
          className={cn(NAV_BTN, isPrevDisabled && "opacity-30 cursor-not-allowed pointer-events-none")}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleHeaderClick}
          disabled={view === "years"}
          aria-label={
            view === "days"
              ? `Navigate to year selection, currently ${MONTH_NAMES[activeMonth]} ${activeYear}`
              : view === "months"
              ? `Navigate to year range, currently ${activeYear}`
              : undefined
          }
          className={cn(
            "text-sm font-medium px-2 py-1 rounded-md transition-colors",
            view !== "years"
              ? "hover:bg-accent hover:text-accent-foreground cursor-pointer"
              : "cursor-default"
          )}
        >
          {headerLabel}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={isNextDisabled}
          className={cn(NAV_BTN, isNextDisabled && "opacity-30 cursor-not-allowed pointer-events-none")}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Days view */}
      {view === "days" && (
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${MONTH_NAMES[activeMonth]} ${activeYear}`}
          aria-multiselectable="false"
          onKeyDown={handleGridKeyDown}
          className="flex-1 flex flex-col"
        >
          {/* Column headers */}
          <div role="row" className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((d, i) => (
              <div
                key={d}
                role="columnheader"
                aria-label={DAY_HEADER_LABELS[i]}
                className="flex items-center justify-center h-8 text-xs text-muted-foreground font-medium"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          <div className="flex flex-col gap-y-0.5">
            {dayRows.map((row, rowIdx) => (
              <div key={rowIdx} role="row" className="grid grid-cols-7">
                {row.map(({ date, currentMonth }) => {
                  const disabled = isDisabled(date);
                  const selected = value ? isSameDay(date, value) : false;
                  const isNow = isSameDay(date, today);
                  const isFocused = isSameDay(date, focusedDate);
                  return (
                    <div key={dateKey(date)} role="gridcell">
                      <button
                        type="button"
                        data-date={dateKey(date)}
                        tabIndex={isFocused ? 0 : -1}
                        onClick={() => { if (!disabled) onChange(date); }}
                        onFocus={() => setFocusedDate(date)}
                        disabled={disabled}
                        aria-label={date.toLocaleDateString(undefined, {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                        })}
                        aria-selected={selected}
                        aria-current={isNow ? "date" : undefined}
                        className={cn(
                          TILE,
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
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Months view */}
      {view === "months" && (
        <div className="grid grid-cols-3 gap-2">
          {MONTH_ABBR.map((abbr, i) => {
            const disabled = isMonthDisabled(i, activeYear);
            const selected = value != null && value.getMonth() === i && value.getFullYear() === activeYear;
            const isNow = today.getMonth() === i && today.getFullYear() === activeYear;
            return (
              <button
                key={abbr}
                type="button"
                onClick={() => !disabled && handleSelectMonth(i)}
                disabled={disabled}
                aria-label={`${MONTH_NAMES[i]} ${activeYear}`}
                aria-selected={selected}
                aria-current={isNow ? "date" : undefined}
                className={cn(
                  TILE,
                  "h-10",
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  isNow && !selected && !disabled && "bg-accent text-accent-foreground font-semibold",
                  selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold"
                )}
              >
                {abbr}
              </button>
            );
          })}
        </div>
      )}

      {/* Years view */}
      {view === "years" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(year => {
            const disabled = isYearDisabled(year);
            const selected = value != null && value.getFullYear() === year;
            const isNow = today.getFullYear() === year;
            return (
              <button
                key={year}
                type="button"
                onClick={() => !disabled && handleSelectYear(year)}
                disabled={disabled}
                aria-label={`${year}`}
                aria-selected={selected}
                aria-current={isNow ? "date" : undefined}
                className={cn(
                  TILE,
                  "h-10",
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  isNow && !selected && !disabled && "bg-accent text-accent-foreground font-semibold",
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
