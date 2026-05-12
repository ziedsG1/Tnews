"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import { topicFilterGroup, type TopicFilterGroup } from "@/lib/topics";
import { COUNTRIES, type CountryId, type UiLang } from "@/lib/countries";
import { ArticleCard } from "@/components/ArticleCard";
import { BrandLogo } from "@/components/BrandLogo";
import { PublicOpinionsPanel, type PublicOpinionsLabels } from "@/components/PublicOpinionsPanel";
import { ShareArticleDialog } from "@/components/ShareArticleDialog";
import { ShareWeatherDialog } from "@/components/ShareWeatherDialog";
import { parseStoredTheme, THEME_ORDER, type ThemeMode } from "@/lib/uiTheme";
import { weatherCodeEmoji, weatherCodeLabel } from "@/lib/weather";
import { createClient } from "@/lib/supabase/client";

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

type WeatherPayload = {
  city: string;
  countryId: string;
  timezone: string;
  current: {
    temperature: number | null;
    windSpeed: number | null;
    weatherCode: number | null;
    time: string | null;
  };
  daily: Array<{
    date: string;
    max: number | null;
    min: number | null;
    weatherCode: number | null;
  }>;
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
  /** At most one selected article (sidebar + share). */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterGroups, setFilterGroups] = useState<Record<TopicFilterGroup, boolean>>(defaultFilterGroups);
  const [searchQuery, setSearchQuery] = useState("");
  const [country, setCountry] = useState<CountryId>("TN");
  const [uiLang, setUiLang] = useState<UiLang>("ar");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [viewMode, setViewMode] = useState<"news" | "weather" | "opinions">("news");
  const [weatherData, setWeatherData] = useState<WeatherPayload | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherErr, setWeatherErr] = useState<string | null>(null);
  const [weatherShareOpen, setWeatherShareOpen] = useState(false);
  const [opinionsLoading, setOpinionsLoading] = useState(false);
  const [opinionsErr, setOpinionsErr] = useState<string | null>(null);
  const [opinionFeedArticles, setOpinionFeedArticles] = useState<NewsArticle[]>([]);
  const [opinionsReloadKey, setOpinionsReloadKey] = useState(0);
  const [shareTarget, setShareTarget] = useState<{
    articles: NewsArticle[];
    theme: ThemeMode;
  } | null>(null);
  const activeCountry = useMemo(() => COUNTRIES.find((c) => c.id === country) ?? COUNTRIES[0]!, [country]);

  const weatherPageUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/weather?country=${encodeURIComponent(country)}&lang=${encodeURIComponent(uiLang)}`;
  }, [country, uiLang]);

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

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherErr(null);
    try {
      const res = await fetch(
        `/api/weather?country=${encodeURIComponent(country)}&lang=${encodeURIComponent(uiLang)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as WeatherPayload;
      setWeatherData(json);
    } catch (e) {
      setWeatherErr(e instanceof Error ? e.message : "Weather fetch failed");
    } finally {
      setWeatherLoading(false);
    }
  }, [country, uiLang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (viewMode !== "weather") return;
    void loadWeather();
  }, [viewMode, loadWeather]);

  useEffect(() => {
    if (viewMode !== "opinions") {
      setOpinionFeedArticles([]);
      setOpinionsErr(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "weather") setWeatherShareOpen(false);
  }, [viewMode]);

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

  /** After magic link, send user to `?next=/path` if they are already signed in. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const u = new URL(window.location.href);
    const next = u.searchParams.get("next");
    if (!next || !next.startsWith("/") || next.startsWith("//")) return;
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      u.searchParams.delete("next");
      const qs = u.searchParams.toString();
      const clean = u.pathname + (qs ? `?${qs}` : "") || "/";
      window.history.replaceState({}, "", clean);
      window.location.assign(next);
    });
  }, []);

  const t = useMemo(() => {
    const byLang = {
      ar: {
        searchPlaceholder: "بحث / Search",
        shareHint: "انقر بطاقة لتحديد خبر واحد. نقرتان مزدوجتان: مشاركة (فيسبوك بالرابط، إنستغرام بصورة قصة ٩:١٦ مع صورة المصدر).",
        weatherButton: "الطقس",
        newsButton: "الأخبار",
        weatherTitle: `طقس ${activeCountry.names.ar}`,
        weatherShare: "مشاركة الطقس",
        opinionsButton: "رأي العام",
        opinionsTitle: `رأي العام — ${activeCountry.names.ar}`,
        opinionsSearchHint: "ابحث في الآراء المنشورة.",
        opinionsComposerHint:
          "سجّل الدخول بالبريد. تظهر آراء المسجّلين فقط في هذا القسم حسب الدولة. المحتوى مسؤولية صاحبه.",
        opinionsPlaceholder: "اكتب رأيك هنا…",
        opinionsSubmit: "نشر الرأي",
        opinionsPosting: "جاري النشر…",
        opinionsEmpty: "لا توجد آراء بعد لهذا البلد. كن أول من يكتب.",
        opinionPosted: "تم نشر الرأي.",
        opinionsSidebarNote: "هذا منشور من القارئ في قسم «رأي العام» وليس من أسلاك الأخبار.",
        opinionsAuthTitle: "تسجيل الدخول — رأي العام",
        opinionsAuthHint:
          "أدخل بريدك الإلكتروني لإرسال رابط تسجيل دخول لمرة واحدة. بعد الدخول يمكنك قراءة آراء المسجّلين ونشر رأيك.",
        opinionsEmailPlaceholder: "البريد الإلكتروني",
        opinionsSendMagicLink: "إرسال الرابط",
        opinionsCheckEmail: "تحقق من بريدك واضغط الرابط للدخول.",
        opinionsSignOut: "خروج",
        opinionsMyProfile: "ملفي",
        opinionsConfigureSupabase:
          "لم يُضبط Supabase: أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في البيئة، وطبّق SQL من مجلد supabase/migrations في لوحة Supabase.",
        weatherWind: "الرياح",
        weatherToday: "اليوم",
        weatherUnavailable: "بيانات الطقس غير متوفرة حاليا.",
        noAr: "لا توجد مقالات حالياً.",
        noFr: "لا توجد مقالات حالياً.",
        selectedTitle: "المحدد",
        selectHint: "انقر بطاقة لاختيار خبر واحد في الشريط الجانبي.",
        selectionPhoto: "مشاركة",
        clearSelection: "مسح التحديد",
        sourceLink: "المصدر الأصلي ↗",
        newsTitle: `أخبار ${activeCountry.names.ar}`,
        intlTitle: "أخبار دولية",
      },
      fr: {
        searchPlaceholder: "Recherche / Search",
        shareHint: "Cliquez une carte pour sélectionner un article. Double-clic : partager (Facebook lien, Instagram story 9:16 avec photo du flux).",
        weatherButton: "Météo",
        newsButton: "News",
        weatherTitle: `Météo ${activeCountry.names.fr}`,
        weatherShare: "Partager météo",
        opinionsButton: "Opinion",
        opinionsTitle: `Opinion publique — ${activeCountry.names.fr}`,
        opinionsSearchHint: "Rechercher parmi les avis publiés.",
        opinionsComposerHint:
          "Connectez-vous par e-mail. Seuls les avis des personnes inscrites apparaissent ici, par pays. Le contenu engage son auteur.",
        opinionsPlaceholder: "Votre avis…",
        opinionsSubmit: "Publier",
        opinionsPosting: "Publication…",
        opinionsEmpty: "Aucun avis pour ce pays pour le moment. Soyez le premier.",
        opinionPosted: "Avis publié.",
        opinionsSidebarNote: "Texte publié par un lecteur dans « Opinion publique », pas un fil de presse.",
        opinionsAuthTitle: "Connexion — Opinion publique",
        opinionsAuthHint:
          "Entrez votre e-mail pour recevoir un lien de connexion (magic link). Ensuite vous lisez les avis inscrits et vous publiez le vôtre.",
        opinionsEmailPlaceholder: "E-mail",
        opinionsSendMagicLink: "Envoyer le lien",
        opinionsCheckEmail: "Vérifiez votre boîte mail et cliquez sur le lien.",
        opinionsSignOut: "Déconnexion",
        opinionsMyProfile: "Mon profil",
        opinionsConfigureSupabase:
          "Supabase non configuré : ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, puis exécutez le SQL du dossier supabase/migrations dans le dashboard Supabase.",
        weatherWind: "Vent",
        weatherToday: "Aujourd'hui",
        weatherUnavailable: "Météo indisponible pour le moment.",
        noAr: "Aucun article pour le moment.",
        noFr: "Aucun article pour le moment.",
        selectedTitle: "Sélection",
        selectHint: "Cliquez une carte pour afficher un article dans la colonne de droite.",
        selectionPhoto: "Partager",
        clearSelection: "Effacer la sélection",
        sourceLink: "Lire sur le site d'origine ↗",
        newsTitle: `Actualités ${activeCountry.names.fr}`,
        intlTitle: "Actualités internationales",
      },
      en: {
        searchPlaceholder: "Search / بحث",
        shareHint: "Click a card to select one article. Double-click: share (Facebook link, Instagram 9:16 story with feed photo).",
        weatherButton: "Weather",
        newsButton: "News",
        weatherTitle: `${activeCountry.names.en} weather`,
        weatherShare: "Share weather",
        opinionsButton: "Opinion",
        opinionsTitle: `Public opinion — ${activeCountry.names.en}`,
        opinionsSearchHint: "Search published opinions.",
        opinionsComposerHint:
          "Sign in with email. Only signed-in members’ posts appear here, by country. You are responsible for what you write.",
        opinionsPlaceholder: "Write your opinion…",
        opinionsSubmit: "Post",
        opinionsPosting: "Posting…",
        opinionsEmpty: "No opinions for this country yet. Be the first.",
        opinionPosted: "Posted.",
        opinionsSidebarNote: "Reader post in “Public opinion”, not a news wire.",
        opinionsAuthTitle: "Sign in — Public opinion",
        opinionsAuthHint:
          "Enter your email to receive a one-time magic link. After signing in you can read members’ posts and publish your own.",
        opinionsEmailPlaceholder: "Email",
        opinionsSendMagicLink: "Send magic link",
        opinionsCheckEmail: "Check your inbox and tap the link to sign in.",
        opinionsSignOut: "Sign out",
        opinionsMyProfile: "My profile",
        opinionsConfigureSupabase:
          "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run the SQL in supabase/migrations in your Supabase project.",
        weatherWind: "Wind",
        weatherToday: "Today",
        weatherUnavailable: "Weather is unavailable right now.",
        noAr: "No articles right now.",
        noFr: "No articles right now.",
        selectedTitle: "Selection",
        selectHint: "Click a card to show one article in the sidebar.",
        selectionPhoto: "Share",
        clearSelection: "Clear selection",
        sourceLink: "Read on original source ↗",
        newsTitle: `${activeCountry.names.en} news`,
        intlTitle: "International news",
      },
    } as const;
    return byLang[uiLang];
  }, [uiLang, activeCountry]);

  const opinionsLabels = useMemo<PublicOpinionsLabels>(
    () => ({
      opinionsTitle: t.opinionsTitle,
      opinionsComposerHint: t.opinionsComposerHint,
      opinionsPlaceholder: t.opinionsPlaceholder,
      opinionsSubmit: t.opinionsSubmit,
      opinionsPosting: t.opinionsPosting,
      opinionsEmpty: t.opinionsEmpty,
      opinionPosted: t.opinionPosted,
      opinionsAuthTitle: t.opinionsAuthTitle,
      opinionsAuthHint: t.opinionsAuthHint,
      opinionsEmailPlaceholder: t.opinionsEmailPlaceholder,
      opinionsSendMagicLink: t.opinionsSendMagicLink,
      opinionsCheckEmail: t.opinionsCheckEmail,
      opinionsSignOut: t.opinionsSignOut,
      opinionsMyProfile: t.opinionsMyProfile,
      opinionsConfigureSupabase: t.opinionsConfigureSupabase,
    }),
    [t],
  );

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

  /** Selected card for sidebar (news filters vs opinions search). */
  const selectedArticle = useMemo(() => {
    if (!selectedId) return null;
    if (viewMode === "opinions") {
      return opinionFeedArticles.find((a) => a.id === selectedId) ?? null;
    }
    return filteredArticles.find((a) => a.id === selectedId) ?? null;
  }, [selectedId, viewMode, filteredArticles, opinionFeedArticles]);

  useEffect(() => {
    if (viewMode !== "news") return;
    if (selectedId && !filteredArticles.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [viewMode, filteredArticles, selectedId]);

  useEffect(() => {
    if (viewMode !== "opinions") return;
    if (selectedId && !opinionFeedArticles.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [viewMode, opinionFeedArticles, selectedId]);

  const selectArticle = useCallback((article: NewsArticle) => {
    setSelectedId(article.id);
  }, []);

  const onOpinionFeedChange = useCallback((articles: NewsArticle[]) => {
    setOpinionFeedArticles(articles);
  }, []);

  const onOpinionBusy = useCallback((busy: boolean) => {
    setOpinionsLoading(busy);
  }, []);

  const onOpinionErr = useCallback((msg: string | null) => {
    setOpinionsErr(msg);
  }, []);

  const bumpOpinionsReload = useCallback(() => {
    setOpinionsReloadKey((k) => k + 1);
  }, []);

  const openShareForSelection = useCallback(() => {
    if (!selectedArticle) return;
    setShareTarget({ articles: [selectedArticle], theme });
  }, [selectedArticle, theme]);

  const toggleFilterGroup = useCallback((id: TopicFilterGroup) => {
    setFilterGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selRtl = selectedArticle?.locale === "ar";

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

  const openShareFromDoubleClick = useCallback(
    (article: NewsArticle) => {
      setShareTarget({ articles: [article], theme });
    },
    [theme],
  );

  return (
    <main
      className={`relative mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 pb-16 pt-3 md:px-8 ${theme === "newspaper" ? "newspaper-main" : ""} ${theme === "broadsheet" ? "broadsheet-main" : ""}`}
    >
      <header
        className="theme-header sticky top-0 z-50 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#05060a]/88 px-4 py-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl md:-mx-8 md:px-8"
        dir="ltr"
      >
        <div className="order-1 flex min-w-0 items-center gap-2">
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
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3">
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
          {viewMode === "news" && data?.fetchedAt && (
            <span className="theme-muted hidden max-w-[9rem] truncate text-[9px] text-slate-500 lg:inline">
              {new Intl.DateTimeFormat("fr-TN", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(data.fetchedAt))}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (viewMode === "weather") {
                void loadWeather();
                return;
              }
              if (viewMode === "opinions") {
                bumpOpinionsReload();
                return;
              }
              void load();
            }}
            disabled={
              viewMode === "weather" ? weatherLoading : viewMode === "opinions" ? opinionsLoading : loading
            }
            title="Rafraîchir / تحديث"
            aria-label="Rafraîchir les actualités"
            className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-900/25 transition hover:brightness-110 disabled:opacity-50 sm:px-3.5 sm:text-xs"
          >
            {(viewMode === "weather" ? weatherLoading : viewMode === "opinions" ? opinionsLoading : loading)
              ? "…"
              : "↻"}
          </button>
        </div>
        <div className="order-3 w-full sm:order-2 sm:ml-3 sm:w-auto">
          <div className="mx-auto flex w-full max-w-[22rem] items-center justify-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-1 sm:mx-0 sm:w-auto sm:justify-start">
            <button
              type="button"
              onClick={() => setViewMode("news")}
              className={`min-h-9 flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition sm:min-h-0 sm:flex-none sm:px-2 sm:py-1 sm:text-[10px] ${
                viewMode === "news" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.newsButton}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("opinions");
                bumpOpinionsReload();
              }}
              className={`min-h-9 flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition sm:min-h-0 sm:flex-none sm:px-2 sm:py-1 sm:text-[10px] ${
                viewMode === "opinions" ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.opinionsButton}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("weather");
                void loadWeather();
              }}
              className={`min-h-9 flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition sm:min-h-0 sm:flex-none sm:px-2 sm:py-1 sm:text-[10px] ${
                viewMode === "weather" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.weatherButton}
            </button>
          </div>
        </div>
      </header>

      {viewMode === "news" || viewMode === "opinions" ? (
        <div className="theme-panel mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
          <input
            id="news-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="theme-input w-full rounded-lg border border-white/35 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-white/70"
          />
          <p className="theme-muted mt-2 text-center text-[10px] leading-snug sm:text-[11px]">
            {viewMode === "news" ? t.shareHint : t.opinionsSearchHint}
          </p>
        </div>
      ) : null}

      {viewMode === "news" && err && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {viewMode === "opinions" && opinionsErr && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {opinionsErr}
        </div>
      )}

      {viewMode === "news" || viewMode === "opinions" ? (
        <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-12">
            {viewMode === "news" ? (
              <>
                <div dir="rtl" lang="ar">
            <h2 className="theme-headline mb-4 text-2xl font-bold text-white">{t.newsTitle}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {arabic.map((a) => (
                <li key={a.id}>
                  <ArticleCard
                    article={a}
                    onSelect={() => selectArticle(a)}
                    active={selectedId === a.id}
                    onShareDoubleClick={() => openShareFromDoubleClick(a)}
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
                    onSelect={() => selectArticle(a)}
                    active={selectedId === a.id}
                    onShareDoubleClick={() => openShareFromDoubleClick(a)}
                  />
                </li>
              ))}
            </ul>
            {french.length === 0 && !loading && (
              <p className="theme-muted text-slate-500">{t.noFr}</p>
            )}
                </div>
              </>
            ) : (
              <PublicOpinionsPanel
                country={country}
                uiLang={uiLang}
                searchQuery={searchQuery}
                labels={opinionsLabels}
                selectedId={selectedId}
                onSelectArticle={selectArticle}
                onShareDoubleClick={openShareFromDoubleClick}
                onFeedArticlesChange={onOpinionFeedChange}
                onBusyChange={onOpinionBusy}
                onErrorChange={onOpinionErr}
                reloadKey={opinionsReloadKey}
              />
            )}
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-14 lg:self-start">
          <aside
            className="theme-panel h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
            dir={selRtl ? "rtl" : "ltr"}
            lang={selRtl ? "ar" : "fr"}
          >
            <h2 className="theme-headline text-lg font-semibold text-white">{t.selectedTitle}</h2>
            {!selectedArticle && (
              <p className="theme-muted mt-2 text-sm text-slate-500">
                {t.selectHint}
              </p>
            )}
            {selectedArticle && (
              <div className="mt-3 flex flex-wrap gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => openShareForSelection()}
                  className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md transition hover:brightness-110"
                >
                  {t.selectionPhoto}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="theme-mode-toggle rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                >
                  {t.clearSelection}
                </button>
              </div>
            )}
            {selectedArticle && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedArticle.independentMedia && (
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
                    {selectedArticle.topic}
                  </span>
                </div>
                <p className="theme-headline text-base font-medium leading-snug text-white">
                  {selectedArticle.translatedTitle ?? selectedArticle.title}
                </p>
                <p className="theme-muted text-xs uppercase tracking-wide text-slate-500">{selectedArticle.sourceLabel}</p>
                <time
                  dateTime={selectedArticle.pubDate ?? undefined}
                  className="theme-muted text-[11px] text-slate-400"
                >
                  {formatCardDate(selectedArticle.pubDate, selectedArticle.locale)}
                </time>
                {selectedArticle.summary && (
                  <p className="theme-muted text-sm leading-relaxed text-slate-400">{selectedArticle.summary}</p>
                )}
                {selectedArticle.sourceId === "public-opinion" ? (
                  <p className="theme-muted text-sm leading-relaxed text-slate-400">{t.opinionsSidebarNote}</p>
                ) : (
                  <a
                    href={selectedArticle.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-2 rounded-lg bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25"
                  >
                    {t.sourceLink}
                  </a>
                )}
              </div>
            )}

            {viewMode === "news" ? (
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
            ) : null}
          </aside>

          {viewMode === "news" ? (
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
          ) : null}
        </div>
      </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="theme-panel rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="theme-headline text-2xl font-bold">{t.weatherTitle}</h2>
              <button
                type="button"
                onClick={() => setWeatherShareOpen(true)}
                disabled={!weatherData || weatherLoading}
                className="rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
              >
                {t.weatherShare}
              </button>
            </div>
            {weatherErr ? (
              <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{weatherErr}</p>
            ) : null}
            {!weatherErr && !weatherLoading && !weatherData ? (
              <p className="theme-muted text-sm">{t.weatherUnavailable}</p>
            ) : null}
            {weatherLoading ? <p className="theme-muted text-sm">Loading weather…</p> : null}
            {weatherData ? (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-sky-900/60 via-cyan-900/35 to-indigo-900/40 p-4">
                  <div className="pointer-events-none absolute -right-2 -top-3 text-6xl opacity-30" aria-hidden>
                    {weatherCodeEmoji(weatherData.current.weatherCode)}
                  </div>
                  <p className="text-sm text-slate-300">{weatherData.city}</p>
                  <p className="mt-1 text-4xl font-bold text-white">
                    {weatherData.current.temperature == null ? "—" : `${Math.round(weatherData.current.temperature)}°C`}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-200">
                    <span aria-hidden>{weatherCodeEmoji(weatherData.current.weatherCode)}</span>
                    <span>{weatherCodeLabel(weatherData.current.weatherCode, uiLang)}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t.weatherWind}: {weatherData.current.windSpeed == null ? "—" : `${Math.round(weatherData.current.windSpeed)} km/h`}
                  </p>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {weatherData.daily.map((d) => (
                    <li key={d.date} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-400">{new Date(d.date).toLocaleDateString(uiLang === "ar" ? "ar" : "fr-TN")}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                        <span aria-hidden>{weatherCodeEmoji(d.weatherCode)}</span>
                        <span>{weatherCodeLabel(d.weatherCode, uiLang)}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        {d.max == null ? "—" : `${Math.round(d.max)}°`} / {d.min == null ? "—" : `${Math.round(d.min)}°`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <aside className="theme-panel rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="theme-headline text-lg font-semibold text-white">{activeCountry.names[uiLang]}</h3>
            <p className="theme-muted mt-2 text-sm">
              {uiLang === "ar"
                ? "الطقس مرتبط بالدولة المختارة في الأعلى. غيّر الدولة لتحديث التوقعات."
                : uiLang === "fr"
                  ? "La météo suit le pays sélectionné ci-dessus. Changez de pays pour actualiser."
                  : "Weather follows the selected country above. Change country to refresh."}
            </p>
            <button
              type="button"
              onClick={() => {
                void loadWeather();
              }}
              className="mt-4 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              ↻
            </button>
          </aside>
        </section>
      )}

      {shareTarget ? (
        <ShareArticleDialog
          articles={shareTarget.articles}
          siteLabel={activeCountry.brand}
          captureTheme={shareTarget.theme}
          uiLang={uiLang}
          onClose={() => setShareTarget(null)}
        />
      ) : null}
      {weatherShareOpen && weatherData ? (
        <ShareWeatherDialog
          weather={weatherData}
          siteLabel={activeCountry.brand}
          countryName={activeCountry.names[uiLang]}
          captureTheme={theme}
          uiLang={uiLang}
          weatherPageUrl={weatherPageUrl}
          onClose={() => setWeatherShareOpen(false)}
        />
      ) : null}
    </main>
  );
}
