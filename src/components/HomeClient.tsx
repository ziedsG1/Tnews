"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import { topicFilterGroup, type TopicFilterGroup } from "@/lib/topics";

const FILTER_GROUP_IDS: TopicFilterGroup[] = [1, 2, 3, 4];

const FILTER_LABELS: Record<TopicFilterGroup, { fr: string; ar: string }> = {
  1: { fr: "Sport", ar: "رياضة" },
  2: { fr: "Éco & politique", ar: "اقتصاد و سياسة" },
  3: { fr: "Culture & monde", ar: "ثقافة و عالم" },
  4: { fr: "Tunisie & divers", ar: "تونس و عام" },
};

/** Bidirectional search aliases (latin <-> arabic) used to expand query terms. */
const SEARCH_EQUIVALENTS: Record<string, string[]> = {
  tunis: ["تونس", "tunisie"],
  tunisie: ["تونس", "tunis"],
  gabes: ["قابس"],
  sfax: ["صفاقس"],
  sousse: ["سوسة"],
  monastir: ["المنستير"],
  nabeul: ["نابل"],
  bizerte: ["بنزرت"],
  kairouan: ["القيروان"],
  mahdia: ["المهدية"],
  djerba: ["جربة"],
  medenine: ["مدنين"],
  tataouine: ["تطاوين"],
  tunisian: ["تونسي", "تونس"],
  economy: ["اقتصاد", "اقتصادي"],
  politique: ["سياسة", "سياسي"],
  politics: ["سياسة", "سياسي"],
  sport: ["رياضة", "رياضي"],
  culture: ["ثقافة", "ثقافي"],
  monde: ["عالم", "دولي"],
  international: ["دولي", "عالمي"],
  تونس: ["tunis", "tunisie"],
  قابس: ["gabes"],
  صفاقس: ["sfax"],
  سوسة: ["sousse"],
  المنستير: ["monastir"],
  نابل: ["nabeul"],
  بنزرت: ["bizerte"],
  القيروان: ["kairouan"],
  المهدية: ["mahdia"],
  جربة: ["djerba"],
  مدنين: ["medenine"],
  تطاوين: ["tataouine"],
  اقتصاد: ["economy", "economie"],
  سياسة: ["politique", "politics"],
  رياضة: ["sport"],
  ثقافة: ["culture"],
  دولي: ["international", "monde"],
};

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[إأٱآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTerms(query: string): { phrase: string; tokenGroups: string[][] } {
  const normalized = normalizeForSearch(query);
  if (!normalized) return { phrase: "", tokenGroups: [] };
  const baseTokens = normalized.split(" ").filter(Boolean);
  const tokenGroups = baseTokens.map((token) => {
    const group = new Set<string>([token]);
    const aliases = SEARCH_EQUIVALENTS[token] ?? [];
    for (const alias of aliases) group.add(normalizeForSearch(alias));
    return [...group].filter(Boolean);
  });
  return {
    phrase: normalized,
    tokenGroups,
  };
}

function FilterToggle({
  groupId,
  on,
  onToggle,
}: {
  groupId: TopicFilterGroup;
  on: boolean;
  onToggle: () => void;
}) {
  const { fr, ar } = FILTER_LABELS[groupId];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${fr} / ${ar} — ${on ? "active" : "inactive"}`}
      onClick={onToggle}
      className={`flex h-[2.65rem] w-[5.15rem] shrink-0 flex-col items-center justify-center gap-px rounded-full border px-1 py-0.5 text-center text-[8px] transition active:scale-[0.98] ${
        on
          ? "border-emerald-400/80 bg-emerald-500/30 text-emerald-50 shadow-[0_0_8px_-2px_rgba(34,197,94,0.4)] hover:bg-emerald-500/40"
          : "border-rose-500/75 bg-rose-600/25 text-rose-50 shadow-[0_0_6px_-3px_rgba(244,63,94,0.3)] hover:bg-rose-600/35"
      }`}
    >
      <span className="font-semibold leading-none">{fr}</span>
      <span className="line-clamp-2 max-w-full text-[7px] font-medium leading-tight" dir="rtl" lang="ar">
        {ar}
      </span>
    </button>
  );
}

type ApiPayload = {
  articles: NewsArticle[];
  errors: { sourceId: string; message: string }[];
  fetchedAt: string;
};

function formatCardDate(iso: string | null, locale: "ar" | "fr"): string {
  if (!iso) return locale === "ar" ? "بدون تاريخ" : "Sans date";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return locale === "ar" ? "بدون تاريخ" : "Sans date";
  const d = new Date(t);
  const loc = locale === "ar" ? "ar" : "fr-TN";
  return new Intl.DateTimeFormat(loc, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function byArticleDateDesc(a: NewsArticle, b: NewsArticle): number {
  const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
  const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
  if (tb !== ta) return tb - ta;
  return a.id.localeCompare(b.id);
}

function ArticleCard({
  article,
  onSelect,
  active,
}: {
  article: NewsArticle;
  onSelect: () => void;
  active: boolean;
}) {
  const rtl = article.locale === "ar";
  return (
    <button
      type="button"
      onClick={onSelect}
      dir={rtl ? "rtl" : "ltr"}
      lang={rtl ? "ar" : "fr"}
      className={`w-full rounded-xl border p-4 text-start transition ${
        active
          ? "border-rose-400/60 bg-rose-500/10"
          : "border-white/10 bg-white/[0.02] hover:border-emerald-400/35 hover:bg-white/[0.05]"
      }`}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        {article.independentMedia && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
            Indé
          </span>
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide ${rtl ? "text-emerald-300/90" : "text-rose-400/90"}`}
        >
          {article.sourceLabel}
        </span>
      </span>
      <time
        dateTime={article.pubDate ?? undefined}
        className="mt-1 block text-[10px] text-slate-400"
      >
        {formatCardDate(article.pubDate, article.locale)}
      </time>
      <p className={`mt-1 line-clamp-3 text-sm leading-snug text-slate-100 ${rtl ? "font-medium" : ""}`}>
        {article.title}
      </p>
      <span className="mt-2 inline-block text-[10px] text-slate-500">{article.topic}</span>
    </button>
  );
}

