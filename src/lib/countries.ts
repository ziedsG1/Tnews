import type { FeedKind, FeedLocale, FeedSource } from "./feeds";
import { DEFAULT_FEEDS } from "./feeds";

export type CountryId = "TN" | "DZ" | "MA" | "FR" | "US";

export type CountryConfig = {
  id: CountryId;
  /** Brand text shown in header (e.g. Tnews, DZnews). */
  brand: string;
  label: string;
  /** Default UI/search language hint. */
  primaryLocale: FeedLocale;
  feeds: FeedSource[];
};

function gnSearch(query: string, opts: { hl: string; gl: string; ceid: string }): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${opts.hl}&gl=${opts.gl}&ceid=${encodeURIComponent(opts.ceid)}`;
}

function gnTopNews(opts: { hl: string; gl: string; ceid: string }): string {
  return `https://news.google.com/rss?hl=${opts.hl}&gl=${opts.gl}&ceid=${encodeURIComponent(opts.ceid)}`;
}

function feed(id: string, label: string, url: string, locale: FeedLocale, kind: FeedKind): FeedSource {
  return { id, label, url, locale, kind, independentMedia: kind === "independent" };
}

export const COUNTRIES: CountryConfig[] = [
  {
    id: "TN",
    brand: "Tnews",
    label: "Tunisia · تونس",
    primaryLocale: "ar",
    feeds: DEFAULT_FEEDS,
  },
  {
    id: "DZ",
    brand: "DZnews",
    label: "Algeria · الجزائر",
    primaryLocale: "ar",
    feeds: [
      feed("gn-dz-ar", "أخبار الجزائر (Google News)", gnSearch("الجزائر", { hl: "ar", gl: "DZ", ceid: "DZ:ar" }), "ar", "major"),
      feed("gn-dz-top-ar", "الأكثر تداولا (Google News)", gnTopNews({ hl: "ar", gl: "DZ", ceid: "DZ:ar" }), "ar", "major"),
      feed("elwatan-dz", "El Watan (Algérie)", "https://www.elwatan.com/feed", "fr", "major"),
      feed("tsa-dz", "TSA Algérie", "https://www.tsa-algerie.com/feed/", "fr", "major"),
    ],
  },
  {
    id: "MA",
    brand: "MAnews",
    label: "Morocco · المغرب",
    primaryLocale: "ar",
    feeds: [
      feed("gn-ma-ar", "أخبار المغرب (Google News)", gnSearch("المغرب", { hl: "ar", gl: "MA", ceid: "MA:ar" }), "ar", "major"),
      feed("gn-ma-top-ar", "الأكثر تداولا (Google News)", gnTopNews({ hl: "ar", gl: "MA", ceid: "MA:ar" }), "ar", "major"),
      feed("hespress", "هسبريس", "https://www.hespress.com/feed/", "ar", "major"),
      feed("le360", "Le360 (Maroc)", "https://fr.le360.ma/rss", "fr", "major"),
    ],
  },
  {
    id: "FR",
    brand: "FRnews",
    label: "France · FR",
    primaryLocale: "fr",
    feeds: [
      feed("gn-fr-top", "Google News France", gnTopNews({ hl: "fr", gl: "FR", ceid: "FR:fr" }), "fr", "major"),
      feed("lemonde", "Le Monde", "https://www.lemonde.fr/rss/une.xml", "fr", "major"),
      feed("mediapart", "Mediapart", "https://www.mediapart.fr/articles/feed", "fr", "independent"),
      feed("franceinfo", "franceinfo (radio)", "https://www.francetvinfo.fr/titres.rss", "fr", "radio"),
    ],
  },
  {
    id: "US",
    brand: "USnews",
    label: "United States · US",
    primaryLocale: "fr",
    feeds: [
      feed("gn-us-en", "Google News US", gnTopNews({ hl: "en", gl: "US", ceid: "US:en" }), "fr", "major"),
      feed("ap", "AP News", "https://apnews.com/apf-topnews?output=rss", "fr", "major"),
      feed("propublica", "ProPublica", "https://www.propublica.org/feeds/propublica/main", "fr", "independent"),
      feed("npr", "NPR (radio)", "https://feeds.npr.org/1001/rss.xml", "fr", "radio"),
    ],
  },
];

export function getCountry(id: string | null | undefined): CountryConfig {
  const normalized = String(id ?? "TN").toUpperCase();
  return COUNTRIES.find((c) => c.id === normalized) ?? COUNTRIES[0]!;
}

