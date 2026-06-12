import { useMemo } from "react";
import { useColorScheme } from "nativewind";
import { getThemeTokens, themeTokenToRgb } from "@/constants/theme";

const TOKEN_MAP: Record<string, keyof ReturnType<typeof getThemeTokens>> = {
  "--asset": "asset",
  "--txn": "txn",
  "--primary": "primary",
  "--positive": "positive",
  "--negative": "negative",
  "--foreground": "foreground",
  "--muted-foreground": "mutedForeground",
};

export function useThemeColors(varNames: string[]): string[] {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === "dark" ? "dark" : "light";

  return useMemo(() => {
    const tokens = getThemeTokens(mode);
    return varNames.map((name) => {
      const key = TOKEN_MAP[name];
      if (!key) return themeTokenToRgb(tokens.foreground);
      return themeTokenToRgb(tokens[key]);
    });
  }, [varNames, mode]);
}
