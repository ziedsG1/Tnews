export type ThemeMode = "dark" | "light" | "newspaper" | "broadsheet";

export const THEME_ORDER: ThemeMode[] = ["dark", "light", "newspaper", "broadsheet"];

export function parseStoredTheme(value: string | null): ThemeMode | null {
  if (value === "dark" || value === "light" || value === "newspaper" || value === "broadsheet") {
    return value;
  }
  return null;
}
