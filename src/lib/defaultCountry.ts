import { COUNTRIES, type CountryId } from "@/lib/countries";

export const DEFAULT_COUNTRY_ID: CountryId = "TN";

const SUPPORTED = new Set<CountryId>(COUNTRIES.map((c) => c.id));

export function isCountryId(value: string | null | undefined): value is CountryId {
  if (!value) return false;
  return SUPPORTED.has(value.toUpperCase() as CountryId);
}

/** Map ISO 3166-1 alpha-2 (or app id) to a supported feed country. */
export function countryIdFromIso(iso: string | null | undefined): CountryId | null {
  const code = String(iso ?? "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  return isCountryId(code) ? code : null;
}

/** Infer country from CDN / hosting geo headers (SSR). */
export function countryIdFromRequestHeaders(headerStore: Headers): CountryId {
  const candidates = [
    headerStore.get("x-vercel-ip-country"),
    headerStore.get("cf-ipcountry"),
    headerStore.get("x-country-code"),
    headerStore.get("cloudfront-viewer-country"),
  ];
  for (const raw of candidates) {
    const id = countryIdFromIso(raw);
    if (id) return id;
  }
  return DEFAULT_COUNTRY_ID;
}

async function reverseGeocodeCountry(lat: number, lon: number): Promise<CountryId | null> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/reverse?" +
    new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      language: "en",
      count: "1",
    });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Array<{ country_code?: string }> };
  const code = json.results?.[0]?.country_code;
  return countryIdFromIso(code);
}

/** Browser GPS → country (needs permission). */
export async function detectCountryFromGeolocation(): Promise<CountryId | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 9000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        void reverseGeocodeCountry(pos.coords.latitude, pos.coords.longitude)
          .then(resolve)
          .catch(() => resolve(null));
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  });
}

/** IP-based fallback when GPS is denied or unavailable (client only). */
export async function detectCountryFromIp(): Promise<CountryId | null> {
  try {
    const res = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; country_code?: string };
    if (json.success === false) return null;
    return countryIdFromIso(json.country_code);
  } catch {
    return null;
  }
}

/** First-visit default: GPS, then IP, then Tunisia. */
export async function detectDefaultCountry(): Promise<CountryId> {
  const fromGeo = await detectCountryFromGeolocation();
  if (fromGeo) return fromGeo;
  const fromIp = await detectCountryFromIp();
  if (fromIp) return fromIp;
  return DEFAULT_COUNTRY_ID;
}
