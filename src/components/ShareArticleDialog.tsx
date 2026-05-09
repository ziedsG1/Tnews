"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import type { ThemeMode } from "@/lib/uiTheme";
import { proxiedArticleImageUrl } from "@/lib/shareImageUrl";
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

/** Every cross-origin <img> in the clone must be neutralized or the canvas stays tainted (Safari / mobile). */
function stripRemoteRasterImagesInCloneDocument(clonedDoc: Document): void {
  clonedDoc.querySelectorAll("img").forEach((node) => {
    const c = node as HTMLImageElement;
    c.removeAttribute("crossorigin");
    let remote = false;
    try {
      const u = new URL(c.currentSrc || c.src || "", window.location.href);
      remote =
        (u.protocol === "http:" || u.protocol === "https:") && u.origin !== window.location.origin;
    } catch {
      remote = Boolean(c.src && !c.src.startsWith("data:") && !c.src.startsWith("blob:"));
    }
    if (!remote) return;
    try {
      const r = c.getBoundingClientRect();
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
  });
}

function prepareShareCaptureClone(_rootOnPage: HTMLElement, clonedDoc: Document): void {
  stripRemoteRasterImagesInCloneDocument(clonedDoc);
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

/** html2canvas is flaky on WebKit; `html-to-image` (SVG foreignObject) tends to work better in Safari / iOS. */
function prefersHtmlToImageCapture(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return true;
  return false;
}

function replaceRemoteImagesOnLiveSubtree(root: HTMLElement): void {
  root.querySelectorAll("img").forEach((node) => {
    const c = node as HTMLImageElement;
    c.removeAttribute("crossorigin");
    let remote = false;
    try {
      const u = new URL(c.currentSrc || c.src || "", window.location.href);
      remote =
        (u.protocol === "http:" || u.protocol === "https:") && u.origin !== window.location.origin;
    } catch {
      remote = Boolean(c.src && !c.src.startsWith("data:") && !c.src.startsWith("blob:"));
    }
    if (!remote) return;
    c.src = HTML2CANVAS_BLANK_PIXEL;
    c.removeAttribute("srcset");
  });
}

function hideShareCaptureNoiseInLiveSubtree(root: HTMLElement): void {
  root.querySelectorAll(".share-capture-noise").forEach((el) => {
    (el as HTMLElement).style.setProperty("display", "none");
  });
}

async function waitForImagesInRoot(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const settle = () => {
            if (typeof img.decode === "function") {
              img.decode().then(() => resolve()).catch(() => resolve());
            } else {
              resolve();
            }
          };
          if (img.complete && img.naturalWidth > 0) {
            settle();
            return;
          }
          const done = () => settle();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, 4500);
        }),
    ),
  );
}

/**
 * Clone off-screen so fixed / modal stacking does not break WebKit rasterizers.
 */
