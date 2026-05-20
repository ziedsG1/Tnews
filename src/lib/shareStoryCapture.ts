import type { ThemeMode } from "@/lib/uiTheme";

export function facebookFeedShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
}

export function slugFilename(title: string): string {
  const s = title
    .slice(0, 48)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "share";
}

function canvasBackgroundForTheme(theme: ThemeMode): string {
  if (theme === "dark") return "#0b0d14";
  if (theme === "light") return "#ffffff";
  if (theme === "broadsheet") return "#fdf5e6";
  return "#fffdf5";
}

const HTML2CANVAS_BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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

export function inAppBrowserLikely(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\/|Snapchat/i.test(navigator.userAgent);
}

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

async function captureWithHtmlToImage(
  root: HTMLElement,
  captureTheme: ThemeMode,
  opts?: { pixelRatio?: number; cacheBust?: boolean },
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
    await waitForImagesInRoot(inner);
    const { toJpeg } = await import("html-to-image");
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
    const pixelRatio = opts?.pixelRatio ?? Math.min(2.5, dpr);
    const dataUrl = await toJpeg(inner, {
      quality: 0.92,
      pixelRatio,
      cacheBust: opts?.cacheBust !== false,
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

function canvasHeroBandLooksBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const w = canvas.width;
  const h = canvas.height;
  if (w < 8 || h < 8) return true;
  const bh = Math.max(24, Math.floor(h * 0.42));
  const bw = Math.min(w, Math.max(64, Math.floor(w * 0.38)));
  const x0 = Math.floor((w - bw) / 2);
  try {
    const d = ctx.getImageData(x0, 0, bw, bh);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.data.length; i += 16) {
      sum += d.data[i]! + d.data[i + 1]! + d.data[i + 2]!;
      n++;
    }
    const avg = n > 0 ? sum / n / 3 : 255;
    return avg < 12;
  } catch {
    return false;
  }
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

export async function captureSharePreviewAsJpegBlob(
  root: HTMLElement | null,
  captureTheme: ThemeMode,
  compact: boolean,
): Promise<Blob | null> {
  if (!root) return null;
  const storyFrame = root.dataset.instagramStory === "1";

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
  const storyPixelRatio = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2);

  await waitForImagesInRoot(root);

  if (storyFrame) {
    const hasHeroImg = Boolean(root.querySelector('img[src*="image-proxy"]'));
    let lastStoryCanvas: HTMLCanvasElement | null = null;
    try {
      const raw = await capturePreviewRootToCanvas(root, bg, compact);
      const canvas = downscaleCanvasIfNeeded(raw, compact ? 3600 : 7800);
      lastStoryCanvas = canvas;
      const looksBlank = hasHeroImg && canvasHeroBandLooksBlank(canvas);
      if (!looksBlank) {
        const b = await canvasToJpegBlob(canvas, 0.88);
        if (b) return b;
      }
    } catch {
      /* fall through */
    }
    try {
      root.scrollTop = 0;
      const hi = await captureWithHtmlToImage(root, captureTheme, {
        pixelRatio: storyPixelRatio,
        cacheBust: false,
      });
      if (hi) return hi;
    } catch {
      /* ignore */
    }
    if (lastStoryCanvas) {
      try {
        const fallback = await canvasToJpegBlob(lastStoryCanvas, 0.88);
        return fallback && fallback.size >= 48 ? fallback : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  if (prefersHtmlToImageCapture()) {
    root.scrollTop = 0;
    const hi = await captureWithHtmlToImage(root, captureTheme, undefined);
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

export type ShareImageResult = { kind: "sheet" } | { kind: "tab" } | { kind: "inline"; blob: Blob } | { kind: "fail" };

export type ShareMediaResult = ShareImageResult;

export async function shareStoryJpegBlobViaSheetOrFallback(
  blob: Blob,
  meta: { title: string; filename: string },
): Promise<ShareImageResult> {
  const file = new File([blob], meta.filename, { type: "image/jpeg" });
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === "function") {
    const data: ShareData = { files: [file], title: meta.title };
    const allowed = typeof nav.canShare !== "function" ? true : Boolean(nav.canShare(data));
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

export async function shareStoryVideoBlobViaSheetOrFallback(
  blob: Blob,
  meta: { title: string; filename: string },
): Promise<ShareMediaResult> {
  const file = new File([blob], meta.filename, { type: blob.type || "video/webm" });
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === "function") {
    const data: ShareData = { files: [file], title: meta.title };
    const allowed = typeof nav.canShare !== "function" ? true : Boolean(nav.canShare(data));
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
