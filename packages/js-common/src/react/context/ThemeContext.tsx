import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  useColorScheme,
  useStorage,
  useThemeApplication,
} from "../../platform/PlatformServicesProvider";
import type {
  ResolvedTheme,
  ThemePreference,
} from "../types/theme";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveAppliedTheme(
  theme: ThemePreference,
  systemScheme: ResolvedTheme
): ResolvedTheme {
  if (theme !== "system") return theme;
  return systemScheme;
}

function parseStoredTheme(value: string | null): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const colorScheme = useColorScheme();
  const themeApplication = useThemeApplication();
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await storage.getItem(STORAGE_KEY);
      if (cancelled) return;

      const nextTheme = parseStoredTheme(stored);
      setThemeState(nextTheme);
      themeApplication.apply(
        resolveAppliedTheme(nextTheme, colorScheme.getSystemScheme())
      );
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [colorScheme, storage, themeApplication]);

  useEffect(() => {
    if (!isHydrated) return;

    themeApplication.apply(
      resolveAppliedTheme(theme, colorScheme.getSystemScheme())
    );

    if (theme !== "system") return;

    return colorScheme.subscribe(() => {
      themeApplication.apply(
        resolveAppliedTheme("system", colorScheme.getSystemScheme())
      );
    });
  }, [colorScheme, isHydrated, theme, themeApplication]);

  function setTheme(next: ThemePreference) {
    setThemeState(next);
    void storage.setItem(STORAGE_KEY, next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export type { ThemePreference as Theme, ResolvedTheme };
