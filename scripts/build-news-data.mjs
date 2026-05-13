import fs from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";

const FEEDS = [
  { id: "tap-tn-ar", label: "وكالة تونس إفريقيا للأنباء (TAP)", url: "https://www.tap.info.tn/ar/rss/tunisia", locale: "ar", independentMedia: false },
  { id: "lapresse-tn-ar", label: "La Presse — الصحافة", url: "https://www.lapresse.tn/feed/", locale: "ar", independentMedia: false },
  { id: "mosaique-ar", label: "موزاييك أف أم", url: "https://www.mosaiquefm.net/ar/rss/", locale: "ar", independentMedia: false },
  { id: "express-ar", label: "Express FM", url: "https://www.radioexpressfm.com/ar/feed/", locale: "ar", independentMedia: false },
  { id: "shems-ar", label: "شمس أف أم", url: "https://www.shemsfm.net/ar/feed/", locale: "ar", independentMedia: false },
  { id: "jawhara-ar", label: "جوهرة أف أم", url: "https://www.jawharafm.net/ar/feed/", locale: "ar", independentMedia: false },
  { id: "nawaat", label: "نواة — Nawaat", url: "https://nawaat.org/feed/", locale: "ar", independentMedia: true },
  { id: "alqatiba", label: "الكتيبة — Alqatiba", url: "https://alqatiba.com/feed/", locale: "ar", independentMedia: true },
  { id: "rassd-tunisia", label: "رصد تونس — Rassd", url: "https://rassdtunisia.net/feed/", locale: "ar", independentMedia: true },
  { id: "businessnews", label: "Business News", url: "https://www.businessnews.com.tn/rss", locale: "fr", independentMedia: false },
  { id: "lapresse-tn-fr", label: "La Presse (actualités)", url: "https://www.lapresse.tn/feed/", locale: "fr", independentMedia: false },
  { id: "webdo-fr", label: "Webdo.tn", url: "https://www.webdo.tn/feed/", locale: "fr", independentMedia: false },
];

const RULES = [
  { key: "sport", patterns: [/sport/i, /football/i, /liga/i, /club\s+africain/i, /stade/i, /match/i, /كرة/i, /الرابطة/i, /استحقاق/i] },
  { key: "economy", patterns: [/économ/i, /banque/i, /finance/i, /dinar/i, /bourse/i, /invest/i, /اقتصاد/i, /دينار/i, /بنك/i] },
  { key: "politics", patterns: [/président/i, /gouvern/i, /élection/i, /parlement/i, /minist/i, /état/i, /حكوم/i, /رئاس/i, /وزير/i] },
  { key: "culture", patterns: [/culture/i, /livre/i, /musée/i, /cinéma/i, /concert/i, /théâtre/i, /ثقاف/i, /معرض/i] },
  { key: "world", patterns: [/international/i, /monde/i, /états-unis/i, /europe/i, /chine/i, /غزة/i, /أمريك/i, /عالم/i] },
  { key: "tunisia", patterns: [/tunisi/i, /tunis\b/i, /sfax/i, /mahdia/i, /autoroute/i, /طقس/i, /تونس/i, /صفاقس/i, /سوسة/i] },
];

const TOPIC_FR = { sport: "Sport", economy: "Économie", politics: "Politique", culture: "Culture", world: "International", tunisia: "Tunisie", general: "Général" };
const TOPIC_AR = { sport: "رياضة", economy: "اقتصاد", politics: "سياسة", culture: "ثقافة", world: "عالمي", tunisia: "تونس", general: "عام" };

function inferTopicKey(title) {
  const t = String(title || "").trim();
  for (const { key, patterns } of RULES) {
    if (patterns.some((p) => p.test(t))) return key;
  }
  return "general";
}

function topicLabel(title, locale) {
  const key = inferTopicKey(title);
  return locale === "ar" ? TOPIC_AR[key] : TOPIC_FR[key];
}

function byDateDesc(a, b) {
  const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
  const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
  return tb - ta;
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function shorten(text, max = 220) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + "…";
}

async function main() {
  const parser = new Parser({
    timeout: 12000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  const errors = [];
  const batches = await Promise.all(
    FEEDS.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        const items = feed.items ?? [];
        const cap = source.locale === "ar" ? 22 : 16;
        return items.slice(0, cap).map((item, idx) => {
          const title = (item.title ?? (source.locale === "ar" ? "بدون عنوان" : "Sans titre")).trim();
          const link = item.link ?? "#";
          const rawDesc = item.contentSnippet ?? item.content ?? item.summary ?? "";
          const summary = rawDesc ? shorten(stripHtml(rawDesc)) : null;
          const pubDate = item.pubDate ?? item.isoDate ?? null;
          const id = `${source.id}:${link}:${idx}`;
          const topicKey = inferTopicKey(title);
          return {
            id,
            title,
            link,
            sourceLabel: source.label,
            sourceId: source.id,
            pubDate,
            summary,
            topic: topicLabel(title, source.locale),
            topicKey,
            locale: source.locale,
            independentMedia: source.independentMedia === true,
          };
        });
      } catch (e) {
        errors.push({ sourceId: source.id, message: e instanceof Error ? e.message : String(e) });
        return [];
      }
    }),
  );

  const merged = batches.flat();
  const seen = new Set();
  const deduped = [];
  for (const a of merged) {
    const key = (a.link || "").split("?")[0] || a.link;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }

  const independent = deduped.filter((a) => a.independentMedia).sort(byDateDesc);
  const rest = deduped.filter((a) => !a.independentMedia).sort(byDateDesc);

  const payload = {
    articles: [...independent, ...rest].slice(0, 140),
    errors,
    fetchedAt: new Date().toISOString(),
  };

  const publicDir = path.resolve(process.cwd(), "public");
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, "news-data.json"), JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(path.join(publicDir, ".nojekyll"), "", "utf8");
  console.log(`Generated public/news-data.json (${payload.articles.length} articles)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
