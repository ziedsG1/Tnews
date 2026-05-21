"use client";

import { SUN_SIZE_PX, sunOpacityFromWeather } from "@/lib/weatherSunVisual";
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

export function WeatherSunHero({
  weatherCode,
  temperature,
  label,
  city,
  windText,
  variant = "page",
  className = "",
}: WeatherSunHeroProps) {
  const size = SUN_SIZE_PX[variant];
  const opacity = sunOpacityFromWeather(weatherCode);
  const emoji = weatherCodeEmoji(weatherCode);
  const cloudy = (weatherCode ?? 0) > 3;

  return (
    <div
      className={`weather-hero flex flex-col items-center px-2 text-center ${variant === "page" ? "py-4" : "py-2"} ${className}`}
    >
      <div
        className="weather-sun-2d relative flex items-center justify-center"
        style={{ width: size, height: size, ["--sun-opacity" as string]: String(opacity) }}
        role="img"
        aria-label={label}
      >
        <div className="weather-sun-2d-rays pointer-events-none absolute inset-0 rounded-full" aria-hidden />
        <div className="weather-sun-2d-disc pointer-events-none relative flex items-center justify-center rounded-full">
          <span className="weather-sun-2d-emoji select-none leading-none" aria-hidden>
            {emoji}
          </span>
        </div>
        {cloudy ? (
          <div className="weather-sun-2d-cloud pointer-events-none absolute inset-x-0 top-[8%] h-[38%]" aria-hidden />
        ) : null}
      </div>

      <p className={`mt-3 text-sm ${variant === "story" ? "text-sky-100/90" : "theme-muted text-slate-300"}`}>{city}</p>
      <p className={`mt-1 font-bold tracking-tight text-white ${variant === "story" ? "text-5xl" : "text-4xl"}`}>
        {temperature == null ? "—" : `${Math.round(temperature)}°`}
        <span className={`font-semibold text-amber-200/90 ${variant === "story" ? "text-2xl" : "text-2xl"}`}>C</span>
      </p>
      <p className={`mt-2 max-w-xs text-sm font-medium ${variant === "story" ? "text-white" : "text-slate-200"}`}>{label}</p>
      <p className={`mt-1 text-xs ${variant === "story" ? "text-sky-100/85" : "theme-muted text-slate-400"}`}>{windText}</p>
    </div>
  );
}
