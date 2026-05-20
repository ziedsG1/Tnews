"use client";

import { useCallback, useRef, useState } from "react";
import { heatIntensity, showHeatShimmer } from "@/lib/weatherSunVisual";
import { weatherCodeEmoji } from "@/lib/weather";

export type WeatherSunHeroProps = {
  weatherCode: number | null;
  temperature: number | null;
  label: string;
  city: string;
  windText: string;
  variant?: "page" | "story";
  interactive?: boolean;
  className?: string;
};

function WeatherSunOrb({
  weatherCode,
  temperature,
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
  temperature: number | null;
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
  const heat = heatIntensity(weatherCode, temperature);
  const emoji = weatherCodeEmoji(weatherCode);
  const stageSize =
    variant === "story"
      ? "h-[200px] w-[200px]"
      : "h-[min(52vw,220px)] w-[min(52vw,220px)] max-h-[220px] max-w-[220px]";
  const showHeat = showHeatShimmer(heat);

  return (
    <div
      ref={stageRef}
      className={`weather-sun-stage relative mx-auto flex ${stageSize} items-center justify-center ${
        variant === "story" ? "weather-sun-stage--story" : ""
      } ${interactive ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
      style={
        {
          perspective: "1100px",
          ["--sun-heat" as string]: String(heat),
        } as React.CSSProperties
      }
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerLeave={interactive ? onPointerLeave : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerCancel : undefined}
      role="img"
      aria-label={label}
    >
      {showHeat ? (
        <div className="weather-heat-field pointer-events-none absolute inset-0" aria-hidden>
          <span className="weather-heat-wave weather-heat-wave-1" />
          <span className="weather-heat-wave weather-heat-wave-2" />
          <span className="weather-heat-wave weather-heat-wave-3" />
          <span className="weather-heat-wave weather-heat-wave-4" />
          <span className="weather-heat-haze" />
        </div>
      ) : null}

      <div
        className={`weather-sun-orbit relative h-[88%] w-[88%] ${interactive ? "weather-sun-orbit--interactive" : "weather-sun-orbit--alive"} ${pressed ? "scale-[0.96]" : ""}`}
        style={
          interactive
            ? ({
                ["--sun-tilt-x" as string]: `${tilt.x}deg`,
                ["--sun-tilt-y" as string]: `${tilt.y}deg`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="weather-sun-corona pointer-events-none absolute inset-[-18%] rounded-full" aria-hidden />
        <div className="weather-sun-rays pointer-events-none absolute inset-[-6%]" aria-hidden />
        <div className="weather-sun-rays weather-sun-rays--slow pointer-events-none absolute inset-[-10%]" aria-hidden />

        <div className="weather-sun-body pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2">
          <div className="weather-sun-sphere relative h-full w-full rounded-full">
            <div className="weather-sun-limb absolute inset-0 rounded-full" aria-hidden />
            <div className="weather-sun-flare absolute inset-0 rounded-full" aria-hidden />
            <span
              className="weather-sun-emoji absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none leading-none"
              aria-hidden
            >
              {emoji}
            </span>
          </div>
        </div>

        {(weatherCode ?? 0) > 3 ? (
          <>
            <div className="weather-sun-cloud weather-sun-cloud-a pointer-events-none absolute inset-x-[4%] top-[12%] h-[30%]" aria-hidden />
            <div className="weather-sun-cloud weather-sun-cloud-b pointer-events-none absolute inset-x-[14%] top-[22%] h-[22%]" aria-hidden />
          </>
        ) : null}
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
  const [tilt, setTilt] = useState({ x: -6, y: 8 });
  const [pressed, setPressed] = useState(false);
  const isInteractive = interactive ?? variant === "page";

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -28, y: px * 32 });
  }, []);

  const resetTilt = useCallback(() => setTilt({ x: -6, y: 8 }), []);

  const tempClass = variant === "story" ? "text-[52px] sm:text-[52px]" : "text-5xl sm:text-6xl";

  return (
    <div
      className={`weather-hero flex flex-col items-center px-2 text-center ${variant === "page" ? "py-6" : "py-2"} ${className}`}
    >
      <WeatherSunOrb
        weatherCode={weatherCode}
        temperature={temperature}
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
