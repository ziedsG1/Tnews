export type ThemeMode = "dark" | "light" | "broadsheet";

export const THEME_ORDER: ThemeMode[] = ["dark", "light", "broadsheet"];

export function parseStoredTheme(value: string | null): ThemeMode | null {
  if (value === "newspaper") return "broadsheet";
  if (value === "dark" || value === "light" || value === "broadsheet") {
    return value;
  }
  return null;
}

export function normalizeThemeMode(value: string): ThemeMode {
  if (value === "newspaper") return "broadsheet";
  if (value === "dark" || value === "light" || value === "broadsheet") return value;
  return "dark";
}
