"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import type { ThemeMode } from "@/lib/uiTheme";
import { BrandLogo } from "@/components/BrandLogo";

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
  if (theme === "broadsheet") return "#fdf5e6";
  return "#fffdf5";
}

/** Same-origin data URI — drawing it never taints the export canvas. */
const HTML2CANVAS_BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const PDF_JPEG_QUALITY = 0.88;

/**
 * RSS hero images are cross-origin; html2canvas may still produce a tainted canvas, so
 * `toDataURL` / `toBlob` throw. We swap remote bitmaps only inside html2canvas's cloned DOM.
 */
function stripRemoteRasterImagesInClone(rootOnPage: HTMLElement, clonedDoc: Document): void {
  const origList = [...rootOnPage.querySelectorAll("img")];
  const cloneList = [...clonedDoc.querySelectorAll("img")];
  const n = Math.min(origList.length, cloneList.length);
  for (let i = 0; i < n; i++) {
    const o = origList[i] as HTMLImageElement;
    const c = cloneList[i] as HTMLImageElement;
    c.removeAttribute("crossorigin");
    let remote = false;
    try {
      const u = new URL(o.currentSrc || o.src || "", window.location.href);
      remote =
        (u.protocol === "http:" || u.protocol === "https:") && u.origin !== window.location.origin;
    } catch {
      remote = Boolean(o.src);
    }
    if (!remote) continue;
    try {
      const r = o.getBoundingClientRect();
      if (r.width >= 4 && r.height >= 4) {
        c.style.width = `${Math.round(r.width)}px`;
        c.style.height = `${Math.round(r.height)}px`;
        c.style.objectFit = "cover";
      }
    } catch {
      /* ignore */
    }
    c.src = HTML2CANVAS_BLANK_PIXEL;
    c.removeAttribute("srcset");
  }
}

function canvasCannotExportPng(canvas: HTMLCanvasElement): boolean {
  try {
    canvas.toDataURL("image/png", 0.92);
    return false;
  } catch {
    return true;
  }
}

function canvasCannotExportJpeg(canvas: HTMLCanvasElement, q: number): boolean {
  try {
    canvas.toDataURL("image/jpeg", q);
    return false;
  } catch {
    return true;
  }
}

/** html2canvas clone: system Arabic stacks rasterize reliably; variable font names differ by build. */
function injectPdfFriendlyArabicTypography(clonedDoc: Document): void {
  const st = clonedDoc.createElement("style");
  st.setAttribute("data-tnews-pdf-capture", "1");
  st.textContent = `
    [lang="ar"], [dir="rtl"], .share-preview-ar {
      font-family: Tahoma, "Segoe UI", "Noto Sans Arabic", "Arabic Typesetting", "Arial Unicode MS", sans-serif !important;
      letter-spacing: 0 !important;
      font-feature-settings: "liga" 1, "kern" 1;
    }
    .share-heritage-body {
      font-family: Georgia, "Times New Roman", "Noto Sans Arabic", serif !important;
    }
  `;
  (clonedDoc.head ?? clonedDoc.documentElement).appendChild(st);
}

async function waitFontsForShareCapture(root: HTMLElement): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  await document.fonts.ready;
  const pick = (root.querySelector('[lang="ar"], .share-preview-ar, [dir="rtl"]') ?? root) as HTMLElement;
  const faces = new Set<string>(["Tahoma", "Segoe UI", "Noto Sans Arabic"]);
  try {
    const ff = getComputedStyle(pick).fontFamily || "";
    const first = ff.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
    if (first) faces.add(first);
  } catch {
    /* ignore */
  }
  for (const fam of faces) {
    try {
      const q = JSON.stringify(fam);
      await document.fonts.load(`400 15px ${q}`);
      await document.fonts.load(`700 14px ${q}`);
    } catch {
      /* ignore */
    }
  }
}

/**
 * PDF-only capture: strip remote images in clone (avoids tainted canvas), inject Arabic-friendly fonts,
 * retry at lower scale if the canvas is too large or capture throws.
 */
