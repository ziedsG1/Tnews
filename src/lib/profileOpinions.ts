import type { NewsArticle } from "@/lib/aggregateNews";
import type { UiLang } from "@/lib/countries";
import type { OpinionDbRow } from "@/lib/publicOpinions";
import { opinionToArticle, storedOpinionFromDbRow } from "@/lib/publicOpinions";

export type OpinionRowCore = {
  id: string;
  user_id: string;
  country_id: string;
  body: string;
  created_at: string;
};

export function opinionRowsToArticles(
  rows: OpinionRowCore[],
  profile: { username: string; display_name: string | null },
  uiLang: UiLang,
  siteOrigin: string,
): NewsArticle[] {
  const list: NewsArticle[] = [];
  for (const r of rows) {
    const row: OpinionDbRow = {
      ...r,
      profiles: { username: profile.username, display_name: profile.display_name },
    };
    const s = storedOpinionFromDbRow(row);
    if (s) list.push(opinionToArticle(s, uiLang, siteOrigin));
  }
  return list;
}
