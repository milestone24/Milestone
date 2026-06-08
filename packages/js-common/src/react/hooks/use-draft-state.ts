import { useCallback, useRef, useState } from "react";

function readDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable (private browsing quota exceeded, etc.)
  }
}

function removeDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Persists state to sessionStorage so it survives in-app navigation and
 * iOS PWA process eviction. Cleared on explicit cancel or successful submit.
 *
 * @param key - Namespaced storage key, e.g. "draft:add-account"
 * @param defaultValue - Value used when no draft exists
 * @returns [value, setValue, clearDraft]
 */
export function useDraftState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  const clearedRef = useRef(false);
  const [state, setStateInternal] = useState<T>(() => {
    return readDraft<T>(key) ?? defaultValue;
  });

  const setState = useCallback(
    (value: T) => {
      if (clearedRef.current) return;
      writeDraft(key, value);
      setStateInternal(value);
    },
    [key]
  );

  const clearDraft = useCallback(() => {
    clearedRef.current = true;
    removeDraft(key);
    setStateInternal(defaultValue);
  }, [key, defaultValue]);

  return [state, setState, clearDraft];
}
