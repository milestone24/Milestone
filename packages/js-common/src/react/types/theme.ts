export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ColorSchemeService {
  getSystemScheme(): ResolvedTheme;
  subscribe(callback: (scheme: ResolvedTheme) => void): () => void;
}

export interface ThemeApplicationService {
  apply(resolved: ResolvedTheme): void;
}
