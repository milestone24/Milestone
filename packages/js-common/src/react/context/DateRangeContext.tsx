import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { DateRangeOption } from "../types/date-range";

interface DateRangeContextType {
  dateRange: DateRangeOption;
  setDateRange: (range: DateRangeOption) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(
  undefined
);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeOption>("6months");

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}
