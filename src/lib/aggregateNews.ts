import Parser from "rss-parser";
import type { FeedSource } from "./feeds";
import type { TopicKey } from "./topics";
import { inferTopicKey, topicLabel } from "./topics";

export type NewsArticle = {
  id: string;
  title: string;
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

async function fetchOneFeed(source: FeedSource): Promise<NewsArticle[]> {
  const parser = new Parser({
    timeout: 12000,
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });

  const feed = await parser.parseURL(source.url);
  const items = feed.items ?? [];
  const cap = source.locale === "ar" ? 22 : 16;
  const independentMedia = source.independentMedia === true;
  const sourceKind = source.kind ?? null;

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
      independentMedia,
      sourceKind,
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
