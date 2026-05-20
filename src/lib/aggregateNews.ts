import Parser from "rss-parser";
import type { FeedSource } from "./feeds";
import type { TopicKey } from "./topics";
import { inferTopicKey, topicLabel } from "./topics";

export type NewsArticle = {
  id: string;
  title: string;
  translatedTitle?: string | null;
  link: string;
  sourceLabel: string;
  sourceId: string;
  pubDate: string | null;
  summary: string | null;
  topic: string;
  topicKey: TopicKey;
  locale: "ar" | "fr";
  independentMedia: boolean;
  sourceKind: string | null;
  /** Hero image when the feed exposes media / enclosure (used in vintage share & PDF). */
  imageUrl: string | null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function shorten(text: string, max = 220): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + "…";
}

type ParsedItem = Parser.Item & {
  contentEncoded?: string;
  description?: string;
  mediaContent?: { $?: { url?: string; medium?: string; type?: string } } | Array<{ $?: { url?: string; medium?: string; type?: string } }>;
  mediaThumbnail?: { $?: { url?: string } };
  itunes?: { image?: string };
};

function decodeHtmlAttr(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const c = Number.parseInt(h, 16);
      return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : "";
    });
}

function resolveArticleImageUrl(raw: string, articleLink: string | undefined): string | null {
  const cleaned = decodeHtmlAttr(raw.trim());
  if (!cleaned || cleaned.startsWith("data:")) return null;
  try {
    const base = articleLink && /^https?:\/\//i.test(articleLink) ? articleLink : undefined;
    const u = base ? new URL(cleaned, base) : new URL(cleaned);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const href = u.href;
    if (/spacer|\/1x1|pixel\.gif|tracking|beacon|\/clear\.gif/i.test(href)) return null;
    return href;
  } catch {
    return null;
  }
}

/** First <img src> in RSS HTML bodies (many feeds omit enclosure but embed the photo in content). */
function pickImageFromEmbeddedHtml(item: ParsedItem): string | null {
  const pi = item as ParsedItem;
  const chunks = [item.content, pi.contentEncoded, item.summary, item.description].filter(
    (s): s is string => typeof s === "string" && s.length > 12,
  );
  const html = chunks.join("\n");
  if (!html) return null;
  const re = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3];
    if (!raw) continue;
    const abs = resolveArticleImageUrl(raw, item.link);
    if (abs) return abs;
  }
  return null;
}

function pickImageUrl(item: ParsedItem): string | null {
  const enc = item.enclosure;
  if (enc?.url && (!enc.type || enc.type.toLowerCase().startsWith("image"))) {
    return enc.url;
  }
  const thumb = item.mediaThumbnail;
  if (thumb?.$?.url) return thumb.$.url;
  const mc = item.mediaContent;
  const list = Array.isArray(mc) ? mc : mc ? [mc] : [];
  for (const c of list) {
    const u = c?.$?.url;
    if (!u) continue;
    const medium = c.$?.medium?.toLowerCase();
    const type = c.$?.type?.toLowerCase();
    if (medium === "image" || (type && type.startsWith("image/")) || (!medium && !type)) return u;
  }
  if (item.itunes?.image) return item.itunes.image;
  return null;
}

async function fetchOneFeed(source: FeedSource): Promise<NewsArticle[]> {
  const parser = new Parser({
    timeout: 9000,
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    customFields: {
      item: [
        ["media:content", "mediaContent", { keepArray: true }],
        ["media:thumbnail", "mediaThumbnail"],
        ["content:encoded", "contentEncoded"],
      ],
    },
  });

  const feed = await parser.parseURL(source.url);
  const items = feed.items ?? [];
  const cap = source.locale === "ar" ? 22 : 16;
  const independentMedia = source.independentMedia === true;
  const sourceKind = source.kind ?? null;

  return items.slice(0, cap).map((item, idx) => {
    const pi = item as ParsedItem;
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
      independentMedia,
      sourceKind,
      imageUrl: pickImageUrl(pi) ?? pickImageFromEmbeddedHtml(pi),
    };
  });
}

export type AggregateResult = {
  articles: NewsArticle[];
  errors: { sourceId: string; message: string }[];
  fetchedAt: string;
};

function byDateDesc(a: NewsArticle, b: NewsArticle): number {
  const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
  const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
  return tb - ta;
}

export async function aggregateFromFeeds(feeds: FeedSource[]): Promise<AggregateResult> {
  const errors: { sourceId: string; message: string }[] = [];
  const batches = await Promise.all(
    feeds.map(async (source) => {
      try {
        return await fetchOneFeed(source);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ sourceId: source.id, message });
        return [] as NewsArticle[];
      }
    }),
  );

  const merged = batches.flat();
  const seen = new Set<string>();
  const deduped: NewsArticle[] = [];

  for (const a of merged) {
    const key = a.link.split("?")[0] ?? a.link;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }

  const independent = deduped.filter((a) => a.independentMedia).sort(byDateDesc);
  const rest = deduped.filter((a) => !a.independentMedia).sort(byDateDesc);
  const ordered = [...independent, ...rest];

  return {
    articles: ordered.slice(0, 140),
    errors,
    fetchedAt: new Date().toISOString(),
  };
}
