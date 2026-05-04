export type FeedLocale = "ar" | "fr";

export type FeedSource = {
  id: string;
  label: string;
  /** RSS URL — fetched server-side (no browser CORS). */
  url: string;
  /** Language of the feed / edition (for grouping in the UI). */
  locale: FeedLocale;
  /** Shown first in the feed; order within this group is shuffled on each refresh. */
  independentMedia?: boolean;
};

/**
 * Arabic-first Tunisian media (Google News by site when RSS isn’t public)
 * + French feeds for readers who want both.
 */
export const DEFAULT_FEEDS: FeedSource[] = [
  // ——— Arabic / tunisian outlets & Tunisia-focused wires ———
  {
    id: "google-tunisia-ar",
    label: "أخبار تونس (مجمّع)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent("تونس")}&hl=ar&gl=TN&ceid=TN%3Aar`,
    locale: "ar",
  },
  // Official portal (e.g. /ar/الرائد_الرسمي) — no stable public RSS; aggregate via Google News by host.
  {
    id: "carthage-ar",
    label: "الرائد الرسمي — قرطاج",
    url: "https://news.google.com/rss/search?q=site%3Awww.carthage.tn&hl=ar&gl=TN&ceid=TN%3Aar",
    locale: "ar",
  },
  {
    id: "aljazeera-tunisia-ar",
    label: "الجزيرة — تونس",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent("site:aljazeera.net تونس")}&hl=ar&gl=TN&ceid=TN%3Aar`,
    locale: "ar",
  },
  {
    id: "mosaique-ar",
    label: "موزاييك أف أم — العربية",
    url: "https://news.google.com/rss/search?q=site%3Amosaiquefm.net&hl=ar&gl=TN&ceid=TN%3Aar",
    locale: "ar",
  },
  {
    id: "diwan-ar",
    label: "ديوان أف أم",
    url: "https://news.google.com/rss/search?q=site%3Adiwanfm.net&hl=ar&gl=TN&ceid=TN%3Aar",
    locale: "ar",
  },
  {
    id: "jawhara-ar",
    label: "جوهرة أف أم",
    url: "https://news.google.com/rss/search?q=site%3Ajawharafm.net&hl=ar&gl=TN&ceid=TN%3Aar",
    locale: "ar",
  },
  {
    id: "express-ar",
    label: "اكسبريس أف أم",
    url: "https://news.google.com/rss/search?q=site%3Aexpressfm.tn&hl=ar&gl=TN&ceid=TN%3Aar",
    locale: "ar",
  },
  {
    id: "shems-ar",
    label: "شمس أف أم",
    url: "https://news.google.com/rss/search?q=site%3Ashemsfm.net&hl=ar&gl=TN&ceid=TN%3Aar",
    locale: "ar",
  },
  // nawaat.org — independent Tunisia-focused journalism (feed may mix ar/fr/en).
  {
    id: "nawaat",
    label: "نواة — Nawaat",
    url: "https://nawaat.org/feed/",
    locale: "ar",
    independentMedia: true,
  },
  // alqatiba.com — investigative Arabic journalism.
  {
    id: "alqatiba",
    label: "الكتيبة — Alqatiba",
    url: "https://alqatiba.com/feed/",
    locale: "ar",
    independentMedia: true,
  },
  // rassdtunisia.net — Tunisian news outlet.
  {
    id: "rassd-tunisia",
    label: "رصد تونس — Rassd",
    url: "https://rassdtunisia.net/feed/",
    locale: "ar",
    independentMedia: true,
  },
  // ——— French ———
  {
    id: "businessnews",
    label: "Business News",
    url: "https://www.businessnews.com.tn/rss",
    locale: "fr",
  },
  {
    id: "google-tunisia-fr",
    label: "Actualités Tunisie (agrégé)",
    url: "https://news.google.com/rss/search?q=Tunisie&hl=fr&gl=TN&ceid=TN%3Afr",
    locale: "fr",
  },
  {
    id: "webdo-fr",
    label: "Webdo.tn",
    url: "https://news.google.com/rss/search?q=site%3Awebdo.tn&hl=fr&gl=TN&ceid=TN%3Afr",
    locale: "fr",
  },
];
