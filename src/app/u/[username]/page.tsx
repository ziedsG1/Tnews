import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProfileOpinionCards } from "@/components/ProfileOpinionCards";
import { opinionRowsToArticles } from "@/lib/profileOpinions";
import type { UiLang } from "@/lib/countries";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username).trim();
  return {
    title: handle ? `@${handle} — Tnews` : "Profile — Tnews",
  };
}

export default async function UserPublicProfilePage({ params }: Props) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-slate-100">
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
          Supabase is not configured.
        </p>
        <Link href="/" className="mt-6 inline-block text-violet-300 underline">
          ← Home
        </Link>
      </main>
    );
  }

  const { username: raw } = await params;
  const handle = decodeURIComponent(raw).trim().toLowerCase();
  if (!handle) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent(`/u/${encodeURIComponent(handle)}`)}`);
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", handle)
    .maybeSingle();

  if (pErr || !profile) notFound();

  const { data: opinionRows } = await supabase
    .from("public_opinions")
    .select("id, user_id, country_id, body, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const origin = await siteOrigin();
  const uiLang: UiLang = "en";
  const articles = opinionRowsToArticles(opinionRows ?? [], profile, uiLang, origin);

  const label = (profile.display_name?.trim() || profile.username).trim();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{label}</h1>
          <p className="theme-muted text-sm text-slate-400">@{profile.username}</p>
        </div>
        <Link href="/" className="text-sm text-violet-300 underline">
          ← Home
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-white">Public opinions</h2>
      <p className="theme-muted mt-1 text-xs text-slate-500">Only signed-in members can open this feed.</p>
      <div className="mt-4">
        <ProfileOpinionCards
          articles={articles}
          showDelete={user.id === profile.id}
        />
      </div>
    </main>
  );
}
