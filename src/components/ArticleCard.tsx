"use client";

import type { NewsArticle } from "@/lib/aggregateNews";

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

export function ArticleCard({
  article,
  onSelect,
  active,
  onShareDoubleClick,
}: {
  article: NewsArticle;
  onSelect: () => void;
  active: boolean;
  onShareDoubleClick?: () => void;
}) {
  const rtl = article.locale === "ar";
  return (
    <button
      type="button"
      onClick={() => onSelect()}
      onDoubleClick={(e) => {
        if (!onShareDoubleClick) return;
        e.preventDefault();
        onShareDoubleClick();
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
        {article.sourceKind === "opinion" && (
          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-200">
            {rtl ? "رأي" : "Opinion"}
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
