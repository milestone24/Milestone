import { useState, useEffect } from "react";

function resolveColors(varNames: string[]): string[] {
  const style = getComputedStyle(document.documentElement);
  return varNames.map((name) => style.getPropertyValue(name).trim());
}

export function useThemeColors(varNames: string[]): string[] {
  const [values, setValues] = useState(() => resolveColors(varNames));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setValues(resolveColors(varNames));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return values;
}
