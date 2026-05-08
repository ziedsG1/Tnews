import { NextResponse } from "next/server";
import { getCountry, type UiLang } from "@/lib/countries";
import { aggregateFromFeeds } from "@/lib/aggregateNews";
import { translateArticlesForUi } from "@/lib/translate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = getCountry(url.searchParams.get("country"));
  const lang = url.searchParams.get("lang");
  const uiLang: UiLang = lang === "ar" || lang === "fr" || lang === "en" ? lang : "ar";

  const result = await aggregateFromFeeds(country.feeds);
  const translated = await translateArticlesForUi(result.articles, uiLang);
  return NextResponse.json({ ...result, articles: translated });
}
