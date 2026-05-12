import { NextResponse } from "next/server";
import { getCountry, type CountryId } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";
import type { OpinionDbRow } from "@/lib/publicOpinions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeText(s: string, max: number): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET(req: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured.", opinions: [] }, { status: 503 });
  }

  const url = new URL(req.url);
  const country = getCountry(url.searchParams.get("country"));

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required", opinions: [] }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("public_opinions")
      .select("id, country_id, body, created_at, profiles(username, display_name)")
      .eq("country_id", country.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("opinions GET", error);
      return NextResponse.json({ error: error.message, opinions: [] }, { status: 500 });
    }

    return NextResponse.json({ opinions: (data ?? []) as OpinionDbRow[] });
  } catch (e) {
    console.error("opinions GET", e);
    const detail = process.env.NODE_ENV === "development" ? (e instanceof Error ? e.message : String(e)) : undefined;
    return NextResponse.json({ error: "Could not load opinions.", detail, opinions: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

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
  const text = sanitizeText(rawBody, 2000);

  if (text.length < 8) {
    return NextResponse.json({ error: "Opinion is too short (min 8 characters)." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { error } = await supabase.from("public_opinions").insert({
      user_id: user.id,
      country_id: country.id,
      body: text,
    });

    if (error) {
      console.error("opinions POST", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("opinions POST", e);
    const detail = process.env.NODE_ENV === "development" ? (e instanceof Error ? e.message : String(e)) : undefined;
    return NextResponse.json({ error: "Could not save opinion.", detail }, { status: 500 });
  }
}
