"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import type { ThemeMode } from "@/lib/uiTheme";

function formatShareDate(iso: string | null, locale: "ar" | "fr"): string {
  if (!iso) return locale === "ar" ? "—" : "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "fr-TN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(t));
}

function slugFilename(title: string): string {
  const s = title
    .slice(0, 48)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "article";
}

function canvasBackgroundForTheme(theme: ThemeMode): string {
  if (theme === "dark") return "#0b0d14";
  if (theme === "light") return "#ffffff";
  if (theme === "broadsheet") return "#fdf6e8";
  return "#fffdf5";
}

type ShareLabels = {
  title: string;
  preview: string;
  close: string;
  story: string;
  pdf: string;
  pdfBusy: string;
  preparing: string;
  shareUnavailable: string;
  pdfFail: string;
};

const LABELS: Record<"ar" | "fr" | "en", ShareLabels> = {
  ar: {
    title: "مشاركة المقال",
    preview: "معاينة بنمط العرض الحالي",
    close: "إغلاق",
    story: "مشاركة (قصة)",
    pdf: "تنزيل PDF",
    pdfBusy: "جاري PDF…",
    preparing: "جاري تجهيز المشاركة…",
    shareUnavailable: "المشاركة غير متاحة على هذا المتصفح.",
    pdfFail: "تعذر إنشاء PDF.",
  },
  fr: {
    title: "Partager l’article",
    preview: "Aperçu au style actuel",
    close: "Fermer",
    story: "Partager (Story)",
    pdf: "Télécharger PDF",
    pdfBusy: "PDF…",
    preparing: "Préparation du partage…",
    shareUnavailable: "Partage système indisponible.",
    pdfFail: "Impossible de créer le PDF.",
  },
  en: {
    title: "Share article",
    preview: "Preview in current theme",
    close: "Close",
    story: "Share (Story)",
    pdf: "Download PDF",
    pdfBusy: "PDF…",
    preparing: "Preparing share…",
    shareUnavailable: "System share is not available in this browser.",
    pdfFail: "Could not create PDF.",
  },
};

function SharePreview({
  article,
  siteLabel,
  captureTheme,
}: {
  article: NewsArticle;
  siteLabel: string;
  captureTheme: ThemeMode;
}) {
  const rtl = article.locale === "ar";
  const headline = article.translatedTitle ?? article.title;
  const dateStr = formatShareDate(article.pubDate, article.locale);

  if (captureTheme === "broadsheet") {
    return (
      <div
        className="share-surface-broadsheet relative overflow-hidden rounded-sm border-[3px] border-double border-[#0c0806] bg-[#fdf6e8] p-4 text-[#0c0806] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] sm:p-6"
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "fr"}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: "radial-gradient(circle, #1a120c 0.4px, transparent 0.45px)",
              backgroundSize: "2.5px 2.5px",
            }}
          />
        </div>
        <div className="relative">
          <p
            className="text-center text-[1.85rem] leading-[0.95] tracking-tight text-[#8b1538] sm:text-[2.35rem]"
            style={{ fontFamily: "var(--font-heritage-display), UnifrakturMaguntia, serif" }}
          >
            {siteLabel}
          </p>
          <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-[0.42em] text-[#0c0806] sm:text-[10px]">
            {article.sourceLabel}
          </p>
          <div className="my-3 h-px bg-[#0c0806]" />
          <div className="my-2 h-0.5 bg-[#0c0806]" />
          <h2
            className="text-balance text-center text-[1.05rem] font-bold leading-snug sm:text-[1.2rem]"
            style={{ fontFamily: "var(--font-heritage-serif), Georgia, 'Times New Roman', serif" }}
          >
            {headline}
          </h2>
          <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#3d2f1f]">{dateStr}</p>
          {article.summary ? (
            <div
              className="mt-4 gap-x-5 text-[11px] leading-[1.55] sm:columns-3 sm:text-[10.5px]"
              style={{ fontFamily: "var(--font-heritage-serif), Georgia, 'Times New Roman', serif" }}
            >
              <p className="text-justify">{article.summary}</p>
            </div>
          ) : null}
          <div className="mt-5 border-2 border-[#0c0806] bg-[#fffdf7] px-2 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-[#3d2f1f] sm:text-[10px]">
            {article.topic}
          </div>
          <p className="mt-3 text-center text-[8px] uppercase tracking-[0.25em] text-[#5c4a3a]">{siteLabel}</p>
        </div>
      </div>
    );
  }

  if (captureTheme === "newspaper") {
    return (
      <div
        className="rounded-sm border-[1px] border-b-[3px] border-[#3d2f1f] bg-[#fffdf5] p-5 text-[#1a120c] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "fr"}
      >
        <p className="text-center font-serif text-sm font-extrabold uppercase tracking-widest text-[#5c4030]">
          {siteLabel}
        </p>
        <p className="mt-1 text-center text-[10px] font-semibold text-[#6b5344]">{article.sourceLabel}</p>
        <hr className="my-3 border-[#3d2f1f]/40" />
        <h2 className="text-center font-serif text-lg font-bold leading-snug">{headline}</h2>
        <p className="theme-muted mt-2 text-center text-[11px]">{dateStr}</p>
        {article.summary ? <p className="mt-3 text-justify font-serif text-sm leading-relaxed text-[#3d2f1f]">{article.summary}</p> : null}
        <p className="mt-3 text-center text-[10px] uppercase text-[#6b5344]">{article.topic}</p>
      </div>
    );
  }

  if (captureTheme === "light") {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm"
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "fr"}
      >
        <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-500">{siteLabel}</p>
        <p className="mt-1 text-center text-xs text-slate-600">{article.sourceLabel}</p>
        <hr className="my-3 border-slate-200" />
        <h2 className="text-center text-lg font-semibold leading-snug">{headline}</h2>
        <p className="mt-2 text-center text-xs text-slate-500">{dateStr}</p>
        {article.summary ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{article.summary}</p> : null}
        <p className="mt-3 text-center text-xs font-medium text-slate-500">{article.topic}</p>
      </div>
    );
  }

  // dark
  return (
    <div
      className="rounded-xl border border-white/15 bg-[#0b0d14] p-5 text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      dir={rtl ? "rtl" : "ltr"}
      lang={rtl ? "ar" : "fr"}
    >
      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">{siteLabel}</p>
      <p className="mt-1 text-center text-xs text-slate-400">{article.sourceLabel}</p>
      <hr className="my-3 border-white/10" />
      <h2 className="text-center text-lg font-semibold leading-snug text-white">{headline}</h2>
      <p className="mt-2 text-center text-xs text-slate-500">{dateStr}</p>
      {article.summary ? <p className="mt-3 text-sm leading-relaxed text-slate-400">{article.summary}</p> : null}
      <p className="mt-3 text-center text-xs uppercase text-slate-500">{article.topic}</p>
    </div>
  );
}