async function captureSharePreviewForPdf(root: HTMLElement, backgroundColor: string): Promise<HTMLCanvasElement> {
  await waitFontsForShareCapture(root);
  const { default: html2canvas } = await import("html2canvas");
  const scales = [2.2, 1.75, 1.35];
  let lastErr: unknown;
  for (const scale of scales) {
    try {
      const canvas = await html2canvas(root, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor,
        onclone: (clonedDoc: Document) => {
          stripRemoteRasterImagesInClone(root, clonedDoc);
          injectPdfFriendlyArabicTypography(clonedDoc);
        },
      });
      if (canvas.width < 2 || canvas.height < 2) throw new Error("EmptyShareCapture");
      if (canvasCannotExportJpeg(canvas, PDF_JPEG_QUALITY)) throw new Error("TaintedCanvas");
      return canvas;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("PdfCaptureFailed");
}

function downscaleCanvasIfNeeded(canvas: HTMLCanvasElement, maxSide = 7800): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const m = Math.max(w, h);
  if (m <= maxSide) return canvas;
  const s = maxSide / m;
  const out = document.createElement("canvas");
  out.width = Math.max(2, Math.floor(w * s));
  out.height = Math.max(2, Math.floor(h * s));
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(canvas, 0, 0, w, h, 0, 0, out.width, out.height);
  if (canvasCannotExportJpeg(out, PDF_JPEG_QUALITY)) return canvas;
  return out;
}

function canvasToPdfRasterDataUrl(canvas: HTMLCanvasElement): { data: string; format: "JPEG" | "PNG" } {
  try {
    return { data: canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY), format: "JPEG" };
  } catch {
    return { data: canvas.toDataURL("image/png"), format: "PNG" };
  }
}

/** Used for system share image; retries when the canvas is tainted or capture throws. */
async function captureSharePreviewToCanvas(
  root: HTMLElement,
  backgroundColor: string,
  opts?: { scale?: number },
): Promise<HTMLCanvasElement> {
  const scale = opts?.scale ?? 2;
  const { default: html2canvas } = await import("html2canvas");
  const baseOpts = {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor,
  };
  const stripOpts = {
    ...baseOpts,
    onclone: (clonedDoc: Document) => {
      stripRemoteRasterImagesInClone(root, clonedDoc);
    },
  };

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(root, baseOpts);
  } catch {
    canvas = await html2canvas(root, stripOpts);
  }
  if (canvasCannotExportPng(canvas)) {
    const retry = await html2canvas(root, stripOpts);
    if (canvasCannotExportPng(retry)) {
      throw new Error("ShareExportTainted");
    }
    return retry;
  }
  return canvas;
}

type PdfAddImageDoc = {
  addPage(): void;
  addImage(
    imageData: string | HTMLCanvasElement,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
};

/**
 * One tall html2canvas bitmap scaled to a single A4 width becomes unreadably small.
 * Split the bitmap vertically across multiple pages at full printable width.
 */
function addCanvasToPdfPaginated(pdf: PdfAddImageDoc, canvas: HTMLCanvasElement, layout: { margin: number; maxW: number; maxH: number; pageW: number }): void {
  const { margin, maxW, maxH, pageW } = layout;
  const cw = canvas.width;
  const ch = canvas.height;
  if (cw < 2 || ch < 2) {
    throw new Error("EmptyShareCapture");
  }

  const fullHmm = (ch / cw) * maxW;
  if (fullHmm <= maxH + 0.5) {
    const x = (pageW - maxW) / 2;
    const { data, format } = canvasToPdfRasterDataUrl(canvas);
    pdf.addImage(data, format, x, margin, maxW, fullHmm);
    return;
  }

  const pages = Math.ceil(fullHmm / maxH);
  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    const sy = Math.floor((i * ch) / pages);
    const syNext = Math.floor(((i + 1) * ch) / pages);
    const sh = Math.max(1, syNext - sy);
    const piece = document.createElement("canvas");
    piece.width = cw;
    piece.height = sh;
    const ctx = piece.getContext("2d");
    if (!ctx) throw new Error("NoCanvas2d");
    ctx.drawImage(canvas, 0, sy, cw, sh, 0, 0, cw, sh);
    const hMm = (sh / cw) * maxW;
    const x = (pageW - maxW) / 2;
    const { data, format } = canvasToPdfRasterDataUrl(piece);
    pdf.addImage(data, format, x, margin, maxW, hMm);
  }
}

