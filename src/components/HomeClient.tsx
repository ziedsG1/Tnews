"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import { topicFilterGroup, type TopicFilterGroup } from "@/lib/topics";
import { COUNTRIES, type CountryId, type UiLang } from "@/lib/countries";
import { BrandLogo } from "@/components/BrandLogo";

const FILTER_GROUP_IDS: TopicFilterGroup[] = [1, 2, 3, 4];
type ThemeMode = "dark" | "light" | "newspaper";

const FILTER_LABELS: Record<TopicFilterGroup, { fr: string; ar: string }> = {
  1: { fr: "Sport", ar: "رياضة" },
  2: { fr: "Éco & politique", ar: "اقتصاد و سياسة" },
  3: { fr: "Culture & monde", ar: "ثقافة و عالم" },
  4: { fr: "Tunisie & divers", ar: "تونس و عام" },
};

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  newspaper: "1980 Paper",
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
          ? "theme-card theme-card-active border-rose-400/60 bg-rose-500/10"
          : "theme-card border-white/10 bg-white/[0.02] hover:border-emerald-400/35 hover:bg-white/[0.05]"
      }`}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        {article.independentMedia && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
            Indé
          </span>
        )}
        {article.sourceKind === "radio" && (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-200">
            Radio
          </span>
        )}
        {article.sourceKind === "state" && (
          <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-200">
            State
          </span>
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide ${rtl ? "text-emerald-300/90" : "text-rose-400/90"}`}
        >
          {article.sourceLabel}
        </span>
      </span>
      <time dateTime={article.pubDate ?? undefined} className="theme-muted mt-1 block text-[10px] text-slate-400">
        {formatCardDate(article.pubDate, article.locale)}
      </time>
      <p className={`theme-headline mt-1 line-clamp-3 text-sm leading-snug text-slate-100 ${rtl ? "font-medium" : ""}`}>
        {article.translatedTitle ?? article.title}
      </p>
      <span className="theme-muted mt-2 inline-block text-[10px] text-slate-500">{article.topic}</span>
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
  const [country, setCountry] = useState<CountryId>("TN");
  const [uiLang, setUiLang] = useState<UiLang>("ar");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const activeCountry = useMemo(() => COUNTRIES.find((c) => c.id === country) ?? COUNTRIES[0]!, [country]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/news?country=${encodeURIComponent(country)}&lang=${encodeURIComponent(uiLang)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiPayload;
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [country, uiLang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 6 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("tnews.country");
      if (stored) setCountry(stored as CountryId);
      const storedLang = window.localStorage.getItem("tnews.uiLang");
      if (storedLang === "ar" || storedLang === "fr" || storedLang === "en") setUiLang(storedLang);
      const storedTheme = window.localStorage.getItem("tnews.theme");
      if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "newspaper") {
        setTheme(storedTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("tnews.country", country);
      window.localStorage.setItem("tnews.uiLang", uiLang);
      window.localStorage.setItem("tnews.theme", theme);
    } catch {
      // ignore
    }
  }, [country, uiLang, theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const t = useMemo(() => {
    const byLang = {
      ar: {
        searchPlaceholder: "بحث / Search",
        noAr: "لا توجد مقالات حالياً.",
        noFr: "لا توجد مقالات حالياً.",
        selectedTitle: "المقال المحدد",
        selectHint: "اختر خبراً من القائمة.",
        sourceLink: "المصدر الأصلي ↗",
        newsTitle: `أخبار ${activeCountry.names.ar}`,
        intlTitle: "أخبار دولية",
      },
      fr: {
        searchPlaceholder: "Recherche / Search",
        noAr: "Aucun article pour le moment.",
        noFr: "Aucun article pour le moment.",
        selectedTitle: "Article sélectionné",
        selectHint: "Choisissez un article dans les grilles.",
        sourceLink: "Lire sur le site d'origine ↗",
        newsTitle: `Actualités ${activeCountry.names.fr}`,
        intlTitle: "Actualités internationales",
      },
      en: {
        searchPlaceholder: "Search / بحث",
        noAr: "No articles right now.",
        noFr: "No articles right now.",
        selectedTitle: "Selected article",
        selectHint: "Choose an article from the grid.",
        sourceLink: "Read on original source ↗",
        newsTitle: `${activeCountry.names.en} news`,
        intlTitle: "International news",
      },
    } as const;
    return byLang[uiLang];
  }, [uiLang, activeCountry]);

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
        `${a.translatedTitle ?? a.title} ${a.title} ${a.summary ?? ""} ${a.sourceLabel} ${a.topic}`,
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

  const brandSelectClass = useMemo(() => {
    const base =
      "appearance-none rounded-full border px-4 py-1.5 pr-9 text-xl font-bold tracking-tight outline-none sm:text-2xl";
    if (theme === "light") {
      return `${base} border-slate-200/90 bg-white/95 text-slate-900 shadow-sm hover:border-slate-300`;
    }
    if (theme === "newspaper") {
      return `${base} brand-select-newspaper rounded-sm border-2 border-[#3d2f1f] bg-[#fffdf5] px-4 py-1.5 pr-9 font-serif text-[1.15rem] font-extrabold tracking-tight text-[#1a120c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_2px_0_rgba(61,47,31,0.35)] sm:text-2xl`;
    }
    return `${base} border-white/15 bg-white/[0.06] text-slate-100 hover:border-white/25`;
  }, [theme]);

  const brandSelectStyle = useMemo((): CSSProperties | undefined => {
    if (theme !== "dark") return undefined;
    return {
      WebkitTextFillColor: "transparent",
      backgroundImage:
        "linear-gradient(90deg, rgba(255,255,255,1), rgba(241,245,249,1), rgba(148,163,184,1))",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
    };
  }, [theme]);

  const chevronClass =
    theme === "newspaper"
      ? "text-[#6b5344]"
      : theme === "light"
        ? "text-slate-500"
        : "text-slate-400";

  return (
    <main
      className={`relative mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 pb-16 pt-3 md:px-8 ${theme === "newspaper" ? "newspaper-main" : ""}`}
    >
      <header
        className="theme-header sticky top-0 z-50 -mx-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[#05060a]/88 px-4 py-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl md:-mx-8 md:px-8"
        dir="ltr"
      >
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo theme={theme} className="hidden sm:block" />
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryId)}
              aria-label="Country"
              className={brandSelectClass}
              style={brandSelectStyle}
            >
              {COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand}
                </option>
              ))}
            </select>
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${chevronClass}`}>
              ▾
            </span>
          </div>
          <span className="theme-muted truncate text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-400/85 sm:text-[11px]">
            · {activeCountry.names[uiLang]}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-full px-1 py-1">
            {(Object.keys(THEME_LABELS) as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-active={theme === mode}
                onClick={() => setTheme(mode)}
                className="theme-mode-toggle rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:brightness-95"
                aria-label={`Switch theme to ${THEME_LABELS[mode]}`}
                title={THEME_LABELS[mode]}
              >
                {THEME_LABELS[mode]}
              </button>
            ))}
          </div>
          <select
            value={uiLang}
            onChange={(e) => setUiLang(e.target.value as UiLang)}
            aria-label="Interface language"
            className="hidden rounded-full border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] text-slate-200 outline-none hover:border-white/25 sm:block"
          >
            <option value="ar">AR</option>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
          {data?.fetchedAt && (
            <span className="theme-muted hidden max-w-[9rem] truncate text-[9px] text-slate-500 lg:inline">
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

      <div className="theme-panel mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
        <input
          id="news-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="theme-input w-full rounded-lg border border-white/35 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-white/70"
        />
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-12">
          <div dir="rtl" lang="ar">
            <h2 className="theme-headline mb-4 text-2xl font-bold text-white">{t.newsTitle}</h2>
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
              <p className="theme-muted text-slate-500">{t.noAr}</p>
            )}
          </div>

          <div dir="ltr" lang="fr">
            <h2 className="theme-headline mb-1 text-xl font-semibold text-slate-200">{t.intlTitle}</h2>
            <p className="theme-muted mb-4 text-sm text-slate-500">Business News, fil Tunisie, Webdo…</p>
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
              <p className="theme-muted text-slate-500">{t.noFr}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-14 lg:self-start">
          <aside
            className="theme-panel h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
            dir={selRtl ? "rtl" : "ltr"}
            lang={selRtl ? "ar" : "fr"}
          >
            <h2 className="theme-headline text-lg font-semibold text-white">
              {t.selectedTitle}
            </h2>
            {!selected && (
              <p className="theme-muted mt-2 text-sm text-slate-500">
                {t.selectHint}
              </p>
            )}
            {!selected && (
              <p className="theme-muted mt-2 text-sm text-slate-600" dir="rtl" lang="ar">
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
                <p className="theme-headline text-base font-medium leading-snug text-white">
                  {selected.translatedTitle ?? selected.title}
                </p>
                <p className="theme-muted text-xs uppercase tracking-wide text-slate-500">{selected.sourceLabel}</p>
                <time
                  dateTime={selected.pubDate ?? undefined}
                  className="theme-muted text-[11px] text-slate-400"
                >
                  {formatCardDate(selected.pubDate, selected.locale)}
                </time>
                {selected.summary && (
                  <p className="theme-muted text-sm leading-relaxed text-slate-400">{selected.summary}</p>
                )}
                <a
                  href={selected.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25"
                >
                  {t.sourceLink}
                </a>
              </div>
            )}

            <div className="mt-8 border-t border-white/10 pt-4" dir="ltr">
              <h3 className="theme-muted mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sources (aperçu)
              </h3>
              <ul className="theme-muted flex flex-wrap gap-2 text-[11px] text-slate-400">
                <li className="rounded-md bg-emerald-950/40 px-2 py-1 text-emerald-200/90">
                  AR: Mozaïque, Diwan, Al Jazeera, Nawaat, Rassd…
                </li>
                <li className="rounded-md bg-white/5 px-2 py-1">FR: Business News, Webdo</li>
              </ul>
            </div>
          </aside>

          <div
            className="theme-panel w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center backdrop-blur-sm"
            dir="ltr"
          >
            <p className="theme-muted mb-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
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
