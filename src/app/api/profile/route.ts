import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function sanitizeDisplayName(raw: string): string | null {
  const s = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, 80);
  return s.length === 0 ? null : s;
}

export async function PATCH(req: Request) {
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
  const displayNameRaw = (body as Record<string, unknown>).displayName;
  if (displayNameRaw !== null && typeof displayNameRaw !== "string") {
    return NextResponse.json({ error: "displayName must be a string or null" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const display_name = displayNameRaw === null ? null : sanitizeDisplayName(displayNameRaw);
    if (displayNameRaw !== null && typeof displayNameRaw === "string" && displayNameRaw.trim().length > 0 && display_name === null) {
      return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
    }

    const { error } = await supabase.from("profiles").update({ display_name }).eq("id", user.id);
    if (error) {
      console.error("profile PATCH", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, display_name });
  } catch (e) {
    console.error("profile PATCH", e);
    const detail = process.env.NODE_ENV === "development" ? (e instanceof Error ? e.message : String(e)) : undefined;
    return NextResponse.json({ error: "Could not update profile.", detail }, { status: 500 });
  }
}
