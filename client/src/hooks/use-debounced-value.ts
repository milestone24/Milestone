import { useEffect, useState } from "react";

/**
 * Returns a debounced version of the provided value that only updates
 * after the specified delay has elapsed without further changes.
 */
export function useDebouncedValue<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debouncedValue;
}