/** Split body copy for left / right columns (RTL-safe: prefers word/space break). */
function splitSummaryForColumns(text: string | null, rtl: boolean): [string, string] {
  if (!text) return ["", ""];
  const t = text.trim();
  if (t.length < 24) return [t, ""];
  const mid = Math.max(20, Math.floor(t.length * 0.46));
  if (rtl) {
    const after = t.indexOf(" ", mid);
    const before = t.lastIndexOf(" ", mid);
    const cut = after > mid && after < mid + 36 ? after : before > 12 ? before : mid;
    return [t.slice(0, cut).trim(), t.slice(cut).trim()];
  }
  const space = t.lastIndexOf(" ", mid);
  const cut = space > 18 ? space : mid;
  return [t.slice(0, cut).trim(), t.slice(cut).trim()];
}

function clipTeaser(s: string, max = 210): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** `text-transform: uppercase` breaks Arabic glyph shaping in several browsers. */
function heritageUpper(rtl: boolean): string {
  return rtl ? "normal-case" : "uppercase";
}

/** `text-justify` interacts badly with RTL Arabic (letters can look scrambled). */
function heritageAlign(rtl: boolean): string {
  return rtl ? "text-start" : "text-justify";
}

function firstSentence(text: string | null, max = 160): string {
  if (!text?.trim()) return "";
  const t = text.trim();
  const end = t.search(/[.!?؟]\s/);
  const chunk = end > 24 ? t.slice(0, end + 1) : t;
  return clipTeaser(chunk, max);
}

function restAfterFirstSentence(text: string | null, max = 220): string {
  if (!text?.trim()) return "";
  const t = text.trim();
  const end = t.search(/[.!?؟]\s/);
  if (end < 12) return clipTeaser(t, max);
  return clipTeaser(t.slice(end + 1).trim(), max);
}

