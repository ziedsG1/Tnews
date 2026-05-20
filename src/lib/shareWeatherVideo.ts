import { weatherCodeEmoji, weatherCodeLabel } from "@/lib/weather";
import type { UiLang } from "@/lib/countries";

export type WeatherVideoPayload = {
  city: string;
  countryId: string;
  current: {
    temperature: number | null;
    windSpeed: number | null;
    weatherCode: number | null;
  };
  daily: Array<{
    date: string;
    max: number | null;
    min: number | null;
    weatherCode: number | null;
  }>;
};

const STORY_W = 360;
const STORY_H = 640;
const DEFAULT_DURATION_MS = 7000;
const FPS = 30;

function sunGlow(code: number | null): number {
  if (code == null) return 0.85;
  if (code <= 1) return 1;
  if (code <= 3) return 0.72;
  if (code === 45 || code === 48) return 0.45;
  return 0.55;
}

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function drawRays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
  glow: number,
): void {
  const rays = 16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  for (let i = 0; i < rays; i++) {
    ctx.rotate((Math.PI * 2) / rays);
    ctx.beginPath();
    ctx.moveTo(radius * 0.55, 0);
    ctx.lineTo(radius * 1.05, 0);
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.35 * glow})`;
    ctx.lineWidth = radius * 0.12;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  weatherCode: number | null,
  t: number,
): void {
  const glow = sunGlow(weatherCode);
  const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.06;
  const rot = t * Math.PI * 2;
  const tiltX = Math.sin(t * Math.PI * 2) * 0.12;
  const tiltY = Math.cos(t * Math.PI * 2) * 0.15;

  drawRays(ctx, cx, cy, radius * pulse, rot, glow);

  const grad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.25, radius * 0.1, cx, cy, radius * 0.72 * pulse);
  grad.addColorStop(0, "#fff7c2");
  grad.addColorStop(0.45, "#fbbf24");
  grad.addColorStop(1, "#d97706");

  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(1, tiltX, tiltY, 1, 0, 0);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72 * pulse, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = `rgba(251, 191, 36, ${0.55 * glow})`;
  ctx.shadowBlur = radius * 0.85;
  ctx.fill();
  ctx.shadowBlur = 0;

  const emoji = weatherCodeEmoji(weatherCode);
  ctx.font = `${Math.round(radius * 1.05)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, radius * 0.02);
  ctx.restore();

  if ((weatherCode ?? 0) > 3) {
    const cloudX = cx + Math.sin(t * Math.PI * 2) * radius * 0.15;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(cloudX, cy - radius * 0.35, radius * 0.55, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  payload: WeatherVideoPayload,
  siteLabel: string,
  countryName: string,
  uiLang: UiLang,
): void {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0c4a6e");
  bg.addColorStop(0.45, "#451a03");
  bg.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const rtl = uiLang === "ar";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(186, 230, 253, 0.9)";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText(siteLabel.toUpperCase(), w / 2, 36);
  ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(countryName, w / 2, 54);

  const sunY = h * 0.38;
  drawSun(ctx, w / 2, sunY, 88, payload.current.weatherCode, progress);

  ctx.fillStyle = "rgba(186, 230, 253, 0.9)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(payload.city, w / 2, sunY + 118);

  const temp =
    payload.current.temperature == null ? "—" : `${Math.round(payload.current.temperature)}°C`;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.fillText(temp, w / 2, sunY + 168);

  const condition = weatherCodeLabel(payload.current.weatherCode, uiLang);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillText(condition, w / 2, sunY + 200, w - 40);

  const windLabel = uiLang === "ar" ? "الرياح" : uiLang === "fr" ? "Vent" : "Wind";
  const wind =
    payload.current.windSpeed == null ? "—" : `${Math.round(payload.current.windSpeed)} km/h`;
  ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(`${windLabel}: ${wind}`, w / 2, sunY + 222);

  const loc = uiLang === "ar" ? "ar" : "fr-TN";
  const days = payload.daily.slice(0, 5);
  const rowH = 34;
  const startY = h - 24 - days.length * rowH;
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(24, startY - 8);
  ctx.lineTo(w - 24, startY - 8);
  ctx.stroke();

  days.forEach((d, i) => {
    const y = startY + i * rowH;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(ctx, 16, y, w - 32, rowH - 4, 8);
    ctx.fill();

    const dateStr = new Date(d.date).toLocaleDateString(loc, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    ctx.fillStyle = "rgba(186, 230, 253, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.fillText(dateStr, rtl ? w - 24 : 24, y + 20);

    const dayEmoji = weatherCodeEmoji(d.weatherCode);
    const dayLabel = weatherCodeLabel(d.weatherCode, uiLang);
    ctx.textAlign = "center";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`${dayEmoji} ${dayLabel.slice(0, 14)}`, w / 2, y + 20, w * 0.42);

    const temps = `${d.max == null ? "—" : `${Math.round(d.max)}°`}/${d.min == null ? "—" : `${Math.round(d.min)}°`}`;
    ctx.textAlign = rtl ? "left" : "right";
    ctx.fillStyle = "rgba(240, 249, 255, 0.95)";
    ctx.fillText(temps, rtl ? 24 : w - 24, y + 20);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a 5–10s animated weather story (9:16) via canvas + MediaRecorder.
 */
export async function recordWeatherStoryVideo(
  payload: WeatherVideoPayload,
  siteLabel: string,
  countryName: string,
  uiLang: UiLang,
  durationMs = DEFAULT_DURATION_MS,
): Promise<Blob | null> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") return null;

  const mime = pickRecorderMime();
  if (!mime) return null;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W * scale;
  canvas.height = STORY_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * FPS));
  let frame = 0;

  return new Promise((resolve) => {
    const finish = () => {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      const blob = new Blob(chunks, { type: mime });
      resolve(blob.size > 1024 ? blob : null);
    };

    recorder.onstop = finish;
    recorder.onerror = () => resolve(null);

    recorder.start(200);

    const frameInterval = 1000 / FPS;
    let lastDraw = performance.now();

    const tick = (now: number) => {
      if (now - lastDraw >= frameInterval) {
        const progress = Math.min(1, frame / totalFrames);
        drawFrame(ctx, STORY_W, STORY_H, progress, payload, siteLabel, countryName, uiLang);
        frame++;
        lastDraw = now;
      }
      if (frame <= totalFrames) {
        requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => recorder.stop(), 120);
      }
    };

    requestAnimationFrame(tick);
  });
}

export function weatherVideoExtension(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  return "webm";
}
