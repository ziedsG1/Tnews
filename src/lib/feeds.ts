export type FeedLocale = "ar" | "fr";

export type FeedKind = "independent" | "state" | "major" | "radio" | "journalist";

export type FeedSource = {
  id: string;
  label: string;
  /** RSS URL — fetched server-side (no browser CORS). */
  url: string;
  /** Language of the feed / edition (for grouping in the UI). */
  locale: FeedLocale;
  /** Type of outlet (for badges / filtering / transparency). */
  kind?: FeedKind;
  /** Shown first in the feed; order within this group is shuffled on each refresh. */
  independentMedia?: boolean;
};

/**
 * Arabic-first Tunisian media (direct RSS: wire, press, radios, independents)
 * + French feeds for readers who want both.
 */
export const DEFAULT_FEEDS: FeedSource[] = [
  // ——— Arabic / Tunisia: official wire + major press + radios + independents ———
  {
    id: "tap-tn-ar",
    label: "وكالة تونس إفريقيا للأنباء (TAP)",
    url: "https://www.tap.info.tn/ar/rss/tunisia",
    locale: "ar",
    kind: "state",
  },
  {
    id: "lapresse-tn-ar",
    label: "La Presse — الصحافة",
    url: "https://www.lapresse.tn/feed/",
    locale: "ar",
    kind: "major",
  },
  {
    id: "mosaique-ar",
    label: "موزاييك أف أم",
    url: "https://www.mosaiquefm.net/ar/rss/",
    locale: "ar",
    kind: "radio",
  },
  {
    id: "express-ar",
    label: "Express FM",
    url: "https://www.radioexpressfm.com/ar/feed/",
    locale: "ar",
    kind: "radio",
  },
  {
    id: "shems-ar",
    label: "شمس أف أم",
    url: "https://www.shemsfm.net/ar/feed/",
    locale: "ar",
    kind: "radio",
  },
  {
    id: "jawhara-ar",
    label: "جوهرة أف أم",
    url: "https://www.jawharafm.net/ar/feed/",
    locale: "ar",
    kind: "radio",
  },
  // nawaat.org — independent Tunisia-focused journalism (feed may mix ar/fr/en).
  {
    id: "nawaat",
    label: "نواة — Nawaat",
    url: "https://nawaat.org/feed/",
    locale: "ar",
    independentMedia: true,
    kind: "independent",
  },
  // alqatiba.com — investigative Arabic journalism.
  {
    id: "alqatiba",
    label: "الكتيبة — Alqatiba",
    url: "https://alqatiba.com/feed/",
    locale: "ar",
    independentMedia: true,
    kind: "independent",
  },
  // rassdtunisia.net — Tunisian news outlet.
  {
    id: "rassd-tunisia",
    label: "رصد تونس — Rassd",
    url: "https://rassdtunisia.net/feed/",
    locale: "ar",
    independentMedia: true,
    kind: "independent",
  },
  // ——— French ———
  {
    id: "businessnews",
    label: "Business News",
    url: "https://www.businessnews.com.tn/rss",
    locale: "fr",
    kind: "major",
  },
  {
    id: "lapresse-tn-fr",
    label: "La Presse (actualités)",
    url: "https://www.lapresse.tn/feed/",
    locale: "fr",
    kind: "major",
  },
  {
    id: "webdo-fr",
    label: "Webdo.tn",
    url: "https://www.webdo.tn/feed/",
    locale: "fr",
    kind: "major",
  },
];
