import type { FeedKind, FeedLocale, FeedSource } from "./feeds";
import { DEFAULT_FEEDS } from "./feeds";

export type CountryId = "TN" | "DZ" | "MA" | "FR" | "US" | "EG" | "QA" | "SA" | "GB" | "IT";
export type UiLang = "ar" | "fr" | "en";

export type CountryConfig = {
  id: CountryId;
  /** Brand text shown in header (e.g. Tnews, DZnews). */
  brand: string;
  names: Record<UiLang, string>;
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
    names: {
      ar: "تونس",
      fr: "Tunisie",
      en: "Tunisia",
    },
    primaryLocale: "ar",
    feeds: DEFAULT_FEEDS,
  },
  {
    id: "DZ",
    brand: "DZnews",
    names: {
      ar: "الجزائر",
      fr: "Algérie",
      en: "Algeria",
    },
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
    names: {
      ar: "المغرب",
      fr: "Maroc",
      en: "Morocco",
    },
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
    names: {
      ar: "فرنسا",
      fr: "France",
      en: "France",
    },
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
    names: {
      ar: "الولايات المتحدة",
      fr: "États-Unis",
      en: "United States",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-us-en", "Google News US", gnTopNews({ hl: "en", gl: "US", ceid: "US:en" }), "fr", "major"),
      // AP RSS frequently breaks XML parsing; use Google News scoped to apnews.com instead.
      feed("ap-gn", "AP News (via Google News)", gnSearch("site:apnews.com", { hl: "en", gl: "US", ceid: "US:en" }), "fr", "major"),
      feed("propublica", "ProPublica", "https://www.propublica.org/feeds/propublica/main", "fr", "independent"),
      feed("npr", "NPR (radio)", "https://feeds.npr.org/1001/rss.xml", "fr", "radio"),
    ],
  },
  {
    id: "EG",
    brand: "EGnews",
    names: {
      ar: "مصر",
      fr: "Égypte",
      en: "Egypt",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-eg-ar", "أخبار مصر (Google News)", gnSearch("مصر", { hl: "ar", gl: "EG", ceid: "EG:ar" }), "ar", "major"),
      feed("gn-eg-top-ar", "الأكثر تداولًا (Google News)", gnTopNews({ hl: "ar", gl: "EG", ceid: "EG:ar" }), "ar", "major"),
      feed("mada-masr", "مدى مصر (Google News)", gnSearch("site:madamasr.com", { hl: "ar", gl: "EG", ceid: "EG:ar" }), "ar", "independent"),
      feed("nile-radio-eg", "Nile FM / Radio (Google News)", gnSearch("مصر راديو", { hl: "ar", gl: "EG", ceid: "EG:ar" }), "ar", "radio"),
    ],
  },
  {
    id: "QA",
    brand: "QAnews",
    names: {
      ar: "قطر",
      fr: "Qatar",
      en: "Qatar",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-qa-ar", "أخبار قطر (Google News)", gnSearch("قطر", { hl: "ar", gl: "QA", ceid: "QA:ar" }), "ar", "major"),
      feed("gn-qa-top-ar", "الأكثر تداولًا (Google News)", gnTopNews({ hl: "ar", gl: "QA", ceid: "QA:ar" }), "ar", "major"),
      feed("aljazeera-qa", "الجزيرة (Google News)", gnSearch("site:aljazeera.net قطر", { hl: "ar", gl: "QA", ceid: "QA:ar" }), "ar", "major"),
      feed("indie-qa", "صحافة مستقلة (Google News)", gnSearch("قطر صحافة مستقلة", { hl: "ar", gl: "QA", ceid: "QA:ar" }), "ar", "independent"),
    ],
  },
  {
    id: "SA",
    brand: "SAnews",
    names: {
      ar: "السعودية",
      fr: "Arabie saoudite",
      en: "Saudi Arabia",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-sa-ar", "أخبار السعودية (Google News)", gnSearch("السعودية", { hl: "ar", gl: "SA", ceid: "SA:ar" }), "ar", "major"),
      feed("gn-sa-top-ar", "الأكثر تداولًا (Google News)", gnTopNews({ hl: "ar", gl: "SA", ceid: "SA:ar" }), "ar", "major"),
      feed("state-sa", "الإخبارية / حكومي (Google News)", gnSearch("السعودية وكالة الأنباء", { hl: "ar", gl: "SA", ceid: "SA:ar" }), "ar", "state"),
      feed("radio-sa", "راديو السعودية (Google News)", gnSearch("السعودية راديو", { hl: "ar", gl: "SA", ceid: "SA:ar" }), "ar", "radio"),
    ],
  },
  {
    id: "GB",
    brand: "GBnews",
    names: {
      ar: "المملكة المتحدة",
      fr: "Royaume-Uni",
      en: "United Kingdom",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-gb-en", "Google News UK", gnTopNews({ hl: "en-GB", gl: "GB", ceid: "GB:en" }), "fr", "major"),
      feed("bbc-uk", "BBC News", "https://feeds.bbci.co.uk/news/rss.xml", "fr", "major"),
      feed("guardian-uk", "The Guardian", "https://www.theguardian.com/world/rss", "fr", "independent"),
      feed("radio4-uk", "BBC Radio (Google News)", gnSearch("BBC radio UK", { hl: "en-GB", gl: "GB", ceid: "GB:en" }), "fr", "radio"),
    ],
  },
  {
    id: "IT",
    brand: "ITnews",
    names: {
      ar: "إيطاليا",
      fr: "Italie",
      en: "Italy",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-it-it", "Google News Italia", gnTopNews({ hl: "it", gl: "IT", ceid: "IT:it" }), "fr", "major"),
      feed("ansa-it", "ANSA", "https://www.ansa.it/sito/ansait_rss.xml", "fr", "major"),
      feed("ilpost-it", "Il Post", "https://www.ilpost.it/feed/", "fr", "independent"),
      feed("rai-radio-it", "RAI Radio (Google News)", gnSearch("RAI radio Italia", { hl: "it", gl: "IT", ceid: "IT:it" }), "fr", "radio"),
    ],
  },
];

export function getCountry(id: string | null | undefined): CountryConfig {
  const normalized = String(id ?? "TN").toUpperCase();
  return COUNTRIES.find((c) => c.id === normalized) ?? COUNTRIES[0]!;
}

