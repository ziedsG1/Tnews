"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import { topicFilterGroup, type TopicFilterGroup } from "@/lib/topics";
import { COUNTRIES, type CountryId, type UiLang } from "@/lib/countries";
import { BrandLogo } from "@/components/BrandLogo";
import { ShareArticleDialog } from "@/components/ShareArticleDialog";
import { parseStoredTheme, THEME_ORDER, type ThemeMode } from "@/lib/uiTheme";

const FILTER_GROUP_IDS: TopicFilterGroup[] = [1, 2, 3, 4];

const FILTER_LABELS: Record<TopicFilterGroup, { fr: string; ar: string }> = {
  1: { fr: "Sport", ar: "رياضة" },
  2: { fr: "Éco & politique", ar: "اقتصاد و سياسة" },
  3: { fr: "Culture & monde", ar: "ثقافة و عالم" },
  4: { fr: "Tunisie & divers", ar: "تونس و عام" },
};

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  newspaper: "1980",
  broadsheet: "Heritage",
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
  onShareDoubleClick,
}: {
  article: NewsArticle;
  onSelect: (e: MouseEvent<HTMLButtonElement>) => void;
  active: boolean;
  onShareDoubleClick?: () => void;
}) {
  const rtl = article.locale === "ar";
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={(e) => {
        if (onShareDoubleClick) {
          e.preventDefault();
          onShareDoubleClick();
        }
      }}
      dir={rtl ? "rtl" : "ltr"}
      lang={rtl ? "ar" : "fr"}
      className={`relative w-full rounded-xl border p-4 pt-7 text-start transition sm:pt-4 ${
        active
          ? "theme-card theme-card-active border-rose-400/60 bg-rose-500/10 ring-2 ring-emerald-400/40"
          : "theme-card border-white/10 bg-white/[0.02] hover:border-emerald-400/35 hover:bg-white/[0.05]"
      }`}
    >
      <span
        className={`absolute left-3 top-2 flex h-4 w-4 items-center justify-center rounded border text-[9px] font-bold sm:left-auto sm:right-3 ${rtl ? "left-auto right-3" : ""} ${
          active ? "border-emerald-400 bg-emerald-500/30 text-emerald-100" : "border-white/25 bg-black/20 text-transparent"
        }`}
        aria-hidden
      >
        ✓
      </span>
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
  /** Selection order: last id is the “primary” article in the sidebar. Ctrl/Cmd+click toggles multi-select. */
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [filterGroups, setFilterGroups] = useState<Record<TopicFilterGroup, boolean>>(defaultFilterGroups);
  const [searchQuery, setSearchQuery] = useState("");
  const [country, setCountry] = useState<CountryId>("TN");
  const [uiLang, setUiLang] = useState<UiLang>("ar");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [shareTarget, setShareTarget] = useState<{
    articles: NewsArticle[];
    theme: ThemeMode;
    autoExecute?: "photo";
  } | null>(null);
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
      const storedTheme = parseStoredTheme(window.localStorage.getItem("tnews.theme"));
      if (storedTheme) setTheme(storedTheme);
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
        shareHint: "انقر للتحديد — Ctrl أو ⌘ مع النقر لإضافة أكثر من خبر. نقرتان مزدوجتان: تنزيل صورة المعاينة.",
        noAr: "لا توجد مقالات حالياً.",
        noFr: "لا توجد مقالات حالياً.",
        selectedTitle: "المحدد",
        selectHint: "انقر بطاقة للتحديد. Ctrl/⌘+نقر لتحديد عدة أخبار.",
        selectionPhoto: "صورة للمحدد",
        clearSelection: "مسح التحديد",
        sourceLink: "المصدر الأصلي ↗",
        newsTitle: `أخبار ${activeCountry.names.ar}`,
        intlTitle: "أخبار دولية",
      },
      fr: {
        searchPlaceholder: "Recherche / Search",
        shareHint: "Clic pour sélectionner — Ctrl ou ⌘+clic pour multi-sélection. Double-clic : télécharger l’image d’aperçu.",
        noAr: "Aucun article pour le moment.",
        noFr: "Aucun article pour le moment.",
        selectedTitle: "Sélection",
        selectHint: "Cliquez une carte. Ctrl/⌘+clic pour en choisir plusieurs.",
        selectionPhoto: "Image de la sélection",
        clearSelection: "Effacer la sélection",
        sourceLink: "Lire sur le site d'origine ↗",
        newsTitle: `Actualités ${activeCountry.names.fr}`,
        intlTitle: "Actualités internationales",
      },
      en: {
        searchPlaceholder: "Search / بحث",
        shareHint: "Click to select — Ctrl or ⌘+click for multi-select. Double-click: download preview image.",
        noAr: "No articles right now.",
        noFr: "No articles right now.",
        selectedTitle: "Selection",
        selectHint: "Click a card. Ctrl/⌘+click to pick several articles.",
        selectionPhoto: "Selection image",
        clearSelection: "Clear selection",
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

  /**
   * Resolve picks against topic-filtered articles only — not the search box.
   * Otherwise a search that hides selected cards yields an empty list and
   * “PDF للمحدد” / bundle share does nothing while selection ids still look active.
   */
  const selectedArticlesList = useMemo(() => {
    const map = new Map(filteredArticles.map((a) => [a.id, a]));
    return selectedOrder.map((id) => map.get(id)).filter(Boolean) as NewsArticle[];
  }, [selectedOrder, filteredArticles]);

  const primaryArticle = useMemo(() => {
    if (selectedArticlesList.length === 0) return null;
    return selectedArticlesList[selectedArticlesList.length - 1] ?? null;
  }, [selectedArticlesList]);

  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  const selectArticle = useCallback((e: MouseEvent<HTMLButtonElement>, article: NewsArticle) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedOrder((prev) => {
        if (prev.includes(article.id)) return prev.filter((id) => id !== article.id);
        return [...prev, article.id];
      });
    } else {
      setSelectedOrder([article.id]);
    }
  }, []);

  const openShareBundle = useCallback(() => {
    const list = selectedArticlesList.slice(0, 15);
    if (list.length === 0) return;
    /** Always show the dialog so Story / PDF buttons work; single-article double-click may still auto-export. */
    setShareTarget({ articles: list, theme, autoExecute: undefined });
  }, [selectedArticlesList, theme]);

  const toggleFilterGroup = useCallback((id: TopicFilterGroup) => {
    setFilterGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selRtl = primaryArticle?.locale === "ar";

  const brandSelectClass = useMemo(() => {
    const base =
      "appearance-none rounded-full border px-4 py-1.5 pr-9 text-xl font-bold tracking-tight outline-none sm:text-2xl";
    if (theme === "light") {
      return `${base} border-slate-200/90 bg-white/95 text-slate-900 shadow-sm hover:border-slate-300`;
    }
    if (theme === "newspaper") {
      return `${base} brand-select-newspaper rounded-sm border-2 border-[#3d2f1f] bg-[#fffdf5] px-4 py-1.5 pr-9 font-serif text-[1.15rem] font-extrabold tracking-tight text-[#1a120c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_2px_0_rgba(61,47,31,0.35)] sm:text-2xl`;
    }
    if (theme === "broadsheet") {
      return `${base} brand-select-broadsheet rounded-sm border-[3px] border-double border-[#1a120c] bg-[#fdf5e6] px-4 py-1.5 pr-9 text-[1.25rem] tracking-tight shadow-[inset_0_2px_0_rgba(255,255,255,0.5)] sm:text-[1.65rem]`;
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
      : theme === "broadsheet"
        ? "text-[#4a3628]"
        : theme === "light"
          ? "text-slate-500"
          : "text-slate-400";

  const openShare = useCallback((article: NewsArticle) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const phoneLike =
      w <= 768 && /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(ua);
    const autoExecute: "photo" | undefined = phoneLike ? "photo" : undefined;
    setShareTarget({ articles: [article], theme, autoExecute });
  }, [theme]);

  return (
    <main
      className={`relative mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 pb-16 pt-3 md:px-8 ${theme === "newspaper" ? "newspaper-main" : ""} ${theme === "broadsheet" ? "broadsheet-main" : ""}`}
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
          <div className="flex max-w-[11rem] flex-wrap items-center justify-end gap-1 rounded-full px-1 py-1 sm:max-w-none">
            {THEME_ORDER.map((mode) => (
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
        <p className="theme-muted mt-2 text-center text-[10px] leading-snug sm:text-[11px]">{t.shareHint}</p>
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
                    onSelect={(e) => selectArticle(e, a)}
                    active={selectedSet.has(a.id)}
                    onShareDoubleClick={() => openShare(a)}
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
                    onSelect={(e) => selectArticle(e, a)}
                    active={selectedSet.has(a.id)}
                    onShareDoubleClick={() => openShare(a)}
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
              {selectedOrder.length > 0 ? (
                <span className="theme-muted ms-2 text-sm font-normal">({selectedOrder.length})</span>
              ) : null}
            </h2>
            {selectedOrder.length === 0 && (
              <p className="theme-muted mt-2 text-sm text-slate-500">
                {t.selectHint}
              </p>
            )}
            {selectedOrder.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => openShareBundle()}
                  className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md transition hover:brightness-110"
                >
                  {t.selectionPhoto}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder([])}
                  className="theme-mode-toggle rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                >
                  {t.clearSelection}
                </button>
              </div>
            )}
            {selectedOrder.length > 1 && (
              <ul className="theme-muted mt-3 max-h-32 space-y-1 overflow-y-auto text-[11px] leading-snug" dir="auto">
                {selectedArticlesList.map((a) => (
                  <li
                    key={a.id}
                    className="truncate border-b border-white/5 pb-1 [unicode-bidi:isolate]"
                    dir="auto"
                    lang={a.locale === "ar" ? "ar" : "fr"}
                  >
                    {a.translatedTitle ?? a.title}
                  </li>
                ))}
              </ul>
            )}
            {primaryArticle && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {primaryArticle.independentMedia && (
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
                    {primaryArticle.topic}
                  </span>
                </div>
                <p className="theme-headline text-base font-medium leading-snug text-white">
                  {primaryArticle.translatedTitle ?? primaryArticle.title}
                </p>
                <p className="theme-muted text-xs uppercase tracking-wide text-slate-500">{primaryArticle.sourceLabel}</p>
                <time
                  dateTime={primaryArticle.pubDate ?? undefined}
                  className="theme-muted text-[11px] text-slate-400"
                >
                  {formatCardDate(primaryArticle.pubDate, primaryArticle.locale)}
                </time>
                {primaryArticle.summary && (
                  <p className="theme-muted text-sm leading-relaxed text-slate-400">{primaryArticle.summary}</p>
                )}
                <a
                  href={primaryArticle.link}
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

      {shareTarget ? (
        <ShareArticleDialog
          articles={shareTarget.articles}
          siteLabel={activeCountry.brand}
          captureTheme={shareTarget.theme}
          uiLang={uiLang}
          autoExecute={shareTarget.autoExecute}
          onClose={() => setShareTarget(null)}
        />
      ) : null}
    </main>
  );
}
