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
      feed("algerie360", "Algérie360", "https://www.algerie360.com/feed/", "ar", "major"),
      feed("ennahar-dz", "النهار — Ennahar", "https://www.ennaharonline.com/rss/", "ar", "major"),
      feed("tsa-dz", "TSA — التصدي", "https://www.tsa-algerie.com/feed/", "fr", "independent"),
      feed("elkhabar-dz", "الخبر — El Khabar", "https://www.elkhabar.com/feed/", "ar", "independent"),
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
      feed("hespress", "هسبريس", "https://www.hespress.com/feed/", "ar", "major"),
      feed("assabah-ma", "الصباح — Assabah", "https://www.assabah.ma/feed", "ar", "major"),
      feed("yabiladi", "يابلادي — Yabiladi", "https://www.yabiladi.com/rss/", "ar", "independent"),
      feed("medias24", "Medias24", "https://www.medias24.com/feed/", "fr", "major"),
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
      feed("bfmtv", "BFMTV", "https://www.bfmtv.com/rss/news-24-7/", "fr", "major"),
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
      feed("nbc-us", "NBC News (world)", "https://feeds.nbcnews.com/nbcnews/public/world", "fr", "major"),
      feed("thehill-us", "The Hill", "https://thehill.com/homenews/feed/", "fr", "major"),
      feed("cnn-us", "CNN — top stories", "http://rss.cnn.com/rss/cnn_topstories.rss", "fr", "major"),
      feed("propublica", "ProPublica", "https://www.propublica.org/feeds/propublica/main", "fr", "independent"),
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
      feed("bbc-arabic-eg", "BBC عربي", "https://feeds.bbci.co.uk/arabic/rss.xml", "ar", "major"),
      feed("skynews-arabia-eg", "سكاي نيوز عربية", "https://www.skynewsarabia.com/rss.xml", "ar", "major"),
      feed("aa-arabic-eg", "وكالة الأناضول", "https://www.aa.com.tr/ar/rss/default?cat=guncel", "ar", "state"),
      feed("mada-masr", "مدى مصر — Mada Masr", "https://madamasr.com/en/feed/", "ar", "independent"),
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
      feed("aljazeera-ar", "الجزيرة — عربي", "https://www.aljazeera.net/rss", "ar", "major"),
      feed("aljazeera-en", "Al Jazeera — English", "https://www.aljazeera.com/xml/rss/all.xml", "fr", "major"),
      feed("dohanews", "Doha News", "https://dohanews.co/feed/", "fr", "independent"),
      feed("alaraby", "العربي الجديد — Al-Araby Al-Jadeed", "https://www.alaraby.co.uk/rss", "ar", "independent"),
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
      feed("arabnews-sa", "Arab News", "https://www.arabnews.com/rss.xml", "fr", "major"),
      feed("arabnews-saudi", "Arab News — السعودية", "https://www.arabnews.com/cat/2/rss.xml", "fr", "major"),
      feed("memo-sa", "Middle East Monitor", "https://www.middleeastmonitor.com/feed/", "fr", "independent"),
      feed("aa-arabic-sa", "وكالة الأناضول", "https://www.aa.com.tr/ar/rss/default?cat=guncel", "ar", "state"),
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
      feed("skynews-uk", "Sky News UK", "https://feeds.skynews.com/feeds/rss/uk.xml", "fr", "major"),
      feed("bbc-uk", "BBC News", "https://feeds.bbci.co.uk/news/rss.xml", "fr", "major"),
      feed("guardian-uk", "The Guardian", "https://www.theguardian.com/world/rss", "fr", "independent"),
      feed("metro-uk", "Metro", "https://metro.co.uk/news/feed/", "fr", "major"),
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
      feed("corriere-it", "Corriere della Sera", "https://xml.corriereobjects.it/rss/homepage.xml", "fr", "major"),
      feed("ansa-it", "ANSA", "https://www.ansa.it/sito/ansait_rss.xml", "fr", "major"),
      feed("ilpost-it", "Il Post", "https://www.ilpost.it/feed/", "fr", "independent"),
      feed("adnkronos-it", "Adnkronos", "https://www.adnkronos.com/RSS_PrimaPagina.xml", "fr", "major"),
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
      feed("jpost-il", "Jerusalem Post", "https://www.jpost.com/Rss/RssFeedsHeadlines.aspx", "ar", "major"),
      feed("ynet-il", "Ynet", "https://www.ynet.co.il/Integration/StoryRss2.xml", "ar", "major"),
      feed("bbc-me-il", "BBC — الشرق الأوسط", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", "ar", "major"),
      feed("972mag-il", "+972 Magazine", "https://www.972mag.com/feed/", "fr", "independent"),
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
      feed("rtve-es", "RTVE — noticias", "https://www.rtve.es/rss/temas_noticias.xml", "fr", "state"),
      feed("elpais-es", "El País", "https://feeds.elpais.com/m/rss-s/pages/ep/site/elpais.com/portada", "fr", "major"),
      feed("eldiario-es", "elDiario.es", "https://www.eldiario.es/rss/", "fr", "independent"),
      feed("abc-es", "ABC", "https://www.abc.es/rss/feeds/abcPortada.xml", "fr", "major"),
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
      feed("tagesschau-de", "tagesschau (ARD)", "https://www.tagesschau.de/index~rss2.xml", "fr", "state"),
      feed("spiegel-de", "Der Spiegel", "https://www.spiegel.de/schlagzeilen/index.rss", "fr", "major"),
      feed("taz-de", "taz", "https://taz.de/!p4608/rss.xml", "fr", "independent"),
      feed("dw-de", "DW (Deutsche Welle)", "https://rss.dw.com/rdf/rss-en-all", "fr", "radio"),
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
      feed("aa-tr", "وكالة الأناضول", "https://www.aa.com.tr/ar/rss/default?cat=guncel", "ar", "state"),
      feed("cumhuriyet-tr", "Cumhuriyet", "https://www.cumhuriyet.com.tr/rss", "ar", "independent"),
      feed("hurriyet-tr", "Hürriyet", "https://www.hurriyet.com.tr/rss/gundem", "ar", "major"),
      feed("bbc-turkce", "BBC Türkçe", "https://feeds.bbci.co.uk/turkce/rss.xml", "ar", "major"),
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
      feed("libyaherald", "Libya Herald", "https://www.libyaherald.com/feed/", "fr", "major"),
      feed("skynews-arabia-ly", "سكاي نيوز عربية", "https://www.skynewsarabia.com/rss.xml", "ar", "major"),
      feed("bbc-arabic-ly", "BBC عربي", "https://feeds.bbci.co.uk/arabic/rss.xml", "ar", "major"),
      feed("aa-arabic-ly", "وكالة الأناضول", "https://www.aa.com.tr/ar/rss/default?cat=guncel", "ar", "state"),
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
      feed("presstv-ir", "Press TV", "https://www.presstv.ir/rss.xml", "ar", "state"),
      feed("tehrantimes-ir", "Tehran Times", "https://www.tehrantimes.com/rss", "fr", "major"),
      feed("mehr-ir", "Mehr News (EN)", "https://en.mehrnews.com/rss", "fr", "major"),
      feed("bbc-persian-ir", "BBC فارسی", "https://feeds.bbci.co.uk/persian/rss.xml", "ar", "independent"),
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
      feed("tass-ru", "TASS", "https://tass.com/rss/v2.xml", "fr", "state"),
      feed("kommersant-ru", "Kommersant", "https://www.kommersant.ru/RSS/news.xml", "fr", "major"),
      feed("meduza-ru", "Meduza", "https://meduza.io/rss/all", "fr", "independent"),
      feed("moscowtimes-ru", "The Moscow Times", "https://www.themoscowtimes.com/rss/news", "fr", "major"),
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
      feed("nhk-jp", "NHK World", "https://www3.nhk.or.jp/nhkworld/en/news/rss/today.xml", "fr", "major"),
      feed("japantimes-jp", "Japan Times", "https://www.japantimes.co.jp/feed/", "fr", "major"),
      feed("nippon-jp", "Nippon.com", "https://www.nippon.com/en/feed/", "fr", "major"),
      feed("diplomat-jp", "The Diplomat (Asie-Pacifique)", "https://thediplomat.com/feed/", "fr", "major"),
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
      feed("chinadaily-cn", "China Daily", "http://www.chinadaily.com.cn/rss/china_rss.xml", "fr", "state"),
      feed("globaltimes-cn", "Global Times", "https://www.globaltimes.cn/rss/outbrain.xml", "fr", "state"),
      feed("xinhua-cn", "Xinhua (world, EN)", "http://www.xinhuanet.com/english/rss/worldrss.xml", "fr", "state"),
      feed("scmp-cn", "South China Morning Post", "https://www.scmp.com/rss/2/feed", "fr", "independent"),
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
      feed("hindu-in", "The Hindu", "https://www.thehindu.com/news/feeder/default.rss", "fr", "major"),
      feed("ndtv-in", "NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories", "fr", "major"),
      feed("bbc-india-in", "BBC News — India", "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", "fr", "major"),
      feed("altnews-in", "Alt News", "https://www.altnews.in/feed/", "fr", "independent"),
    ],
  },
];

export function getCountry(id: string | null | undefined): CountryConfig {
  const normalized = String(id ?? "TN").toUpperCase();
  return COUNTRIES.find((c) => c.id === normalized) ?? COUNTRIES[0]!;
}
