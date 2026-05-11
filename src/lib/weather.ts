import type { CountryId, UiLang } from "./countries";

export type CountryWeatherConfig = {
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export const COUNTRY_WEATHER: Record<CountryId, CountryWeatherConfig> = {
  TN: { city: "Tunis", latitude: 36.8065, longitude: 10.1815, timezone: "Africa/Tunis" },
  DZ: { city: "Algiers", latitude: 36.7538, longitude: 3.0588, timezone: "Africa/Algiers" },
  MA: { city: "Rabat", latitude: 34.0209, longitude: -6.8416, timezone: "Africa/Casablanca" },
  FR: { city: "Paris", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
  US: { city: "Washington", latitude: 38.9072, longitude: -77.0369, timezone: "America/New_York" },
  EG: { city: "Cairo", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo" },
  QA: { city: "Doha", latitude: 25.2854, longitude: 51.531, timezone: "Asia/Qatar" },
  SA: { city: "Riyadh", latitude: 24.7136, longitude: 46.6753, timezone: "Asia/Riyadh" },
  GB: { city: "London", latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London" },
  IT: { city: "Rome", latitude: 41.9028, longitude: 12.4964, timezone: "Europe/Rome" },
};

const WEATHER_CODE_LABELS: Record<number, { en: string; fr: string; ar: string }> = {
  0: { en: "Clear sky", fr: "Ciel dégagé", ar: "سماء صافية" },
  1: { en: "Mostly clear", fr: "Plutôt dégagé", ar: "صحو غالبا" },
  2: { en: "Partly cloudy", fr: "Partiellement nuageux", ar: "غائم جزئيا" },
  3: { en: "Overcast", fr: "Couvert", ar: "غائم" },
  45: { en: "Fog", fr: "Brouillard", ar: "ضباب" },
  48: { en: "Freezing fog", fr: "Brouillard givrant", ar: "ضباب متجمد" },
  51: { en: "Light drizzle", fr: "Bruine faible", ar: "رذاذ خفيف" },
  53: { en: "Drizzle", fr: "Bruine", ar: "رذاذ" },
  55: { en: "Dense drizzle", fr: "Bruine forte", ar: "رذاذ كثيف" },
  61: { en: "Light rain", fr: "Pluie faible", ar: "مطر خفيف" },
  63: { en: "Rain", fr: "Pluie", ar: "مطر" },
  65: { en: "Heavy rain", fr: "Forte pluie", ar: "مطر غزير" },
  71: { en: "Light snow", fr: "Neige faible", ar: "ثلج خفيف" },
  73: { en: "Snow", fr: "Neige", ar: "ثلج" },
  75: { en: "Heavy snow", fr: "Neige forte", ar: "ثلج غزير" },
  80: { en: "Rain showers", fr: "Averses", ar: "زخات مطر" },
  81: { en: "Heavy showers", fr: "Fortes averses", ar: "زخات قوية" },
  82: { en: "Violent showers", fr: "Averses violentes", ar: "زخات عنيفة" },
  95: { en: "Thunderstorm", fr: "Orage", ar: "عاصفة رعدية" },
};

export function weatherCodeLabel(code: number | null | undefined, lang: UiLang): string {
  if (code == null) return lang === "ar" ? "غير متوفر" : lang === "fr" ? "Indisponible" : "Unavailable";
  const row = WEATHER_CODE_LABELS[code];
  if (!row) return lang === "ar" ? "الطقس غير معروف" : lang === "fr" ? "Météo inconnue" : "Unknown weather";
  if (lang === "ar") return row.ar;
  if (lang === "fr") return row.fr;
  return row.en;
}