const defaultFilterGroups = (): Record<TopicFilterGroup, boolean> => ({
  1: true,
  2: true,
  3: true,
  4: true,
});

export function HomeClient() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [filterGroups, setFilterGroups] = useState<Record<TopicFilterGroup, boolean>>(defaultFilterGroups);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`news-data.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiPayload;
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 6 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load]);

  const filteredArticles = useMemo(() => {
    const articles = data?.articles ?? [];
    const allowedIds = FILTER_GROUP_IDS.filter((id) => filterGroups[id]);
    const effective: TopicFilterGroup[] =
      allowedIds.length === 0 ? [...FILTER_GROUP_IDS] : allowedIds;
    return articles.filter((a) => effective.includes(topicFilterGroup(a.topicKey)));
  }, [data?.articles, filterGroups]);

  const searchedArticles = useMemo(() => {
    const { phrase, tokenGroups } = searchTerms(searchQuery);
    if (!phrase) return filteredArticles;

    return filteredArticles.filter((a) => {
      const haystack = normalizeForSearch(
        `${a.title} ${a.summary ?? ""} ${a.sourceLabel} ${a.topic}`,
      );
      if (haystack.includes(phrase)) return true;
      // AND between user words, OR inside each translation group.
      return tokenGroups.every((group) => group.some((token) => haystack.includes(token)));
    });
  }, [filteredArticles, searchQuery]);

  const { arabic, french } = useMemo(() => {
    const ar = searchedArticles.filter((a) => a.locale === "ar").sort(byArticleDateDesc);
    const fr = searchedArticles.filter((a) => a.locale === "fr").sort(byArticleDateDesc);
    return {
      arabic: ar.slice(0, 72),
      french: fr.slice(0, 48),
    };
  }, [searchedArticles]);

  const toggleFilterGroup = useCallback((id: TopicFilterGroup) => {
    setFilterGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selRtl = selected?.locale === "ar";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 pb-16 pt-3 md:px-8">
      <header
        className="sticky top-0 z-50 -mx-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[#05060a]/88 px-4 py-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl md:-mx-8 md:px-8"
        dir="ltr"
      >
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="shrink-0 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl">
            Tnews
          </h1>
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-400/85 sm:text-[11px]">
            · تونس
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {data?.fetchedAt && (
            <span className="hidden max-w-[9rem] truncate text-[9px] text-slate-500 lg:inline">
              {new Intl.DateTimeFormat("fr-TN", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(data.fetchedAt))}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Rafraîchir / تحديث"
            aria-label="Rafraîchir les actualités"
            className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-900/25 transition hover:brightness-110 disabled:opacity-50 sm:px-3.5 sm:text-xs"
          >
            {loading ? "…" : "↻"}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
        <input
          id="news-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Recherche / بحث"
          className="w-full rounded-lg border border-white/35 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-white/70"
        />
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {data?.errors && data.errors.length > 0 && (
        <details className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          <summary className="cursor-pointer font-medium">Certaines sources n&apos;ont pas répondu</summary>
          <ul className="mt-2 list-inside list-disc text-xs text-amber-200/80">
            {data.errors.map((e) => (
              <li key={e.sourceId}>
                <code className="text-amber-300">{e.sourceId}</code> — {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-12">
          <div dir="rtl" lang="ar">
            <h2 className="mb-4 text-2xl font-bold text-white">أخبار تونس بالعربية</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {arabic.map((a) => (
                <li key={a.id}>
                  <ArticleCard
                    article={a}
                    onSelect={() => setSelected((prev) => (prev?.id === a.id ? null : a))}
                    active={selected?.id === a.id}
                  />
                </li>
              ))}
            </ul>
            {arabic.length === 0 && !loading && (
              <p className="text-slate-500">لا توجد مقالات حالياً.</p>
            )}
          </div>

          <div dir="ltr" lang="fr">
            <h2 className="mb-1 text-xl font-semibold text-slate-200">Actualités en français</h2>
            <p className="mb-4 text-sm text-slate-500">Business News, fil Tunisie, Webdo…</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {french.map((a) => (
                <li key={a.id}>
                  <ArticleCard
                    article={a}
                    onSelect={() => setSelected((prev) => (prev?.id === a.id ? null : a))}
                    active={selected?.id === a.id}
                  />
                </li>
              ))}
            </ul>
            {french.length === 0 && !loading && (
              <p className="text-slate-500">Aucun article pour le moment.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-14 lg:self-start">
          <aside
            className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
            dir={selRtl ? "rtl" : "ltr"}
            lang={selRtl ? "ar" : "fr"}
          >
            <h2 className="text-lg font-semibold text-white">
              {selRtl ? "المقال المحدد" : "Article sélectionné"}
            </h2>
            {!selected && (
              <p className="mt-2 text-sm text-slate-500">
                {selRtl ? "اختر خبراً من القائمة." : "Choisissez un article dans les grilles."}
              </p>
            )}
            {!selected && (
              <p className="mt-2 text-sm text-slate-600" dir="rtl" lang="ar">
                أو بالعربية: اضغط على أي بطاقة.
              </p>
            )}
            {selected && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selected.independentMedia && (
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                      Média indépendant
                    </span>
                  )}
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      selRtl
                        ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                        : "border border-rose-400/40 bg-rose-500/15 text-rose-100"
                    }`}
                  >
                    {selected.topic}
                  </span>
                </div>
                <p className="text-base font-medium leading-snug text-white">{selected.title}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{selected.sourceLabel}</p>
                <time
                  dateTime={selected.pubDate ?? undefined}
                  className="text-[11px] text-slate-400"
                >
                  {formatCardDate(selected.pubDate, selected.locale)}
                </time>
                {selected.summary && (
                  <p className="text-sm leading-relaxed text-slate-400">{selected.summary}</p>
                )}
                <a
                  href={selected.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25"
                >
                  {selRtl ? "المصدر الأصلي ↗" : "Lire sur le site d'origine ↗"}
                </a>
              </div>
            )}

            <div className="mt-8 border-t border-white/10 pt-4" dir="ltr">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sources (aperçu)
              </h3>
              <ul className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                <li className="rounded-md bg-emerald-950/40 px-2 py-1 text-emerald-200/90">
                  AR: Mozaïque, Diwan, Al Jazeera, Nawaat, Rassd…
                </li>
                <li className="rounded-md bg-white/5 px-2 py-1">FR: Business News, Webdo</li>
              </ul>
            </div>
          </aside>

          <div
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center backdrop-blur-sm"
            dir="ltr"
          >
            <p className="mb-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
              Filtres / مرشحات
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {FILTER_GROUP_IDS.map((id) => (
                <FilterToggle
                  key={id}
                  groupId={id}
                  on={filterGroups[id]}
                  onToggle={() => toggleFilterGroup(id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFilterGroups(defaultFilterGroups())}
              className="mt-1 rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[8px] font-medium text-slate-400 transition hover:border-emerald-500/35 hover:text-emerald-200/90"
            >
              Tout activer
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
