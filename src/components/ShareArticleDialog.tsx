"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Export uses JPEG; same check applies to tainted canvases. */
function canvasCannotExportJpeg(canvas: HTMLCanvasElement): boolean {
  try {
    canvas.toDataURL("image/jpeg", 0.88);
    return false;
  } catch {
    return true;
  }
}

/** mix-blend and heavy filters break html2canvas; keep fonts identical to the live page (no !important overrides). */
function prepareShareCaptureClone(rootOnPage: HTMLElement, clonedDoc: Document): void {
  stripRemoteRasterImagesInClone(rootOnPage, clonedDoc);
  clonedDoc.querySelectorAll(".share-capture-noise").forEach((el) => {
    (el as HTMLElement).style.setProperty("display", "none");
  });
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
 * Raster capture: strip remote images and capture-noise in the clone, retry at lower scale on failure.
 * `compact` uses gentler scales for in-app browsers (Instagram, etc.) and small viewports.
 */
async function captureSharePreviewForPdf(
  root: HTMLElement,
  backgroundColor: string,
  opts?: { compact?: boolean },
): Promise<HTMLCanvasElement> {
  await waitFontsForShareCapture(root);
  const { default: html2canvas } = await import("html2canvas");
  const scales = opts?.compact ? [1.35, 1.12, 0.95, 0.82, 0.72] : [2.2, 1.75, 1.35, 1.12];
  let lastErr: unknown;
  for (const scale of scales) {
    try {
      const canvas = await html2canvas(root, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor,
        onclone: (clonedDoc: Document) => {
          prepareShareCaptureClone(root, clonedDoc);
        },
      });
      if (canvas.width < 2 || canvas.height < 2) throw new Error("EmptyShareCapture");
      if (canvasCannotExportJpeg(canvas)) throw new Error("TaintedCanvas");
      return canvas;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("ImageCaptureFailed");
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
  if (canvasCannotExportJpeg(out)) return canvas;
  return out;
}

function shareExportBaseName(articles: NewsArticle[]): string {
  const a = articles[0];
  if (!a) return "tnews-article";
  return slugFilename(a.translatedTitle ?? a.title);
}

/** Instagram / Facebook / TikTok in-app browsers: no real Web Share, tight canvas limits. */
function inAppBrowserLikely(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\/|Snapchat/i.test(navigator.userAgent);
}

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function writeBlobImagePage(target: Window, blob: Blob, filename: string, hint: string): boolean {
  try {
    const imgUrl = URL.createObjectURL(blob);
    const safeName = filename.replace(/"/g, "");
    const escHint = hint.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    target.document.open();
    target.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Tnews</title></head><body style="margin:0;background:#0f172a;color:#e2e8f0;font:15px system-ui"><p style="padding:12px;line-height:1.45">${escHint}</p><p style="padding:0 12px 12px"><a download="${safeName}" href="${imgUrl}" style="color:#5eead4">Download</a></p><img src="${imgUrl}" alt="Tnews" style="max-width:100%;height:auto;display:block"/></body></html>`,
    );
    target.document.close();
    window.setTimeout(() => URL.revokeObjectURL(imgUrl), 180000);
    return true;
  } catch {
    return false;
  }
}

/** Same JPEG + delivery path for every theme. `preOpenedWindow` comes from a sync `window.open` in the click handler (avoids blocked saves after async capture). */
function deliverShareImageBlob(
  blob: Blob,
  filename: string,
  opts?: { preOpenedWindow?: Window | null },
): boolean {
  const hint = isAppleMobile()
    ? "Long-press the image → Save / Add to Photos. Or use Download if shown."
    : "Right-click the image → Save image as… Or use the Download link.";

  const name = filename.replace(/"/g, "");

  const tryPreOpened = (): boolean => {
    const w = opts?.preOpenedWindow;
    if (!w || w.closed) return false;
    return writeBlobImagePage(w, blob, name, hint);
  };

  const tryShare = (): boolean => {
    try {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      if (!nav.share || !nav.canShare) return false;
      const file = new File([blob], name, { type: "image/jpeg" });
      const data: ShareData = { files: [file], title: "Tnews" };
      if (!nav.canShare(data)) return false;
      void nav.share(data);
      return true;
    } catch {
      return false;
    }
  };

  const tryAnchor = (): boolean => {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.setAttribute("download", name);
      a.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01";
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      window.setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 8000);
      return true;
    } catch {
      URL.revokeObjectURL(url);
      return false;
    }
  };

  const tryNewTab = (): boolean => {
    try {
      const w = window.open("about:blank", "_blank", "noopener,noreferrer");
      if (!w) return false;
      return writeBlobImagePage(w, blob, name, hint);
    } catch {
      return false;
    }
  };

  if (tryPreOpened()) return true;
  if (tryShare()) return true;
  if (tryAnchor()) return true;
  return tryNewTab();
}

/** Raster preview → JPEG (same format for all themes). */
async function downloadSharePreviewJpeg(
  root: HTMLElement | null,
  articles: NewsArticle[],
  captureTheme: ThemeMode,
  compact: boolean,
  delivery?: { preOpenedWindow?: Window | null },
): Promise<boolean> {
  if (!root) return false;
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const bg = canvasBackgroundForTheme(captureTheme);
  const raw = await captureSharePreviewForPdf(root, bg, { compact });
  const canvas = downscaleCanvasIfNeeded(raw, compact ? 4000 : 7800);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob || blob.size < 48) return false;
  const name = `${shareExportBaseName(articles)}.jpg`;
  return deliverShareImageBlob(blob, name, delivery);
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
  noPreview: string;
  close: string;
  photo: string;
  photoBusy: string;
  preparing: string;
  downloadFail: string;
  downloadOk: string;
};

const LABELS: Record<"ar" | "fr" | "en", ShareLabels> = {
  ar: {
    title: "حفظ كصورة",
    preview: "معاينة ثم تنزيل بصيغة JPEG (نفس الصيغة لكل الأنماط)",
    noPreview: "لا يوجد خبر للمعاينة.",
    close: "إغلاق",
    photo: "تنزيل الصورة",
    photoBusy: "جاري تجهيز الصورة…",
    preparing: "جاري تجهيز الصورة…",
    downloadFail: "تعذر حفظ الصورة.",
    downloadOk: "تم تنزيل الصورة.",
  },
  fr: {
    title: "Enregistrer en image",
    preview: "Aperçu puis enregistrement en JPEG (même format pour tous les thèmes)",
    noPreview: "Aucun article à afficher.",
    close: "Fermer",
    photo: "Télécharger l’image",
    photoBusy: "Préparation de l’image…",
    preparing: "Préparation de l’image…",
    downloadFail: "Impossible d’enregistrer l’image.",
    downloadOk: "Image téléchargée.",
  },
  en: {
    title: "Save as image",
    preview: "Preview then download as JPEG (same format for every theme)",
    noPreview: "No article to preview.",
    close: "Close",
    photo: "Download image",
    photoBusy: "Preparing image…",
    preparing: "Preparing image…",
    downloadFail: "Could not save the image.",
    downloadOk: "Image downloaded.",
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
        <div className="share-capture-noise pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply">
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
  preOpenedWindow,
}: {
  articles: NewsArticle[];
  siteLabel: string;
  captureTheme: ThemeMode;
  uiLang: "ar" | "fr" | "en";
  onClose: () => void;
  /** When set, download the preview image once after paint, then close (e.g. mobile double-tap). */
  autoExecute?: "photo";
  /** From a synchronous `window.open` in the double-click handler so the browser allows showing the image after capture. */
  preOpenedWindow?: Window | null;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [autoBusy, setAutoBusy] = useState(Boolean(autoExecute));
  const labels = LABELS[uiLang];
  const previewArticle = articles[0] ?? null;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const compactCapture = useMemo(() => narrow || inAppBrowserLikely(), [narrow]);
  const btnPrimary =
    "rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 disabled:opacity-50";

  const handleDownloadPhoto = useCallback(
    async (syncFromClick?: Window | null): Promise<boolean> => {
      setErr(null);
      setInfo(null);
      setPhotoBusy(true);
      const deliveryWindow = syncFromClick === undefined ? preOpenedWindow ?? null : syncFromClick;
      try {
        const el = previewRef.current;
        const ok = await downloadSharePreviewJpeg(el, articles, captureTheme, compactCapture, {
          preOpenedWindow: deliveryWindow,
        });
        if (ok) {
          setInfo(labels.downloadOk);
          return true;
        }
        setErr(labels.downloadFail);
        if (deliveryWindow && !deliveryWindow.closed) {
          try {
            const b = deliveryWindow.document.body;
            if (b) {
              b.style.cssText = "font:15px system-ui;padding:16px;margin:0";
              b.textContent = labels.downloadFail;
            }
          } catch {
            /* ignore */
          }
        }
        return false;
      } catch {
        setErr(labels.downloadFail);
        if (deliveryWindow && !deliveryWindow.closed) {
          try {
            const b = deliveryWindow.document.body;
            if (b) {
              b.style.cssText = "font:15px system-ui;padding:16px;margin:0";
              b.textContent = labels.downloadFail;
            }
          } catch {
            /* ignore */
          }
        }
        return false;
      } finally {
        setPhotoBusy(false);
      }
    },
    [articles, captureTheme, compactCapture, labels.downloadFail, labels.downloadOk, preOpenedWindow],
  );

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
        ok = await handleDownloadPhoto();
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
  }, [autoExecute, handleDownloadPhoto, onClose]);

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
            {previewArticle ? (
              <SharePreview article={previewArticle} siteLabel={siteLabel} captureTheme={captureTheme} />
            ) : (
              <p className="theme-muted py-8 text-center text-sm">{labels.noPreview}</p>
            )}
          </div>

          {info && <p className="mt-3 text-center text-sm text-emerald-300/95">{info}</p>}
          {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}

          <div className="relative z-10 mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <button
              type="button"
              disabled={photoBusy || !previewArticle}
              onClick={() => {
                const w =
                  typeof window !== "undefined"
                    ? window.open("about:blank", "_blank", "noopener,noreferrer")
                    : null;
                void handleDownloadPhoto(w);
              }}
              className={btnPrimary}
            >
              {photoBusy ? labels.photoBusy : labels.photo}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
