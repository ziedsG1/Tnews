import type { FeedKind, FeedLocale, FeedSource } from "./feeds";
import { DEFAULT_FEEDS } from "./feeds";

export type CountryId =
  | "TN"
  | "DZ"
  | "MA"
  | "FR"
  | "US"
  | "EG"
  | "QA"
  | "SA"
  | "GB"
  | "IT"
  | "IL"
  | "ES"
  | "DE"
  | "TR"
  | "LY"
  | "IR"
  | "RU"
  | "JP"
  | "CN"
  | "IN";
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
  {
    id: "IL",
    brand: "ILnews",
    names: {
      ar: "إسرائيل",
      fr: "Israël",
      en: "Israel",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-il-en", "Google News Israel", gnTopNews({ hl: "en", gl: "IL", ceid: "IL:en" }), "ar", "major"),
      feed("gn-il-ar", "أخبار إسرائيل (Google News)", gnSearch("إسرائيل", { hl: "ar", gl: "IL", ceid: "IL:ar" }), "ar", "major"),
      feed("gn-il-he", "Google News (עברית)", gnTopNews({ hl: "he", gl: "IL", ceid: "IL:he" }), "fr", "major"),
      feed("gn-il-haaretz", "Haaretz (Google News)", gnSearch("site:haaretz.com", { hl: "en", gl: "IL", ceid: "IL:en" }), "fr", "independent"),
    ],
  },
  {
    id: "ES",
    brand: "ESnews",
    names: {
      ar: "إسبانيا",
      fr: "Espagne",
      en: "Spain",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-es-es", "Google News España", gnTopNews({ hl: "es", gl: "ES", ceid: "ES:es" }), "fr", "major"),
      feed("elpais-es", "El País", "https://feeds.elpais.com/m/rss-s/pages/ep/site/elpais.com/portada", "fr", "major"),
      feed("eldiario-es", "elDiario.es", "https://www.eldiario.es/rss/", "fr", "independent"),
      feed("gn-es-radio", "Radio España (Google News)", gnSearch("radio España noticias", { hl: "es", gl: "ES", ceid: "ES:es" }), "fr", "radio"),
    ],
  },
  {
    id: "DE",
    brand: "DEnews",
    names: {
      ar: "ألمانيا",
      fr: "Allemagne",
      en: "Germany",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-de-de", "Google News Deutschland", gnTopNews({ hl: "de", gl: "DE", ceid: "DE:de" }), "fr", "major"),
      feed("spiegel-de", "Der Spiegel", "https://www.spiegel.de/schlagzeilen/index.rss", "fr", "major"),
      feed("taz-de", "taz", "https://taz.de/!p4608/rss.xml", "fr", "independent"),
      feed("gn-de-radio", "Deutschlandradio (Google News)", gnSearch("Deutschlandradio", { hl: "de", gl: "DE", ceid: "DE:de" }), "fr", "radio"),
    ],
  },
  {
    id: "TR",
    brand: "TRnews",
    names: {
      ar: "تركيا",
      fr: "Turquie",
      en: "Turkey",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-tr-tr", "Google News Türkiye", gnTopNews({ hl: "tr", gl: "TR", ceid: "TR:tr" }), "ar", "major"),
      feed("gn-tr-ar", "أخبار تركيا (Google News)", gnSearch("تركيا", { hl: "ar", gl: "TR", ceid: "TR:ar" }), "ar", "major"),
      feed("gn-tr-top-ar", "الأكثر تداولا (Google News)", gnTopNews({ hl: "ar", gl: "TR", ceid: "TR:ar" }), "ar", "major"),
      feed("gn-tr-indie", "صحافة مستقلة (Google News)", gnSearch("تركيا independent journalism", { hl: "ar", gl: "TR", ceid: "TR:ar" }), "ar", "independent"),
    ],
  },
  {
    id: "LY",
    brand: "LYnews",
    names: {
      ar: "ليبيا",
      fr: "Libye",
      en: "Libya",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-ly-ar", "أخبار ليبيا (Google News)", gnSearch("ليبيا", { hl: "ar", gl: "LY", ceid: "LY:ar" }), "ar", "major"),
      feed("gn-ly-top-ar", "الأكثر تداولا (Google News)", gnTopNews({ hl: "ar", gl: "LY", ceid: "LY:ar" }), "ar", "major"),
      feed("gn-ly-tripoli", "طرابلس (Google News)", gnSearch("طرابلس ليبيا", { hl: "ar", gl: "LY", ceid: "LY:ar" }), "ar", "major"),
      feed("gn-ly-benghazi", "بنغازي (Google News)", gnSearch("بنغازي ليبيا", { hl: "ar", gl: "LY", ceid: "LY:ar" }), "ar", "major"),
    ],
  },
  {
    id: "IR",
    brand: "IRnews",
    names: {
      ar: "إيران",
      fr: "Iran",
      en: "Iran",
    },
    primaryLocale: "ar",
    feeds: [
      feed("gn-ir-fa", "Google News ایران", gnTopNews({ hl: "fa", gl: "IR", ceid: "IR:fa" }), "ar", "major"),
      feed("gn-ir-ar", "أخبار إيران (Google News)", gnSearch("إيران", { hl: "ar", gl: "IR", ceid: "IR:ar" }), "ar", "major"),
      feed("gn-ir-en", "Iran (Google News EN)", gnTopNews({ hl: "en", gl: "IR", ceid: "IR:en" }), "fr", "major"),
      feed("gn-ir-bbc", "BBC Persian (Google News)", gnSearch("site:bbc.com/persian", { hl: "fa", gl: "IR", ceid: "IR:fa" }), "ar", "independent"),
    ],
  },
  {
    id: "RU",
    brand: "RUnews",
    names: {
      ar: "روسيا",
      fr: "Russie",
      en: "Russia",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-ru-ru", "Google News Россия", gnTopNews({ hl: "ru", gl: "RU", ceid: "RU:ru" }), "fr", "major"),
      feed("gn-ru-en", "Russia (Google News EN)", gnTopNews({ hl: "en", gl: "RU", ceid: "RU:en" }), "fr", "major"),
      feed("gn-ru-ar", "روسيا (Google News)", gnSearch("روسيا", { hl: "ar", gl: "RU", ceid: "RU:ar" }), "ar", "major"),
      feed("gn-ru-meduza", "Meduza (Google News)", gnSearch("site:meduza.io", { hl: "en", gl: "RU", ceid: "RU:en" }), "fr", "independent"),
    ],
  },
  {
    id: "JP",
    brand: "JPnews",
    names: {
      ar: "اليابان",
      fr: "Japon",
      en: "Japan",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-jp-jp", "Google ニュース", gnTopNews({ hl: "ja", gl: "JP", ceid: "JP:ja" }), "fr", "major"),
      feed("gn-jp-en", "Japan (Google News EN)", gnTopNews({ hl: "en", gl: "JP", ceid: "JP:en" }), "fr", "major"),
      feed("nhk-en", "NHK World", "https://www3.nhk.or.jp/nhkworld/en/news/rss/today.xml", "fr", "major"),
      feed("gn-jp-indie", "Japan independent (Google News)", gnSearch("Japan independent journalism", { hl: "en", gl: "JP", ceid: "JP:en" }), "fr", "independent"),
    ],
  },
  {
    id: "CN",
    brand: "CNnews",
    names: {
      ar: "الصين",
      fr: "Chine",
      en: "China",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-cn-zh", "Google新闻 中国", gnTopNews({ hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" }), "fr", "major"),
      feed("gn-cn-en", "China (Google News EN)", gnTopNews({ hl: "en", gl: "CN", ceid: "CN:en" }), "fr", "major"),
      feed("gn-cn-ar", "الصين (Google News)", gnSearch("الصين", { hl: "ar", gl: "CN", ceid: "CN:ar" }), "ar", "major"),
      feed("gn-cn-scmp", "South China Morning Post (GN)", gnSearch("site:scmp.com", { hl: "en", gl: "CN", ceid: "CN:en" }), "fr", "independent"),
    ],
  },
  {
    id: "IN",
    brand: "INnews",
    names: {
      ar: "الهند",
      fr: "Inde",
      en: "India",
    },
    primaryLocale: "fr",
    feeds: [
      feed("gn-in-en", "Google News India", gnTopNews({ hl: "en", gl: "IN", ceid: "IN:en" }), "fr", "major"),
      feed("gn-in-hi", "Google News भारत", gnTopNews({ hl: "hi", gl: "IN", ceid: "IN:hi" }), "fr", "major"),
      feed("gn-in-ar", "الهند (Google News)", gnSearch("الهند", { hl: "ar", gl: "IN", ceid: "IN:ar" }), "ar", "major"),
      feed("gn-in-scroll", "Scroll.in (Google News)", gnSearch("site:scroll.in", { hl: "en", gl: "IN", ceid: "IN:en" }), "fr", "independent"),
    ],
  },
];

export function getCountry(id: string | null | undefined): CountryConfig {
  const normalized = String(id ?? "TN").toUpperCase();
  return COUNTRIES.find((c) => c.id === normalized) ?? COUNTRIES[0]!;
}

