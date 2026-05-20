"use client";

import { useCallback, useRef, useState } from "react";
import { weatherCodeEmoji } from "@/lib/weather";

export type WeatherSunHeroProps = {
  weatherCode: number | null;
  temperature: number | null;
  label: string;
  city: string;
  windText: string;
  /** Page: interactive + responsive. Story: larger static sun for share capture. */
  variant?: "page" | "story";
  interactive?: boolean;
  className?: string;
};

function sunIntensity(code: number | null): number {
  if (code == null) return 0.85;
  if (code <= 1) return 1;
  if (code <= 3) return 0.72;
  if (code === 45 || code === 48) return 0.45;
  return 0.55;
}

function WeatherSunOrb({
  weatherCode,
  variant,
  interactive,
  tilt,
  pressed,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  stageRef,
  label,
}: {
  weatherCode: number | null;
  variant: "page" | "story";
  interactive: boolean;
  tilt: { x: number; y: number };
  pressed: boolean;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  label: string;
}) {
  const glow = sunIntensity(weatherCode);
  const emoji = weatherCodeEmoji(weatherCode);
  const stageSize =
    variant === "story"
      ? "h-[200px] w-[200px]"
      : "h-[min(52vw,220px)] w-[min(52vw,220px)] max-h-[220px] max-w-[220px]";
  const emojiSize = variant === "story" ? "text-[5.5rem]" : "text-[clamp(3.5rem,14vw,5.5rem)]";

  return (
    <div
      ref={stageRef}
      className={`weather-sun-stage relative mx-auto flex ${stageSize} items-center justify-center ${
        interactive ? "cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none"
      }`}
      style={{ perspective: "900px" }}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerLeave={interactive ? onPointerLeave : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerCancel : undefined}
      role="img"
      aria-label={label}
    >
      <div
        className={`weather-sun-orbit relative h-full w-full ${interactive ? "transition-transform duration-150 ease-out" : ""} ${pressed ? "scale-[0.96]" : "scale-100"}`}
        style={{
          transform: interactive ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` : "rotateX(-6deg) rotateY(8deg)",
          transformStyle: "preserve-3d",
        }}
      >
        <div className="weather-sun-rays absolute inset-0" aria-hidden />
        <div
          className="weather-sun-core absolute left-1/2 top-1/2 flex h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{
            opacity: glow,
            boxShadow: `0 0 ${48 * glow}px ${24 * glow}px rgba(251, 191, 36, 0.55), inset 0 -12px 24px rgba(245, 158, 11, 0.35)`,
          }}
        >
          <span className={`select-none leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] ${emojiSize}`}>
            {emoji}
          </span>
        </div>
        {(weatherCode ?? 0) > 3 && (
          <div className="weather-sun-cloud absolute inset-x-[8%] top-[18%] h-[28%] rounded-full bg-white/25 blur-md" aria-hidden />
        )}
      </div>
    </div>
  );
}

export function WeatherSunHero({
  weatherCode,
  temperature,
  label,
  city,
  windText,
  variant = "page",
  interactive,
  className = "",
}: WeatherSunHeroProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const isInteractive = interactive ?? variant === "page";

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -22, y: px * 26 });
  }, []);

  const resetTilt = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const tempClass =
    variant === "story" ? "text-[52px] sm:text-[52px]" : "text-5xl sm:text-6xl";

  return (
    <div className={`weather-hero flex flex-col items-center px-2 text-center ${variant === "page" ? "py-6" : "py-2"} ${className}`}>
      <WeatherSunOrb
        weatherCode={weatherCode}
        variant={variant}
        interactive={isInteractive}
        tilt={tilt}
        pressed={pressed}
        stageRef={stageRef}
        label={label}
        onPointerMove={onPointerMove}
        onPointerLeave={resetTilt}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
      />

      <p className={`mt-4 text-sm ${variant === "story" ? "text-sky-100/90" : "theme-muted text-slate-300"}`}>{city}</p>
      <p className={`mt-1 font-bold tracking-tight text-white ${tempClass}`}>
        {temperature == null ? "—" : `${Math.round(temperature)}°`}
        <span className={`font-semibold text-amber-200/90 ${variant === "story" ? "text-2xl" : "text-3xl"}`}>C</span>
      </p>
      <p className={`mt-2 max-w-xs text-sm font-medium ${variant === "story" ? "text-white" : "text-slate-200"}`}>{label}</p>
      <p className={`mt-1 text-xs ${variant === "story" ? "text-sky-100/85" : "theme-muted text-slate-400"}`}>{windText}</p>
    </div>
  );
}
