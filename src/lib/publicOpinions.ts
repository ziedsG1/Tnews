import type { NewsArticle } from "@/lib/aggregateNews";
import type { CountryId, UiLang } from "@/lib/countries";
import { inferTopicKey, topicLabel } from "@/lib/topics";

export type StoredOpinion = {
  id: string;
  countryId: CountryId;
  body: string;
  author: string;
  createdAt: string;
  username: string;
};

/** Row shape returned by PostgREST for `public_opinions` + embedded `profiles`. */
export type OpinionDbRow = {
  id: string;
  user_id: string;
  country_id: string;
  body: string;
  created_at: string;
  profiles: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null;
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

export function storedOpinionFromDbRow(row: OpinionDbRow): StoredOpinion | null {
  const p = row.profiles;
  const profile = Array.isArray(p) ? p[0] : p;
  if (!profile?.username) return null;
  const author = (profile.display_name?.trim() || profile.username).trim();
  return {
    id: row.id,
    countryId: row.country_id as CountryId,
    body: row.body,
    author,
    createdAt: row.created_at,
    username: profile.username,
  };
}

/** Map a stored row to the same card shape as RSS articles (sidebar + share). */
export function opinionToArticle(row: StoredOpinion, uiLang: UiLang, siteOrigin: string): NewsArticle {
  const locale: "ar" | "fr" = uiLang === "ar" ? "ar" : "fr";
  const trimmed = row.body.trim();
  const headline = trimmed.length > 200 ? `${trimmed.slice(0, 199).trimEnd()}…` : trimmed;
  const author = row.author.trim();
  const origin = siteOrigin.replace(/\/$/, "") || "";
  const profilePath = `/u/${encodeURIComponent(row.username)}`;
  const hash = `op-${encodeURIComponent(row.id)}`;
  const link = origin ? `${origin}${profilePath}#${hash}` : `${profilePath}#${hash}`;
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

/** Extract Postgres UUID from synthetic article id `op:<uuid>`. */
export function opinionUuidFromArticleId(articleId: string): string | null {
  if (!articleId.startsWith("op:")) return null;
  const rest = articleId.slice(3);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rest)
  ) {
    return null;
  }
  return rest;
}
