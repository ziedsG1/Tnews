"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import type { CountryId } from "@/lib/countries";
import type { UiLang } from "@/lib/countries";
import { ArticleCard } from "@/components/ArticleCard";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { OpinionDbRow } from "@/lib/publicOpinions";
import { opinionToArticle, opinionUuidFromArticleId, storedOpinionFromDbRow } from "@/lib/publicOpinions";
import { authEmailToDisplayLogin, normalizeUsername, usernameToAuthEmail } from "@/lib/syntheticAuthEmail";

export type PublicOpinionsLabels = {
  opinionsTitle: string;
  opinionsComposerHint: string;
  opinionsPlaceholder: string;
  opinionsSubmit: string;
  opinionsPosting: string;
  opinionsEmpty: string;
  opinionPosted: string;
  opinionsAuthTitle: string;
  opinionsAuthHint: string;
  opinionsUsernamePlaceholder: string;
  opinionsPasswordPlaceholder: string;
  opinionsAuthButton: string;
  opinionsUsernameRules: string;
  opinionsWrongPassword: string;
  opinionsServiceRoleMissing: string;
  opinionsSignOut: string;
  opinionsMyProfile: string;
  opinionsConfigureSupabase: string;
  opinionsDelete: string;
};

function opinionMatchesQuery(a: NewsArticle, q: string): boolean {
  const raw = q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!raw) return true;
  const hay = `${a.translatedTitle ?? ""} ${a.summary ?? ""} ${a.sourceLabel} ${a.topic}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return raw.split(/\s+/).every((w) => w.length > 0 && hay.includes(w));
}

export function PublicOpinionsPanel({
  country,
  uiLang,
  searchQuery,
  labels,
  selectedId,
  onSelectArticle,
  onShareDoubleClick,
  onFeedArticlesChange,
  onBusyChange,
  onErrorChange,
  reloadKey,
  onClearSelection,
}: {
  country: CountryId;
  uiLang: UiLang;
  searchQuery: string;
  labels: PublicOpinionsLabels;
  selectedId: string | null;
  onSelectArticle: (a: NewsArticle) => void;
  onShareDoubleClick: (a: NewsArticle) => void;
  onFeedArticlesChange: (articles: NewsArticle[]) => void;
  onBusyChange: (busy: boolean) => void;
  onErrorChange: (msg: string | null) => void;
  reloadKey: number;
  onClearSelection?: () => void;
}) {
  const supabaseConfigured =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

  const supabase = useMemo(() => {
    if (!supabaseConfigured) return null;
    return createClient();
  }, [supabaseConfigured]);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [rows, setRows] = useState<OpinionDbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [opinionBody, setOpinionBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [doneNote, setDoneNote] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const siteOrigin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSessionUser(data.session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const loadList = useCallback(async () => {
    if (!supabaseConfigured) return;
    setLoading(true);
    onBusyChange(true);
    onErrorChange(null);
    try {
      const res = await fetch(`/api/opinions?country=${encodeURIComponent(country)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = (await res.json()) as { opinions?: OpinionDbRow[]; error?: string };
      if (res.status === 401) {
        setRows([]);
        onFeedArticlesChange([]);
        return;
      }
      if (!res.ok) {
        onErrorChange(json.error || `HTTP ${res.status}`);
        setRows([]);
        onFeedArticlesChange([]);
        return;
      }
      setRows(Array.isArray(json.opinions) ? json.opinions : []);
    } catch (e) {
      onErrorChange(e instanceof Error ? e.message : "Load failed");
      setRows([]);
      onFeedArticlesChange([]);
    } finally {
      setLoading(false);
      onBusyChange(false);
    }
  }, [country, onBusyChange, onErrorChange, onFeedArticlesChange, supabaseConfigured]);

  useEffect(() => {
    if (!sessionUser || !supabaseConfigured) {
      setRows([]);
      return;
    }
    void loadList();
  }, [sessionUser, country, reloadKey, loadList, supabaseConfigured]);

  const filteredRows = useMemo(() => {
    const list: { article: NewsArticle; row: OpinionDbRow }[] = [];
    for (const r of rows) {
      const s = storedOpinionFromDbRow(r);
      if (!s) continue;
      const a = opinionToArticle(s, uiLang, siteOrigin);
      if (!opinionMatchesQuery(a, searchQuery)) continue;
      list.push({ article: a, row: r });
    }
    return list;
  }, [rows, uiLang, siteOrigin, searchQuery]);

  const filtered = useMemo(() => filteredRows.map((x) => x.article), [filteredRows]);

  useEffect(() => {
    if (!sessionUser || !supabaseConfigured) {
      onFeedArticlesChange([]);
      return;
    }
    onFeedArticlesChange(filtered);
  }, [sessionUser, supabaseConfigured, filtered, onFeedArticlesChange]);

  const passwordAuth = useCallback(async () => {
    if (!supabase) return;
    let email: string;
    try {
      email = usernameToAuthEmail(usernameInput);
    } catch {
      onErrorChange(labels.opinionsUsernameRules);
      return;
    }
    if (passwordInput.length < 6) {
      onErrorChange(labels.opinionsUsernameRules);
      return;
    }
    setAuthBusy(true);
    onErrorChange(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: passwordInput,
      });
      if (!signInErr) {
        setPasswordInput("");
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const regJson = (await res.json()) as { error?: string; code?: string };
      if (res.status === 503 && regJson.code === "CONFIGURE") {
        onErrorChange(labels.opinionsServiceRoleMissing);
        return;
      }
      if (res.status === 409 || regJson.code === "EXISTS") {
        onErrorChange(labels.opinionsWrongPassword);
        return;
      }
      if (!res.ok) {
        onErrorChange(regJson.error || `HTTP ${res.status}`);
        return;
      }
      const { error: signInAgain } = await supabase.auth.signInWithPassword({
        email,
        password: passwordInput,
      });
      if (signInAgain) {
        onErrorChange(signInAgain.message);
        return;
      }
      setPasswordInput("");
    } catch (e) {
      onErrorChange(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setAuthBusy(false);
    }
  }, [supabase, usernameInput, passwordInput, labels, onErrorChange]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRows([]);
    onFeedArticlesChange([]);
    setUsernameInput("");
    setPasswordInput("");
  }, [supabase, onFeedArticlesChange]);

  const deleteOpinion = useCallback(
    async (article: NewsArticle) => {
      const uuid = opinionUuidFromArticleId(article.id);
      if (!uuid) return;
      setDeletingId(article.id);
      onErrorChange(null);
      try {
        const res = await fetch(`/api/opinions?id=${encodeURIComponent(uuid)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          onErrorChange(json.error || `HTTP ${res.status}`);
          return;
        }
        if (selectedId === article.id) onClearSelection?.();
        await loadList();
      } catch (e) {
        onErrorChange(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    [loadList, onClearSelection, onErrorChange, selectedId],
  );

  const submitOpinion = useCallback(async () => {
    if (posting || opinionBody.trim().length < 8) return;
    setPosting(true);
    onErrorChange(null);
    setDoneNote(null);
    try {
      const res = await fetch("/api/opinions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ country, body: opinionBody }),
      });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) {
        const parts = [json.error, json.detail].filter(Boolean);
        throw new Error(parts.length ? parts.join(" — ") : `HTTP ${res.status}`);
      }
      setOpinionBody("");
      setDoneNote(labels.opinionPosted);
      window.setTimeout(() => setDoneNote(null), 3200);
      await loadList();
    } catch (e) {
      onErrorChange(e instanceof Error ? e.message : "Post failed");
    } finally {
      setPosting(false);
    }
  }, [posting, opinionBody, country, loadList, labels.opinionPosted, onErrorChange]);

  if (!supabaseConfigured) {
    return (
      <div className="theme-panel rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-amber-100">
        <p className="text-sm font-medium">{labels.opinionsConfigureSupabase}</p>
      </div>
    );
  }

  if (!sessionUser) {
    const uLen = normalizeUsername(usernameInput).length;
    const canSubmit = uLen >= 3 && uLen <= 28 && passwordInput.length >= 6;
    return (
      <div className="theme-panel rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="theme-headline text-2xl font-bold text-white">{labels.opinionsAuthTitle}</h2>
        <p className="theme-muted mt-2 text-sm leading-relaxed">{labels.opinionsAuthHint}</p>
        <label className="mt-4 block">
          <span className="theme-muted text-xs">{labels.opinionsUsernamePlaceholder}</span>
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder={labels.opinionsUsernamePlaceholder}
            autoComplete="username"
            spellCheck={false}
            className="theme-input mt-1 w-full rounded-lg border border-white/25 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/50"
          />
        </label>
        <label className="mt-4 block">
          <span className="theme-muted text-xs">{labels.opinionsPasswordPlaceholder}</span>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={labels.opinionsPasswordPlaceholder}
            autoComplete="new-password"
            className="theme-input mt-1 w-full rounded-lg border border-white/25 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/50"
          />
        </label>
        <button
          type="button"
          disabled={authBusy || !canSubmit}
          onClick={() => void passwordAuth()}
          className="mt-4 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
        >
          {authBusy ? "…" : labels.opinionsAuthButton}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="theme-panel rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="theme-headline text-2xl font-bold text-white">{labels.opinionsTitle}</h2>
            <p className="theme-muted mt-1 text-xs text-slate-400">
              {authEmailToDisplayLogin(sessionUser.email) ?? sessionUser.email ?? ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/profile"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              {labels.opinionsMyProfile}
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/10"
            >
              {labels.opinionsSignOut}
            </button>
          </div>
        </div>
        <p className="theme-muted mt-3 text-sm leading-relaxed">{labels.opinionsComposerHint}</p>
        {doneNote ? <p className="mt-2 text-sm font-medium text-emerald-300">{doneNote}</p> : null}
        <textarea
          value={opinionBody}
          onChange={(e) => setOpinionBody(e.target.value)}
          rows={5}
          placeholder={labels.opinionsPlaceholder}
          maxLength={2000}
          className="theme-input mt-4 w-full rounded-lg border border-white/25 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/50"
          aria-label={labels.opinionsPlaceholder}
        />
        <button
          type="button"
          disabled={posting || opinionBody.trim().length < 8}
          onClick={() => void submitOpinion()}
          className="mt-4 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
        >
          {posting ? labels.opinionsPosting : labels.opinionsSubmit}
        </button>
      </div>
      <div
        dir={uiLang === "ar" ? "rtl" : "ltr"}
        lang={uiLang === "ar" ? "ar" : uiLang === "fr" ? "fr" : "en"}
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map(({ article: a, row }) => {
            const own = sessionUser.id === row.user_id;
            return (
              <li key={a.id} className="relative">
                {own ? (
                  <button
                    type="button"
                    title={labels.opinionsDelete}
                    aria-label={labels.opinionsDelete}
                    disabled={deletingId === a.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void deleteOpinion(a);
                    }}
                    className="absolute end-2 top-2 z-10 rounded-md border border-red-500/40 bg-red-950/80 px-2 py-0.5 text-xs font-semibold text-red-100 hover:bg-red-900/90 disabled:opacity-40"
                  >
                    {deletingId === a.id ? "…" : "×"}
                  </button>
                ) : null}
                <ArticleCard
                  article={a}
                  active={selectedId === a.id}
                  onSelect={() => onSelectArticle(a)}
                  onShareDoubleClick={() => onShareDoubleClick(a)}
                />
              </li>
            );
          })}
        </ul>
        {filteredRows.length === 0 && !loading && <p className="theme-muted mt-2 text-slate-500">{labels.opinionsEmpty}</p>}
        {loading ? <p className="theme-muted mt-2 text-sm">…</p> : null}
      </div>
    </>
  );
}
