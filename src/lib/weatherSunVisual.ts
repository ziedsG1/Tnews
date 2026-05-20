/** Shared sun / heat intensity from WMO code + temperature (°C). */
export function sunGlowFromWeather(weatherCode: number | null): number {
  if (weatherCode == null) return 0.85;
  if (weatherCode <= 1) return 1;
  if (weatherCode <= 3) return 0.72;
  if (weatherCode === 45 || weatherCode === 48) return 0.45;
  if (weatherCode >= 61 && weatherCode <= 82) return 0.35;
  if (weatherCode >= 71 && weatherCode <= 77) return 0.3;
  return 0.55;
}

export function heatIntensity(weatherCode: number | null, temperatureC: number | null): number {
  let heat = sunGlowFromWeather(weatherCode);
  if (temperatureC != null) {
    if (temperatureC >= 38) heat = Math.min(1, heat + 0.35);
    else if (temperatureC >= 32) heat = Math.min(1, heat + 0.22);
    else if (temperatureC >= 28) heat = Math.min(1, heat + 0.12);
    else if (temperatureC <= 12) heat *= 0.55;
    else if (temperatureC <= 5) heat *= 0.25;
  }
  return Math.max(0, Math.min(1, heat));
}

export function showHeatShimmer(heat: number): boolean {
  return heat >= 0.45;
}

export function isHotSky(heat: number): boolean {
  return heat >= 0.7;
}
