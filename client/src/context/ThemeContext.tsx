import { createContext, useContext, useEffect, useState } from "react";
import { getData, isNativePlatform, storeData } from "@/capacitor";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveAppliedTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolved = resolveAppliedTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

async function persistTheme(theme: Theme) {
  if (isNativePlatform()) {
    await storeData(STORAGE_KEY, theme);
  } else {
    localStorage.setItem(STORAGE_KEY, theme);
  }
}

async function loadPersistedTheme(): Promise<Theme> {
  if (isNativePlatform()) {
    const stored = await getData<Theme>(STORAGE_KEY);
    return stored ?? "system";
  }
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored ?? "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    loadPersistedTheme().then((stored) => {
      setThemeState(stored);
      applyTheme(stored);
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    persistTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
