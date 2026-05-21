import { weatherCodeEmoji } from "@/lib/weather";

/** Sun diameter in px — keep UI and share video identical. */
export const SUN_SIZE_PX = { page: 80, story: 80 } as const;

export function sunOpacityFromWeather(weatherCode: number | null): number {
  if (weatherCode == null) return 0.85;
  if (weatherCode <= 1) return 1;
  if (weatherCode <= 3) return 0.75;
  if (weatherCode === 45 || weatherCode === 48) return 0.5;
  if (weatherCode >= 61 && weatherCode <= 82) return 0.4;
  if (weatherCode >= 71 && weatherCode <= 77) return 0.35;
  return 0.55;
}

export function sunSpinPeriodMs(): number {
  return 8000;
}

/** Flat 2D sun + spinning rays — same look as `.weather-sun-2d` in CSS. */
export function drawSimpleSun2D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  weatherCode: number | null,
  spinTurns: number,
): void {
  const opacity = sunOpacityFromWeather(weatherCode);
  const rot = spinTurns * Math.PI * 2;
  const discR = radius * 0.42;

  ctx.save();
  ctx.globalAlpha = opacity;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    ctx.rotate((Math.PI * 2) / rays);
    ctx.beginPath();
    ctx.moveTo(discR * 1.05, 0);
    ctx.lineTo(radius * 0.95, 0);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
    ctx.lineWidth = radius * 0.09;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();

  const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, discR);
  discGrad.addColorStop(0, "#fde68a");
  discGrad.addColorStop(0.55, "#fbbf24");
  discGrad.addColorStop(1, "#f59e0b");
  ctx.beginPath();
  ctx.arc(cx, cy, discR, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const emoji = weatherCodeEmoji(weatherCode);
  ctx.font = `${Math.round(discR * 1.15)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, cx, cy + 1);

  if ((weatherCode ?? 0) > 3) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, cy - discR * 0.55, discR * 0.9, discR * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
