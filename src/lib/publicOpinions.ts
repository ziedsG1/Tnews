import type { NewsArticle } from "@/lib/aggregateNews";
import type { CountryId, UiLang } from "@/lib/countries";
import { inferTopicKey, topicLabel } from "@/lib/topics";

export type StoredOpinion = {
  id: string;
  countryId: CountryId;
  body: string;
  author: string;
  createdAt: string;
};

const PUBLIC_TOPIC: Record<UiLang, string> = {
  ar: "رأي العام",
  fr: "Opinion publique",
  en: "Public opinion",
};

const ANON: Record<UiLang, string> = {
  ar: "مجهول",
  fr: "Anonyme",
  en: "Anonymous",
};

/** Map a stored row to the same card shape as RSS articles (sidebar + share). */
export function opinionToArticle(row: StoredOpinion, uiLang: UiLang, siteOrigin: string): NewsArticle {
  const locale: "ar" | "fr" = uiLang === "ar" ? "ar" : "fr";
  const trimmed = row.body.trim();
  const headline = trimmed.length > 200 ? `${trimmed.slice(0, 199).trimEnd()}…` : trimmed;
  const author = row.author.trim();
  const origin = siteOrigin.replace(/\/$/, "") || "";
  const hash = `op-${encodeURIComponent(row.id)}`;
  const link = origin ? `${origin}/#${hash}` : `#${hash}`;
  const sourceLabel = author || ANON[uiLang];

  return {
    id: `op:${row.id}`,
    title: headline,
    translatedTitle: headline,
    link,
    sourceLabel,
    sourceId: "public-opinion",
    pubDate: row.createdAt,
    summary: trimmed,
    topic: `${PUBLIC_TOPIC[uiLang]} · ${topicLabel(trimmed, locale)}`,
    topicKey: inferTopicKey(trimmed),
    locale,
    independentMedia: false,
    sourceKind: "opinion",
    imageUrl: null,
  };
}
