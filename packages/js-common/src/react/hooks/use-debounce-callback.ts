import { useCallback, useRef } from "react";

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  cb: T,
  delay: number,
  minLength: number
) {
  const timeout = useRef<NodeJS.Timeout | null>(null);
  return useCallback(
    (...args: Parameters<T>) => {
      if (args[0].length < minLength) cb(...args);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => cb(...args), delay);
    },
    [cb, delay]
  );
}
