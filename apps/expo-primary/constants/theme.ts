export type ThemeMode = "light" | "dark";

export const lightTheme = {
  background: "255 255 255",
  foreground: "24 24 27",
  card: "255 255 255",
  cardForeground: "24 24 27",
  primary: "59 130 246",
  primaryForeground: "255 255 255",
  secondary: "34 197 94",
  secondaryForeground: "255 255 255",
  muted: "244 244 245",
  mutedForeground: "113 113 122",
  destructive: "239 68 68",
  destructiveForeground: "255 255 255",
  border: "228 228 231",
  input: "228 228 231",
  ring: "96 165 250",
  positive: "22 163 74",
  negative: "220 38 38",
  asset: "59 130 246",
  txn: "234 179 8",
} as const;

export const darkTheme = {
  background: "24 24 27",
  foreground: "250 250 250",
  card: "39 39 42",
  cardForeground: "250 250 250",
  primary: "96 165 250",
  primaryForeground: "255 255 255",
  secondary: "34 197 94",
  secondaryForeground: "255 255 255",
  muted: "39 39 42",
  mutedForeground: "161 161 170",
  destructive: "248 113 113",
  destructiveForeground: "255 255 255",
  border: "63 63 70",
  input: "63 63 70",
  ring: "96 165 250",
  positive: "74 222 128",
  negative: "248 113 113",
  asset: "96 165 250",
  txn: "250 204 21",
} as const;

export type ThemeTokens = Record<keyof typeof lightTheme, string>;

export function getThemeTokens(mode: ThemeMode): ThemeTokens {
  return mode === "dark" ? darkTheme : lightTheme;
}

export function themeTokenToRgb(token: string): string {
  return `rgb(${token})`;
}
