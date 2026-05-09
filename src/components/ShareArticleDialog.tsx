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

function facebookFeedShareUrl(articleUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
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

function sharePreviewImageFilename(article: NewsArticle): string {
  return `${slugFilename(article.translatedTitle ?? article.title)}.jpg`;
}

function canvasBackgroundForTheme(theme: ThemeMode): string {
  if (theme === "dark") return "#0b0d14";
  if (theme === "light") return "#ffffff";
  if (theme === "broadsheet") return "#fdf5e6";
  return "#fffdf5";
}

const HTML2CANVAS_BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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

function prepareShareCaptureClone(rootOnPage: HTMLElement, clonedDoc: Document): void {
  stripRemoteRasterImagesInClone(rootOnPage, clonedDoc);
  clonedDoc.querySelectorAll(".share-capture-noise").forEach((el) => {
    (el as HTMLElement).style.setProperty("display", "none");
  });
}

function canvasCannotExportJpeg(canvas: HTMLCanvasElement): boolean {
  try {
    canvas.toDataURL("image/jpeg", 0.88);
    return false;
  } catch {
    return true;
  }
}

function inAppBrowserLikely(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\/|Snapchat/i.test(navigator.userAgent);
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

async function capturePreviewRootToCanvas(
  root: HTMLElement,
  backgroundColor: string,
  compact: boolean,
): Promise<HTMLCanvasElement> {
  await waitFontsForShareCapture(root);
  const { default: html2canvas } = await import("html2canvas");
  const scales = compact ? [1.35, 1.12, 0.95, 0.82, 0.72] : [2.2, 1.75, 1.35, 1.12];
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

async function captureSharePreviewAsJpegBlob(
  root: HTMLElement | null,
  captureTheme: ThemeMode,
  compact: boolean,
): Promise<Blob | null> {
  if (!root) return null;
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const bg = canvasBackgroundForTheme(captureTheme);
  const raw = await capturePreviewRootToCanvas(root, bg, compact);
  const canvas = downscaleCanvasIfNeeded(raw, compact ? 4000 : 7800);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob || blob.size < 48) return null;
  return blob;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillWindowWithStoryImage(target: Window, blob: Blob, filename: string, hint: string): void {
  const imgUrl = URL.createObjectURL(blob);
  const safeName = filename.replace(/"/g, "");
  const hintP = `<p style="padding:12px;line-height:1.45">${escapeHtml(hint)}</p>`;
  target.document.open();
  target.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Instagram</title></head><body style="margin:0;background:#0f172a;color:#e2e8f0;font:15px system-ui">${hintP}<p style="padding:0 12px 12px"><a download="${safeName}" href="${imgUrl}" style="color:#5eead4">Download</a></p><img src="${imgUrl}" alt="" style="max-width:100%;height:auto;display:block"/></body></html>`,
  );
  target.document.close();
  window.setTimeout(() => URL.revokeObjectURL(imgUrl), 180000);
}

type IgShareOutcome = "sheet" | "tab" | "fail";

/**
 * Rasterizes the on-screen preview card, then shares that JPEG (Instagram Stories accepts images from the share sheet).
 * Opens a blank tab synchronously from the click so a fallback tab still works after async capture.
 */
async function shareInstagramStoryFromPreview(
  root: HTMLElement | null,
  article: NewsArticle,
  captureTheme: ThemeMode,
  compact: boolean,
  preOpened: Window | null,
  tabHint: string,
): Promise<IgShareOutcome> {
  const blob = await captureSharePreviewAsJpegBlob(root, captureTheme, compact);
  if (!blob) return "fail";
  const filename = sharePreviewImageFilename(article);
  const title = article.translatedTitle ?? article.title;
  const file = new File([blob], filename, { type: "image/jpeg" });
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === "function") {
    const data: ShareData = { files: [file], title };
    const allowed =
      typeof nav.canShare !== "function" ? true : Boolean(nav.canShare(data));
    if (allowed) {
      try {
        await nav.share(data);
        if (preOpened && !preOpened.closed) preOpened.close();
        return "sheet";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          if (preOpened && !preOpened.closed) preOpened.close();
          return "sheet";
        }
      }
    }
  }
  const w =
    preOpened && !preOpened.closed ? preOpened : typeof window !== "undefined"
      ? window.open("about:blank", "_blank", "noopener,noreferrer")
      : null;
  if (!w) return "fail";
  try {
    fillWindowWithStoryImage(w, blob, filename, tabHint);
    return "tab";
  } catch {
    return "fail";
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

function heritageUpper(rtl: boolean): string {
  return rtl ? "normal-case" : "uppercase";
}

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
  subtitle: string;
  noPreview: string;
  close: string;
  facebook: string;
  instagram: string;
  instagramBusy: string;
  igFail: string;
  igTabHint: string;
  igOpenedTabNote: string;
};

const LABELS: Record<"ar" | "fr" | "en", ShareLabels> = {
  ar: {
    title: "مشاركة",
    subtitle: "فيسبوك: رابط المصدر. إنستغرام: صورة المعاينة كما تظهر هنا.",
    noPreview: "لا يوجد خبر.",
    close: "إغلاق",
    facebook: "فيسبوك — منشور",
    instagram: "إنستغرام — قصة (صورة المعاينة)",
    instagramBusy: "جاري تجهيز الصورة…",
    igFail: "تعذر إنشاء الصورة. جرّب متصفحاً آخر أو عطّل حظر النوافذ المنبثقة.",
    igTabHint:
      "اضغط مطولاً على الصورة ثم احفظها، أو استخدم «تنزيل». ثم في تطبيق إنستغرام أنشئ قصة وأضف الصورة من المعرض.",
    igOpenedTabNote: "تم فتح تبويب بالصورة — اتبع التعليمات هناك لإضافتها إلى قصتك.",
  },
  fr: {
    title: "Partager",
    subtitle: "Facebook : lien source. Instagram : image de l’aperçu telle qu’à l’écran.",
    noPreview: "Aucun article.",
    close: "Fermer",
    facebook: "Facebook — publication",
    instagram: "Instagram — story (image d’aperçu)",
    instagramBusy: "Préparation de l’image…",
    igFail: "Impossible de créer l’image. Essayez un autre navigateur ou autorisez les pop-ups.",
    igTabHint:
      "Appui long sur l’image pour l’enregistrer, ou utilisez « Télécharger ». Puis dans Instagram, créez une story et ajoutez la photo depuis la galerie.",
    igOpenedTabNote: "Un onglet avec l’image est ouvert — suivez les instructions pour votre story.",
  },
  en: {
    title: "Share",
    subtitle: "Facebook: source link. Instagram: the preview card as an image (same as on screen).",
    noPreview: "No article.",
    close: "Close",
    facebook: "Facebook — feed post",
    instagram: "Instagram — story (preview image)",
    instagramBusy: "Preparing image…",
    igFail: "Could not create the image. Try another browser or allow pop-ups.",
    igTabHint:
      "Long-press the image to save it, or use Download. Then in the Instagram app, start a story and pick the photo from your gallery.",
    igOpenedTabNote: "A new tab has the image — follow the steps there to add it to your story.",
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

const btnFb =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110";
const btnIg =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134AF] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110";

export function ShareArticleDialog({
  articles,
  siteLabel,
  captureTheme,
  uiLang,
  onClose,
}: {
  articles: NewsArticle[];
  siteLabel: string;
  captureTheme: ThemeMode;
  uiLang: "ar" | "fr" | "en";
  onClose: () => void;
}) {
  const labels = LABELS[uiLang];
  const article = articles[0] ?? null;
  const previewCaptureRef = useRef<HTMLDivElement>(null);
  const [igBusy, setIgBusy] = useState(false);
  const [igTabNote, setIgTabNote] = useState(false);
  const [igErr, setIgErr] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const compactCapture = narrow || inAppBrowserLikely();

  const runInstagramShare = useCallback(async () => {
    if (!article) return;
    setIgErr(null);
    setIgTabNote(false);
    setIgBusy(true);
    const pre =
      typeof window !== "undefined" ? window.open("about:blank", "_blank", "noopener,noreferrer") : null;
    try {
      const outcome = await shareInstagramStoryFromPreview(
        previewCaptureRef.current,
        article,
        captureTheme,
        compactCapture,
        pre,
        labels.igTabHint,
      );
      if (outcome === "fail") {
        setIgErr(labels.igFail);
        if (pre && !pre.closed) {
          try {
            pre.close();
          } catch {
            /* ignore */
          }
        }
      } else if (outcome === "tab") {
        setIgTabNote(true);
      }
    } catch {
      setIgErr(labels.igFail);
      if (pre && !pre.closed) {
        try {
          pre.close();
        } catch {
          /* ignore */
        }
      }
    } finally {
      setIgBusy(false);
    }
  }, [article, captureTheme, compactCapture, labels.igFail, labels.igTabHint]);

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
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="share-dialog-title" className="theme-headline text-lg font-semibold">
              {labels.title}
            </h2>
            <p className="theme-muted text-xs">{labels.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="theme-mode-toggle rounded-full px-3 py-1 text-xs font-semibold"
          >
            {labels.close}
          </button>
        </div>

        {article ? (
          <>
            <div
              ref={previewCaptureRef}
              className="max-h-[38vh] overflow-y-auto rounded-lg border border-white/10"
              data-share-capture-root
            >
              <SharePreview article={article} siteLabel={siteLabel} captureTheme={captureTheme} />
            </div>
            <div className="relative z-10 mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={btnFb}
                onClick={() => {
                  window.open(facebookFeedShareUrl(article.link), "_blank", "noopener,noreferrer");
                }}
              >
                {labels.facebook}
              </button>
              <button
                type="button"
                disabled={igBusy}
                className={`${btnIg} disabled:opacity-50`}
                onClick={() => void runInstagramShare()}
              >
                {igBusy ? labels.instagramBusy : labels.instagram}
              </button>
            </div>
            {igErr ? <p className="mt-2 text-center text-sm text-red-400">{igErr}</p> : null}
            {igTabNote ? <p className="mt-2 text-center text-sm text-emerald-300/95">{labels.igOpenedTabNote}</p> : null}
          </>
        ) : (
          <p className="theme-muted py-8 text-center text-sm">{labels.noPreview}</p>
        )}
      </div>
    </div>
  );
}