async function captureWithHtmlToImage(
  root: HTMLElement,
  captureTheme: ThemeMode,
  opts?: { pixelRatio?: number },
): Promise<Blob | null> {
  const rect = root.getBoundingClientRect();
  const wPx = Math.max(280, Math.ceil(rect.width));
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:0;top:0;width:${wPx}px;z-index:2147483640;opacity:0.001;pointer-events:none;overflow:visible`;
  const inner = root.cloneNode(true) as HTMLElement;
  inner.style.width = `${wPx}px`;
  replaceRemoteImagesOnLiveSubtree(inner);
  hideShareCaptureNoiseInLiveSubtree(inner);
  host.appendChild(inner);
  document.body.appendChild(host);
  try {
    const { toJpeg } = await import("html-to-image");
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
    const pixelRatio = opts?.pixelRatio ?? Math.min(2.5, dpr);
    const dataUrl = await toJpeg(inner, {
      quality: 0.92,
      pixelRatio,
      cacheBust: true,
      backgroundColor: canvasBackgroundForTheme(captureTheme),
      skipFonts: /iPhone|iPad|iPod/i.test(navigator.userAgent),
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return blob.size >= 48 ? blob : null;
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

async function waitFontsForShareCapture(root: HTMLElement): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((r) => window.setTimeout(() => r(), 2500)),
    ]);
  } catch {
    /* ignore */
  }
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
      await Promise.race([
        Promise.all([document.fonts.load(`400 15px ${q}`), document.fonts.load(`700 14px ${q}`)]),
        new Promise<void>((r) => window.setTimeout(() => r(), 1200)),
      ]);
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
  root.scrollTop = 0;
  await waitFontsForShareCapture(root);
  const { default: html2canvas } = await import("html2canvas");
  const scales = compact
    ? [1.35, 1.12, 1, 0.95, 0.82, 0.72, 0.6]
    : [2.2, 1.75, 1.35, 1.12, 1, 0.92];
  let lastErr: unknown;
  for (const scale of scales) {
    try {
      const canvas = await html2canvas(root, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor,
        imageTimeout: 20000,
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

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  const fromBlob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
  if (fromBlob && fromBlob.size >= 48) return fromBlob;
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const b = new Blob([arr], { type: "image/jpeg" });
    return b.size >= 48 ? b : null;
  } catch {
    return null;
  }
}

async function captureSharePreviewAsJpegBlob(
  root: HTMLElement | null,
  captureTheme: ThemeMode,
  compact: boolean,
): Promise<Blob | null> {
  if (!root) return null;
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await Promise.race([document.fonts.ready, new Promise<void>((r) => window.setTimeout(() => r(), 2000))]);
    } catch {
      /* ignore */
    }
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await new Promise<void>((r) => window.setTimeout(() => r(), compact ? 120 : 0));
  const bg = canvasBackgroundForTheme(captureTheme);
  await waitForImagesInRoot(root);

  const storyFrame = root.dataset.instagramStory === "1";
  const storyPixelRatio = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2);

  if (prefersHtmlToImageCapture()) {
    root.scrollTop = 0;
    const hi = await captureWithHtmlToImage(root, captureTheme, storyFrame ? { pixelRatio: storyPixelRatio } : undefined);
    if (hi) return hi;
  }

  try {
    const raw = await capturePreviewRootToCanvas(root, bg, compact);
    const canvas = downscaleCanvasIfNeeded(raw, compact ? 3600 : 7800);
    return await canvasToJpegBlob(canvas, 0.88);
  } catch {
    return null;
  }
}

type IgShareResult = { kind: "sheet" } | { kind: "tab" } | { kind: "inline"; blob: Blob } | { kind: "fail" };

/**
 * Rasterizes a 9:16 story frame (source photo + headline) → JPEG, then:
 * 1) Web Share with `files` (pick Instagram on the phone), or
 * 2) `window.open(blob:…)` so the new tab shows only the image (reliable on iOS vs. writing to about:blank), or
 * 3) `inline` so the host UI can show the image here if pop-ups are blocked.
 */
async function shareInstagramStoryFromPreview(
  storyRoot: HTMLElement | null,
  article: NewsArticle,
  captureTheme: ThemeMode,
  compact: boolean,
): Promise<IgShareResult> {
  const blob = await captureSharePreviewAsJpegBlob(storyRoot, captureTheme, compact);
  if (!blob) return { kind: "fail" };
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
        return { kind: "sheet" };
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return { kind: "sheet" };
        }
      }
    }
  }

  // iOS Safari often shows an empty tab for `window.open(blob:…)` after async work; show the image in-app instead.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { kind: "inline", blob };
  }

  const url = URL.createObjectURL(blob);
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (w) {
      try {
        w.focus();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 600000);
      return { kind: "tab" };
    }
  } catch {
    /* ignore */
  }
  URL.revokeObjectURL(url);
  return { kind: "inline", blob };
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
  const sameOriginPath = Boolean(url?.startsWith("/"));
  return (
    <figure className="flex flex-col items-center">
      <div className="share-masthead-photo relative max-w-[13.5rem] shrink-0 bg-[#ebe3d4] p-1 sm:max-w-[15rem]">
        <div className="share-masthead-photo-inner overflow-hidden bg-[#1a1510]">
          {url && !broken ? (
            <img
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              crossOrigin={sameOriginPath ? undefined : "anonymous"}
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
  igFailInApp: string;
  igTabHint: string;
  igOpenedTabNote: string;
  igInlineHint: string;
};

const LABELS: Record<"ar" | "fr" | "en", ShareLabels> = {
  ar: {
    title: "مشاركة",
    subtitle: "فيسبوك: رابط المصدر. إنستغرام: صورة قصة ٩:١٦ مع صورة المصدر من الخلاصة إن وُجدت.",
    noPreview: "لا يوجد خبر.",
    close: "إغلاق",
    facebook: "فيسبوك — منشور",
    instagram: "إنستغرام — قصة (صورة المعاينة)",
    instagramBusy: "جاري تجهيز الصورة…",
    igFail:
      "تعذر إنشاء صورة المعاينة. جرّب سافاري أو كروم، أو حدّث الصفحة. إن كنت داخل تطبيق إنستغرام/فيسبوك، افتح الرابط في المتصفح الكامل.",
    igFailInApp:
      "التقاط الصورة لا يعمل داخل تطبيق إنستغرام أو فيسبوك. اضغط «⋯» أو القائمة واختر «فتح في Safari / Chrome» ثم أعد المحاولة.",
    igTabHint:
      "اضغط مطولاً على الصورة ثم احفظها، أو استخدم «تنزيل». ثم في تطبيق إنستغرام أنشئ قصة وأضف الصورة من المعرض.",
    igOpenedTabNote: "تم فتح تبويب بالصورة — اتبع التعليمات هناك لإضافتها إلى قصتك.",
    igInlineHint:
      "لم يُفتح تبويب جديد (غالباً بسبب الحظر). استخدم الصورة أدناه: اضغط مطوّلاً ثم احفظها، ثم أضفها إلى قصتك من تطبيق إنستغرام.",
  },
  fr: {
    title: "Partager",
    subtitle: "Facebook : lien source. Instagram : image story 9:16 avec la photo du flux si disponible.",
    noPreview: "Aucun article.",
    close: "Fermer",
    facebook: "Facebook — publication",
    instagram: "Instagram — story (image d’aperçu)",
    instagramBusy: "Préparation de l’image…",
    igFail:
      "Impossible de créer l’image d’aperçu. Essayez Safari ou Chrome, ou rechargez la page. Si vous êtes dans l’app Instagram/Facebook, ouvrez le lien dans le navigateur du téléphone.",
    igFailInApp:
      "La capture ne fonctionne pas dans l’application Instagram ou Facebook. Ouvrez le site dans Safari ou Chrome, puis réessayez.",
    igTabHint:
      "Appui long sur l’image pour l’enregistrer, ou utilisez « Télécharger ». Puis dans Instagram, créez une story et ajoutez la photo depuis la galerie.",
    igOpenedTabNote: "Un onglet avec l’image est ouvert — suivez les instructions pour votre story.",
    igInlineHint:
      "Impossible d’ouvrir un nouvel onglet (souvent bloqué). Utilisez l’image ci-dessous : appui long, enregistrez, puis ajoutez-la à votre story Instagram.",
  },
  en: {
    title: "Share",
    subtitle: "Facebook: source link. Instagram: 9:16 story image with the feed photo when available.",
    noPreview: "No article.",
    close: "Close",
    facebook: "Facebook — feed post",
    instagram: "Instagram — story (preview image)",
    instagramBusy: "Preparing image…",
    igFail:
      "Could not create the preview image. Try Safari or Chrome, or reload. If you are inside the Instagram or Facebook app, open this site in the phone browser.",
    igFailInApp:
      "Image capture does not work inside the Instagram or Facebook app. Open the site in Safari or Chrome, then try again.",
    igTabHint:
      "Long-press the image to save it, or use Download. Then in the Instagram app, start a story and pick the photo from your gallery.",
    igOpenedTabNote: "A new tab has the image — follow the steps there to add it to your story.",
    igInlineHint:
      "A new tab could not open (often blocked on phones). Use the image below: long-press, save, then add it to your Instagram story from Photos.",
  },
};

/** 9:16 frame for Instagram Stories: large RSS image (proxied) + headline block. */
function ShareStoryCapture({
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
  const shareImg = proxiedArticleImageUrl(article.imageUrl);
  const teaser = clipTeaser(article.summary ?? "", 150);
  const ar = rtl ? "share-preview-ar" : "";

  const panelBg =
    captureTheme === "dark"
      ? "bg-[#0b0d14]"
      : captureTheme === "light"
        ? "bg-white"
        : captureTheme === "broadsheet"
          ? "bg-[#fdf5e6]"
          : captureTheme === "newspaper"
            ? "bg-[#fffdf5]"
            : "bg-[#fffdf5]";
  const panelText =
    captureTheme === "dark" ? "text-slate-100" : captureTheme === "light" ? "text-slate-900" : "text-[#0c0806]";
  const siteAccent =
    captureTheme === "dark"
      ? "text-emerald-400/90"
      : captureTheme === "light"
        ? "text-slate-500"
        : "text-[#5c4030]";
  const metaMuted = captureTheme === "dark" ? "text-slate-400" : captureTheme === "light" ? "text-slate-600" : "text-[#6b5344]";
  const borderTop = captureTheme === "dark" ? "border-white/12" : captureTheme === "light" ? "border-slate-200" : "border-[#3d2f1f]/30";

  return (
    <div
      className={`share-story-capture flex h-[640px] w-[360px] flex-col overflow-hidden ${ar} ${panelBg} ${panelText}`}
      dir={rtl ? "rtl" : "ltr"}
      lang={rtl ? "ar" : "fr"}
    >
      <div className="relative h-[396px] w-full shrink-0 overflow-hidden bg-neutral-950">
        {shareImg ? (
          <>
            <img
              src={shareImg}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </>
        ) : (
          <div
            className={`flex h-full w-full flex-col items-center justify-center gap-2 px-5 text-center ${
              captureTheme === "dark"
                ? "bg-gradient-to-b from-slate-900 to-[#0b0d14]"
                : "bg-gradient-to-b from-slate-200 via-white to-[#f8fafc]"
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${siteAccent}`}>{siteLabel}</p>
            <p className={`text-[10px] font-semibold ${metaMuted}`}>{article.sourceLabel}</p>
          </div>
        )}
      </div>
      <div className={`flex h-[244px] w-full shrink-0 flex-col border-t px-4 pb-4 pt-3 ${borderTop} ${panelBg}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${siteAccent}`}>{siteLabel}</p>
        <p className={`text-[9px] font-semibold ${metaMuted}`}>{article.sourceLabel}</p>
        <h2 className="mt-1.5 line-clamp-4 text-balance text-[16px] font-bold leading-snug tracking-tight">{headline}</h2>
        <p className={`mt-1.5 text-[10px] ${captureTheme === "dark" ? "text-slate-500" : "text-slate-500"}`}>{dateStr}</p>
        {teaser ? (
          <p
            className={`mt-1.5 line-clamp-2 text-[11px] leading-snug ${
              captureTheme === "dark" ? "text-slate-400" : "text-slate-600"
            }`}
          >
            {teaser}
          </p>
        ) : null}
        <p className={`mt-auto truncate pt-2 text-[9px] font-semibold uppercase tracking-wide ${metaMuted}`}>{article.topic}</p>
      </div>
    </div>
  );
}

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
  const shareImg = proxiedArticleImageUrl(article.imageUrl);

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
    const hasWirePhoto = Boolean(shareImg);

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
                <ShareHeroImage url={shareImg} rtl={rtl} caption={wireCaption} />
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
        {shareImg ? (
          <div className="mt-3 flex justify-center">
            <img
              src={shareImg}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-52 w-full max-w-md rounded border border-[#3d2f1f]/40 object-cover"
            />
          </div>
        ) : null}
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
        {shareImg ? (
          <div className="mt-3 flex justify-center">
            <img
              src={shareImg}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-52 w-full max-w-md rounded-lg border border-slate-200 object-cover"
            />
          </div>
        ) : null}
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
      {shareImg ? (
        <div className="mt-3 flex justify-center">
          <img
            src={shareImg}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-52 w-full max-w-md rounded-lg border border-white/15 object-cover"
          />
        </div>
      ) : null}
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
  const storyCaptureRef = useRef<HTMLDivElement>(null);
  const [igBusy, setIgBusy] = useState(false);
  const [igTabNote, setIgTabNote] = useState(false);
  const [igErr, setIgErr] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [inlineImageUrl, setInlineImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    return () => {
      if (inlineImageUrl) URL.revokeObjectURL(inlineImageUrl);
    };
  }, [inlineImageUrl]);

  const compactCapture = narrow || inAppBrowserLikely();

  const runInstagramShare = useCallback(async () => {
    if (!article) return;
    setIgErr(null);
    setIgTabNote(false);
    setInlineImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIgBusy(true);
    try {
      const outcome = await shareInstagramStoryFromPreview(
        storyCaptureRef.current,
        article,
        captureTheme,
        compactCapture,
      );
      if (outcome.kind === "fail") {
        setIgErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
      } else if (outcome.kind === "tab") {
        setIgTabNote(true);
      } else if (outcome.kind === "inline") {
        const u = URL.createObjectURL(outcome.blob);
        setInlineImageUrl(u);
      }
    } catch {
      setIgErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
    } finally {
      setIgBusy(false);
    }
  }, [article, captureTheme, compactCapture, labels.igFail, labels.igFailInApp]);

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
              ref={storyCaptureRef}
              className="pointer-events-none fixed left-[-12000px] top-0 z-0 h-[640px] w-[360px] overflow-hidden"
              aria-hidden
              data-instagram-story="1"
              data-share-capture-root
            >
              <ShareStoryCapture article={article} siteLabel={siteLabel} captureTheme={captureTheme} />
            </div>
            <div className="max-h-[38vh] min-h-[200px] overflow-y-auto rounded-lg border border-white/10">
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
            {igTabNote && !inlineImageUrl ? (
              <p className="mt-2 text-center text-sm text-emerald-300/95">{labels.igOpenedTabNote}</p>
            ) : null}
            {inlineImageUrl ? (
              <div className="mt-3 space-y-2 rounded-xl border border-amber-400/30 bg-black/40 p-3">
                <p className="text-center text-sm font-medium text-amber-100/95">{labels.igInlineHint}</p>
                <img
                  src={inlineImageUrl}
                  alt=""
                  className="mx-auto max-h-[min(65vh,560px)] max-w-full rounded-lg border border-white/15 object-contain"
                />
                <p className="theme-muted text-center text-[11px] leading-snug text-slate-400">{labels.igTabHint}</p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="theme-muted py-8 text-center text-sm">{labels.noPreview}</p>
        )}
      </div>
    </div>
  );
}
