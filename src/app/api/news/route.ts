import { NextResponse } from "next/server";
import { getCountry, type UiLang } from "@/lib/countries";
import { getCachedNewsPayload } from "@/lib/cachedNews";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = getCountry(url.searchParams.get("country"));
  const lang = url.searchParams.get("lang");
  const uiLang: UiLang = lang === "ar" || lang === "fr" || lang === "en" ? lang : "ar";

  const payload = await getCachedNewsPayload(country.id, uiLang);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