export function ShareArticleDialog({
  article,
  siteLabel,
  captureTheme,
  uiLang,
  onClose,
  autoExecute,
}: {
  article: NewsArticle;
  siteLabel: string;
  captureTheme: ThemeMode;
  uiLang: "ar" | "fr" | "en";
  onClose: () => void;
  /** When set, run story share (phone) or PDF export once after preview is painted, then close. */
  autoExecute?: "story" | "pdf";
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [autoBusy, setAutoBusy] = useState(Boolean(autoExecute));
  const labels = LABELS[uiLang];

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const preferStory = narrow && canShare;
  const btnPrimary =
    "rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 disabled:opacity-50";
  const btnSecondary =
    "theme-mode-toggle rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50";

  const handleShareStory = useCallback(async (): Promise<boolean> => {
    setErr(null);
    if (!canShare) {
      setErr(labels.shareUnavailable);
      return false;
    }
    const headline = article.translatedTitle ?? article.title;
    const text = [article.sourceLabel, article.summary].filter(Boolean).join("\n\n");
    const el = previewRef.current;
    try {
      if (el) {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: canvasBackgroundForTheme(captureTheme),
        });
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
        if (blob && typeof navigator.canShare === "function") {
          const file = new File([blob], `${slugFilename(headline)}.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: headline,
              text: text || headline,
            });
            return true;
          }
        }
      }
      await navigator.share({
        title: headline,
        text: text || headline,
        url: article.link,
      });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
      setErr(labels.shareUnavailable);
      return false;
    }
  }, [article, canShare, captureTheme, labels.shareUnavailable]);

  const handlePdf = useCallback(async (): Promise<boolean> => {
    const el = previewRef.current;
    if (!el) return false;
    setErr(null);
    setPdfBusy(true);
    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: canvasBackgroundForTheme(captureTheme),
      });
      const imgData = canvas.toDataURL("image/png", 0.92);
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      let w = maxW;
      let h = (canvas.height * w) / canvas.width;
      if (h > maxH) {
        h = maxH;
        w = (canvas.width * h) / canvas.height;
      }
      const x = (pageW - w) / 2;
      const y = margin;
      pdf.addImage(imgData, "PNG", x, y, w, h);
      pdf.save(`${slugFilename(article.translatedTitle ?? article.title)}.pdf`);
      return true;
    } catch {
      setErr(labels.pdfFail);
      return false;
    } finally {
      setPdfBusy(false);
    }
  }, [article, captureTheme, labels.pdfFail]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoExecute || autoStarted.current) return;
    autoStarted.current = true;
    let cancelled = false;
    const run = async () => {
      let ok = false;
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        if (cancelled) return;
        if (autoExecute === "pdf") {
          ok = await handlePdf();
        } else {
          ok = await handleShareStory();
        }
      } finally {
        if (!cancelled) {
          setAutoBusy(false);
          if (ok) onClose();
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [autoExecute, handlePdf, handleShareStory, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={labels.close} onClick={onClose} />
      <div
        className="theme-panel relative z-[1] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {autoBusy ? (
          <div className="absolute inset-3 z-20 flex items-center justify-center rounded-xl bg-black/45 px-4 backdrop-blur-[2px]">
            <p className="text-center text-sm font-medium text-white">{labels.preparing}</p>
          </div>
        ) : null}
        <div>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 id="share-dialog-title" className="theme-headline text-lg font-semibold">
                {labels.title}
              </h2>
              <p className="theme-muted text-xs">{labels.preview}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="theme-mode-toggle rounded-full px-3 py-1 text-xs font-semibold"
            >
              {labels.close}
            </button>
          </div>

          <div ref={previewRef} className="rounded-lg">
            <SharePreview article={article} siteLabel={siteLabel} captureTheme={captureTheme} />
          </div>

          {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
          {canShare ? (
            <button
              type="button"
              onClick={() => void handleShareStory()}
              className={preferStory ? btnPrimary : btnSecondary}
            >
              {labels.story}
            </button>
          ) : null}
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void handlePdf()}
            className={preferStory ? btnSecondary : btnPrimary}
          >
            {pdfBusy ? labels.pdfBusy : labels.pdf}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
