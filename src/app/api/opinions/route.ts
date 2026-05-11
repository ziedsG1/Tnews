import { NextResponse } from "next/server";
import { getCountry, type CountryId } from "@/lib/countries";
import { appendOpinion, listOpinionsForCountry } from "@/lib/publicOpinionsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeText(s: string, max: number): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = getCountry(url.searchParams.get("country"));
  const list = await listOpinionsForCountry(country.id as CountryId);
  return NextResponse.json({ opinions: list });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const country = getCountry(typeof o.country === "string" ? o.country : null);
  const rawBody = typeof o.body === "string" ? o.body : "";
  const rawAuthor = typeof o.author === "string" ? o.author : "";

  const text = sanitizeText(rawBody, 2000);
  const author = sanitizeText(rawAuthor, 48);

  if (text.length < 8) {
    return NextResponse.json({ error: "Opinion is too short (min 8 characters)." }, { status: 400 });
  }

  try {
    const row = await appendOpinion(country.id as CountryId, text, author);
    return NextResponse.json({ ok: true, opinion: row });
  } catch (e) {
    console.error("opinions POST", e);
    return NextResponse.json({ error: "Could not save opinion." }, { status: 500 });
  }
}
