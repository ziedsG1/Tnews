import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ProfileDisplayNameForm } from "@/components/ProfileDisplayNameForm";
import { ProfileOpinionCards } from "@/components/ProfileOpinionCards";
import { opinionRowsToArticles } from "@/lib/profileOpinions";
import type { UiLang } from "@/lib/countries";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export default async function ProfilePage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-slate-100">
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
          Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
        <Link href="/" className="mt-6 inline-block text-violet-300 underline">
          ← Home
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent("/profile")}`);
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  if (pErr || !profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-slate-100">
        <p className="text-red-300">Could not load your profile. Try signing out and back in.</p>
        <Link href="/" className="mt-6 inline-block text-violet-300 underline">
          ← Home
        </Link>
      </main>
    );
  }

  const { data: opinionRows } = await supabase
    .from("public_opinions")
    .select("id, country_id, body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const origin = await siteOrigin();
  const uiLang: UiLang = "en";
  const articles = opinionRowsToArticles(opinionRows ?? [], profile, uiLang, origin);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">My profile</h1>
        <Link href="/" className="text-sm text-violet-300 underline">
          ← Home
        </Link>
      </div>
      <p className="theme-muted mt-2 text-sm text-slate-400">
        @{profile.username} — visible to signed-in members in Public opinion.
      </p>

      <ProfileDisplayNameForm initialDisplayName={profile.display_name} />

      <h2 className="mt-10 text-lg font-semibold text-white">My opinions</h2>
      <div className="mt-4">
        <ProfileOpinionCards articles={articles} />
      </div>
    </main>
  );
}