function ShareHeroImage({ url, rtl, caption }: { url: string | null; rtl: boolean; caption: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <figure className="flex flex-col items-center">
      <div className="share-masthead-photo relative max-w-[13.5rem] shrink-0 bg-[#ebe3d4] p-1 sm:max-w-[15rem]">
        <div className="share-masthead-photo-inner overflow-hidden bg-[#1a1510]">
          {url && !broken ? (
            <img
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={() => setBroken(true)}
              className="mx-auto block max-h-[12.5rem] w-full object-cover object-top grayscale contrast-[1.08] sepia-[0.12]"
            />
          ) : (
            <div className="flex h-48 w-[11.5rem] flex-col items-center justify-center gap-2 px-3 text-center text-stone-300">
              <span className="text-3xl opacity-40" aria-hidden>
                ◫
              </span>
              <span
                className={`text-[9px] font-bold tracking-wide text-stone-400 ${rtl ? "normal-case" : "uppercase"}`}
              >
                {rtl ? "لا صورة في الخلاصة" : "No wire photo"}
              </span>
            </div>
          )}
        </div>
      </div>
      <figcaption
        className={`share-heritage-body mt-2 max-w-[14rem] text-center text-[8px] font-black leading-tight text-[#1a120c] ${
          rtl ? "normal-case tracking-normal" : "uppercase tracking-[0.18em]"
        }`}
        dir={rtl ? "rtl" : "ltr"}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

function dominantRtl(articles: NewsArticle[]): boolean {
  const ar = articles.filter((a) => a.locale === "ar").length;
  return ar * 2 >= articles.length;
}

/** One vintage broadsheet page: full selection list + a single hero photo from the first item that carries an RSS image. */
function ShareSelectionVintageBroadsheet({
  articles,
  siteLabel,
  uiLang,
}: {
  articles: NewsArticle[];
  siteLabel: string;
  uiLang: "ar" | "fr" | "en";
}) {
  const rtl = dominantRtl(articles);
  const ar = rtl ? "share-preview-ar" : "";
  const selectionSub =
    uiLang === "ar"
      ? "صفحة واحدة — صورة من أول خبر يوفّر الصورة في الخلاصة"
      : uiLang === "fr"
        ? "Une page — photo du premier article qui fournit une image dans le flux"
        : "One page — photo from the first article that includes an image in the feed";
  const hero = articles.find((a) => a.imageUrl) ?? articles[0]!;
  const photoUrl = hero.imageUrl;
  const others = articles.filter((a) => a.id !== hero.id);
  const heroHeadline = hero.translatedTitle ?? hero.title;
  const wireCaption = rtl
    ? clipTeaser(heroHeadline, 44)
    : heroHeadline
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6)
        .join(" ")
        .toLocaleUpperCase("fr-FR")
        .slice(0, 52);
  const strap = rtl ? `مختارات — ${articles.length} مقالات` : `${articles.length}-ITEM DESK SELECTION`;
  const rightBlurb = clipTeaser(
    others
      .map((a) => firstSentence(a.summary, 140))
      .filter(Boolean)
      .join("\n\n") || firstSentence(hero.summary, 320),
    520,
  );
  const leftBlurb = clipTeaser(
    others
      .map((a) => restAfterFirstSentence(a.summary, 120))
      .filter(Boolean)
      .join("\n\n") || restAfterFirstSentence(hero.summary, 320),
    520,
  );

  return (
    <div
      className={`share-surface-broadsheet share-vintage-front relative overflow-hidden rounded-sm border-[3px] border-double border-[#0c0806] p-3 text-[#0c0806] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] sm:p-4 ${ar}`}
      dir={rtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "radial-gradient(circle, #1a120c 0.4px, transparent 0.45px)",
            backgroundSize: "2.5px 2.5px",
          }}
        />
      </div>
      <div className="relative">
        <header className="flex flex-col items-center pb-2 text-center">
          <BrandLogo theme="broadsheet" className="mb-1.5 h-10 w-10 sm:h-11 sm:w-11" />
          <p
            className="share-site-latin text-[1.65rem] leading-[0.9] tracking-tight sm:text-[2rem]"
            style={{
              fontFamily: "var(--font-heritage-display), UnifrakturMaguntia, serif",
              color: "#b91c1c",
            }}
          >
            {siteLabel}
          </p>
          <div className="mt-2 h-px w-[min(100%,17rem)] bg-black" />
          <div className="mt-1 h-0.5 w-[min(100%,12rem)] bg-black" />
          <p
            className={`mt-2.5 max-w-[99%] text-[10px] font-black leading-snug tracking-[0.05em] text-black sm:text-[11px] ${heritageUpper(rtl)}`}
          >
            {strap}
          </p>
          <p
            className={`mt-1.5 text-[8px] font-semibold tracking-widest text-[#3d2f1f] ${uiLang === "ar" ? "normal-case" : "uppercase"}`}
            dir={uiLang === "ar" ? "rtl" : "ltr"}
            lang={uiLang === "ar" ? "ar" : uiLang === "fr" ? "fr" : "en"}
          >
            {selectionSub}
          </p>
        </header>

        <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.05fr)_auto_minmax(0,1.05fr)] sm:items-start sm:gap-2">
          <div className="order-2 max-h-[28rem] overflow-hidden sm:order-1">
            <p
              className={`share-heritage-body mb-1 text-[7px] font-black tracking-[0.2em] text-[#5c4a3a] ${heritageUpper(rtl)}`}
            >
              {rtl ? "العناوين" : "Headlines"}
            </p>
            <ol className="list-decimal space-y-1.5 ps-3.5 text-[9px] leading-[1.45] text-[#1a120c] sm:text-[8.5px]">
              {articles.map((a) => {
                const arItem = a.locale === "ar";
                return (
                  <li
                    key={a.id}
                    className={`[unicode-bidi:isolate] ${heritageAlign(arItem)}`}
                    dir="auto"
                    lang={arItem ? "ar" : "fr"}
                  >
                    <span className={`font-bold ${arItem ? "" : "share-heritage-body"}`}>
                      {a.translatedTitle ?? a.title}
                    </span>
                    <span
                      className={`mt-0.5 block text-[7.5px] font-semibold tracking-wide text-[#5c4a3a] ${arItem ? "normal-case" : "uppercase"}`}
                    >
                      {a.sourceLabel} · {formatShareDate(a.pubDate, a.locale)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="order-1 flex justify-center sm:order-2">
            <ShareHeroImage url={photoUrl} rtl={rtl} caption={wireCaption} />
          </div>
          <div
            className={`order-3 max-h-[28rem] overflow-hidden text-[9px] leading-[1.55] text-[#1a120c] sm:text-[8.5px] ${heritageAlign(rtl)} ${!rtl ? "share-heritage-body" : ""}`}
            style={!rtl ? { fontFamily: "var(--font-heritage-serif), Georgia, serif" } : undefined}
          >
            <p
              className={`share-heritage-body mb-1 text-[7px] font-black tracking-[0.2em] text-[#5c4a3a] ${heritageUpper(rtl)}`}
            >
              {rtl ? "برقية" : "Wire"}
            </p>
            <p className="border-b border-black/15 pb-2">{leftBlurb || "—"}</p>
            <p
              className={`share-heritage-body mb-1 mt-2 text-[7px] font-black tracking-[0.2em] text-[#5c4a3a] ${heritageUpper(rtl)}`}
            >
              {rtl ? "متابعة" : "Follow"}
            </p>
            <p>{rightBlurb || "—"}</p>
          </div>
        </section>

        <div
          className={`mt-4 border-2 border-[#0c0806] bg-[#fffdf7] px-2 py-1.5 text-center text-[8px] font-bold tracking-widest text-[#3d2f1f] ${heritageUpper(rtl)}`}
        >
          {siteLabel}
          <span className="mx-2 text-[#8b7355]">·</span>
          {articles.length} {rtl ? "مقالات" : "articles"}
        </div>
      </div>
    </div>
  );
}

function VintageNewsCase({
  kicker,
  title,
  body,
  rtl,
}: {
  kicker?: string;
  title: string;
  body: string;
  rtl: boolean;
}) {
  return (
    <div
      className="share-vintage-case flex flex-col border-2 border-[#0c0806] bg-[#fffdf7] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
      dir={rtl ? "rtl" : "ltr"}
    >
      {kicker ? (
        <p
          className={`share-heritage-body mb-1 text-[7px] font-bold tracking-[0.28em] text-[#5c4a3a] ${heritageUpper(rtl)}`}
        >
          {kicker}
        </p>
      ) : null}
      <p
        className={`share-heritage-body text-[10px] font-black leading-snug tracking-wide text-[#0c0806] ${heritageUpper(rtl)}`}
      >
        {title}
      </p>
      <p
        className={`mt-2 text-[9px] leading-[1.5] text-[#2a2118] ${heritageAlign(rtl)} ${rtl ? "" : "share-heritage-body"}`}
      >
        {body || "—"}
      </p>
    </div>
  );
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
  const ar = rtl ? "share-preview-ar" : "";

  if (captureTheme === "broadsheet") {
    const killerLine = rtl ? headline : headline.toLocaleUpperCase("fr-FR");
    const [rawLeft, rawRight] = splitSummaryForColumns(article.summary, rtl);
    const leadL = clipTeaser(rawLeft, 260);
    const leadR = clipTeaser(rawRight, 260);
    const wireCaption = rtl
      ? clipTeaser(headline, 40)
      : headline
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 5)
          .join(" ")
          .toLocaleUpperCase("fr-FR")
          .slice(0, 48);
    const extraKicker = rtl ? "عاجل" : "EXTRA";
    const topicCaseTitle = rtl ? article.topic : article.topic.toLocaleUpperCase("fr-FR");
    const sourceCaseTitle = rtl ? article.sourceLabel : article.sourceLabel.toLocaleUpperCase("fr-FR");
    const hasWirePhoto = Boolean(article.imageUrl);

    return (
      <div
        className={`share-surface-broadsheet share-vintage-front relative overflow-hidden rounded-sm border-[3px] border-double border-[#0c0806] p-3 text-[#0c0806] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] sm:p-5 ${ar}`}
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "fr"}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: "radial-gradient(circle, #1a120c 0.4px, transparent 0.45px)",
              backgroundSize: "2.5px 2.5px",
            }}
          />
        </div>
        <div className="relative">
          <header className="flex flex-col items-center pb-2 text-center">
            <BrandLogo theme="broadsheet" className="mb-1.5 h-11 w-11 sm:h-12 sm:w-12" />
            <p
              className="share-site-latin text-[1.85rem] leading-[0.9] tracking-tight sm:text-[2.25rem]"
              style={{
                fontFamily: "var(--font-heritage-display), UnifrakturMaguntia, serif",
                color: "#b91c1c",
              }}
            >
              {siteLabel}
            </p>
            <div className="mt-2 h-px w-[min(100%,18rem)] bg-black" />
            <div className="mt-1 h-0.5 w-[min(100%,14rem)] bg-black" />
            <p
              className={`mt-3 max-w-[99%] text-[10px] font-black leading-[1.35] tracking-[0.06em] text-black sm:text-[11px] ${heritageUpper(rtl)}`}
            >
              {killerLine}
            </p>
            <p className={`mt-2 text-[9px] font-bold tracking-[0.32em] text-[#0c0806] ${heritageUpper(rtl)}`}>
              {article.sourceLabel}
            </p>
            <p className={`mt-1 text-[8px] font-semibold tracking-widest text-[#3d2f1f] ${heritageUpper(rtl)}`}>{dateStr}</p>
          </header>

          <section
            className={`mt-4 grid grid-cols-1 gap-4 sm:items-start sm:gap-3 ${
              hasWirePhoto
                ? "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            }`}
          >
            <div
              className={`${heritageAlign(rtl)} text-[10px] leading-[1.55] text-[#1a120c] sm:px-0.5 ${!rtl ? "share-heritage-body" : ""}`}
              style={!rtl ? { fontFamily: "var(--font-heritage-serif), Georgia, serif" } : undefined}
            >
              {leadL || (rtl ? "…" : "—")}
            </div>
            {hasWirePhoto ? (
              <div className="flex justify-center">
                <ShareHeroImage url={article.imageUrl} rtl={rtl} caption={wireCaption} />
              </div>
            ) : null}
            <div
              className={`${heritageAlign(rtl)} text-[10px] leading-[1.55] text-[#1a120c] sm:px-0.5 ${!rtl ? "share-heritage-body" : ""}`}
              style={!rtl ? { fontFamily: "var(--font-heritage-serif), Georgia, serif" } : undefined}
            >
              {leadR || (rtl ? "…" : "—")}
            </div>
          </section>

          <div className="share-vintage-rule-thick my-4 border-y-2 border-black bg-[#f4ead4] px-2 py-2.5 text-center sm:px-4">
            <p
              className={`text-balance text-[11px] font-black leading-tight tracking-[0.04em] text-[#0c0806] sm:text-[12px] ${heritageUpper(rtl)}`}
            >
              {killerLine}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <VintageNewsCase
              rtl={rtl}
              kicker={dateStr}
              title={topicCaseTitle}
              body={firstSentence(article.summary, 200)}
            />
            <VintageNewsCase
              rtl={rtl}
              kicker={extraKicker}
              title={sourceCaseTitle}
              body={restAfterFirstSentence(article.summary, 220)}
            />
          </div>

          {article.summary ? (
            <div
              className={`mt-4 border-t-2 border-black pt-3 text-[10px] leading-[1.58] sm:columns-3 sm:text-[9.5px] ${!rtl ? "share-heritage-body" : ""}`}
              style={!rtl ? { fontFamily: "var(--font-heritage-serif), Georgia, serif" } : undefined}
            >
              <p className={heritageAlign(rtl)}>{article.summary}</p>
            </div>
          ) : null}

          <div
            className={`mt-4 border-2 border-[#0c0806] bg-[#fffdf7] px-2 py-2 text-center text-[9px] font-bold tracking-widest text-[#3d2f1f] sm:text-[10px] ${heritageUpper(rtl)}`}
          >
            {article.topic}
            <span className="mx-2 text-[#8b7355]">·</span>
            <span className="share-site-latin normal-case tracking-normal text-[#5c4a3a]">{siteLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  if (captureTheme === "newspaper") {
    return (
      <div
        className={`rounded-sm border-[1px] border-b-[3px] border-[#3d2f1f] bg-[#fffdf5] p-5 text-[#1a120c] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${ar}`}
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "fr"}
      >
        <p className="text-center font-serif text-sm font-extrabold uppercase tracking-widest text-[#5c4030]">
          {siteLabel}
        </p>
        <p className="mt-1 text-center text-[10px] font-semibold text-[#6b5344]">{article.sourceLabel}</p>
        <hr className="my-3 border-[#3d2f1f]/40" />
        <h2 className={`text-center text-lg font-bold leading-snug ${rtl ? "" : "font-serif"}`}>{headline}</h2>
        <p className="theme-muted mt-2 text-center text-[11px]">{dateStr}</p>
        {article.summary ? (
          <p className={`mt-3 text-justify text-sm leading-relaxed text-[#3d2f1f] ${rtl ? "" : "font-serif"}`}>{article.summary}</p>
        ) : null}
        <p className="mt-3 text-center text-[10px] uppercase text-[#6b5344]">{article.topic}</p>
      </div>
    );
  }

  if (captureTheme === "light") {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm ${ar}`}
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
      className={`rounded-xl border border-white/15 bg-[#0b0d14] p-5 text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${ar}`}
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
  articles,
  siteLabel,
  captureTheme,
  uiLang,
  onClose,
  autoExecute,
}: {
  articles: NewsArticle[];
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
    const headline = articles
      .map((a) => a.translatedTitle ?? a.title)
      .join(" · ")
      .slice(0, 200);
    const text = articles
      .map((a) => [a.sourceLabel, a.summary].filter(Boolean).join("\n"))
      .join("\n\n")
      .slice(0, 4000);
    const el = previewRef.current;
    try {
      if (el) {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        const canvas = await captureSharePreviewToCanvas(el, canvasBackgroundForTheme(captureTheme));
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
        if (blob && typeof navigator.canShare === "function") {
          const baseName =
            articles.length > 1 ? `tnews-selection-${articles.length}` : slugFilename(articles[0]!.translatedTitle ?? articles[0]!.title);
          const file = new File([blob], `${baseName}.png`, { type: "image/png" });
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
        url: articles[0]?.link,
      });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
      setErr(labels.shareUnavailable);
      return false;
    }
  }, [articles, canShare, captureTheme, labels.shareUnavailable]);

  const handlePdf = useCallback(async (): Promise<boolean> => {
    setErr(null);
    setPdfBusy(true);
    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const el = previewRef.current;
      if (!el) {
        setErr(labels.pdfFail);
        return false;
      }

      const { default: jsPDF } = await import("jspdf");
      const bg = canvasBackgroundForTheme(captureTheme);

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      const raw = await captureSharePreviewForPdf(el, bg);
      const canvas = downscaleCanvasIfNeeded(raw);
      addCanvasToPdfPaginated(pdf as PdfAddImageDoc, canvas, { margin, maxW, maxH, pageW });

      const baseName =
        articles.length > 1
          ? `tnews-selection-${articles.length}`
          : slugFilename(articles[0]!.translatedTitle ?? articles[0]!.title);
      pdf.save(`${baseName}.pdf`);
      return true;
    } catch {
      setErr(labels.pdfFail);
      return false;
    } finally {
      setPdfBusy(false);
    }
  }, [articles, captureTheme, labels.pdfFail]);

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
        className={`theme-panel relative z-[1] max-h-[92vh] w-full overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-5 ${articles.length > 1 ? "max-w-2xl" : "max-w-lg"}`}
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
            {articles.length > 1 && captureTheme === "broadsheet" ? (
              <ShareSelectionVintageBroadsheet articles={articles} siteLabel={siteLabel} uiLang={uiLang} />
            ) : articles.length > 1 ? (
              <div className="flex flex-col gap-5">
                {articles.map((art) => (
                  <SharePreview key={art.id} article={art} siteLabel={siteLabel} captureTheme={captureTheme} />
                ))}
              </div>
            ) : (
              <SharePreview article={articles[0]!} siteLabel={siteLabel} captureTheme={captureTheme} />
            )}
          </div>

          {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}

          <div className="relative z-10 mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
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
