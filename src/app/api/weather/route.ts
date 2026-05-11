import { NextResponse } from "next/server";
import { getCountry } from "@/lib/countries";
import { COUNTRY_WEATHER } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WeatherApiPayload = {
  city: string;
  countryId: string;
  timezone: string;
  current: {
    temperature: number | null;
    windSpeed: number | null;
    weatherCode: number | null;
    time: string | null;
  };
  daily: Array<{
    date: string;
    max: number | null;
    min: number | null;
    weatherCode: number | null;
  }>;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = getCountry(url.searchParams.get("country"));
  const cfg = COUNTRY_WEATHER[country.id];

  const upstream = new URL("https://api.open-meteo.com/v1/forecast");
  upstream.searchParams.set("latitude", String(cfg.latitude));
  upstream.searchParams.set("longitude", String(cfg.longitude));
  upstream.searchParams.set("timezone", cfg.timezone);
  upstream.searchParams.set("forecast_days", "4");
  upstream.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  upstream.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");

  try {
    const res = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "weather_upstream_error", status: res.status }, { status: 502 });
    }
    const json = (await res.json()) as {
      timezone?: string;
      current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number; time?: string };
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; weather_code?: number[] };
    };

    const times = json.daily?.time ?? [];
    const maxs = json.daily?.temperature_2m_max ?? [];
    const mins = json.daily?.temperature_2m_min ?? [];
    const codes = json.daily?.weather_code ?? [];
    const daily = times.slice(0, 4).map((date, i) => ({
      date,
      max: typeof maxs[i] === "number" ? maxs[i] : null,
      min: typeof mins[i] === "number" ? mins[i] : null,
      weatherCode: typeof codes[i] === "number" ? codes[i] : null,
    }));

    const out: WeatherApiPayload = {
      city: cfg.city,
      countryId: country.id,
      timezone: json.timezone ?? cfg.timezone,
      current: {
        temperature: json.current?.temperature_2m ?? null,
        windSpeed: json.current?.wind_speed_10m ?? null,
        weatherCode: json.current?.weather_code ?? null,
        time: json.current?.time ?? null,
      },
      daily,
    };
    return NextResponse.json(out, {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "weather_fetch_failed" }, { status: 502 });
  }
}
