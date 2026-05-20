"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { UiLang } from "@/lib/countries";
import {
  facebookFeedShareUrl,
  inAppBrowserLikely,
  shareStoryVideoBlobViaSheetOrFallback,
  slugFilename,
} from "@/lib/shareStoryCapture";
import { recordWeatherStoryVideo, weatherVideoExtension } from "@/lib/shareWeatherVideo";
import { WeatherSunHero } from "@/components/WeatherSunHero";
import type { ThemeMode } from "@/lib/uiTheme";
import { weatherCodeEmoji, weatherCodeLabel } from "@/lib/weather";

type WeatherSharePayload = {
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

type WeatherShareLabels = {
  title: string;
  subtitle: string;
  close: string;
  facebook: string;
  facebookBusy: string;
  instagram: string;
  instagramBusy: string;
  igFail: string;
  igFailInApp: string;
  igTabHint: string;
  igOpenedTabNote: string;
  igInlineHint: string;
  wind: string;
  previewNote: string;
};

const WEATHER_VIDEO_MS = 7000;

const WEATHER_LABELS: Record<"ar" | "fr" | "en", WeatherShareLabels> = {
  ar: {
    title: "مشاركة الطقس",
    subtitle: "فيديو قصة ٩:١٦ (~٧ ثوانٍ) مع شمس متحركة — فيسبوك أو إنستغرام من ورقة المشاركة.",
    close: "إغلاق",
    facebook: "فيسبوك — فيديو القصة",
    facebookBusy: "جاري تجهيز الفيديو…",
    instagram: "إنستغرام — فيديو القصة",
    instagramBusy: "جاري تجهيز الفيديو…",
    igFail:
      "تعذر إنشاء الفيديو. جرّب سافاري أو كروم، أو حدّث الصفحة. إن كنت داخل تطبيق إنستغرام/فيسبوك، افتح الرابط في المتصفح الكامل.",
    igFailInApp:
      "تسجيل الفيديو لا يعمل داخل تطبيق إنستغرام أو فيسبوك. افتح الموقع في Safari أو Chrome ثم أعد المحاولة.",
    igTabHint:
      "اضغط مطولاً على الفيديو ثم احفظه، أو استخدم «تنزيل». ثم في إنستغرام أنشئ قصة وأضف الفيديو من المعرض.",
    igOpenedTabNote: "تم فتح تبويب بالفيديو — اتبع التعليمات هناك لإضافته إلى قصتك.",
    igInlineHint:
      "لم يُفتح تبويب جديد. استخدم الفيديو أدناه: اضغط مطوّلاً ثم احفظه، ثم أضفه إلى قصتك من تطبيق إنستغرام.",
    wind: "الرياح",
    previewNote: "معاينة التصميم — الفيديو المُشارَك يعرض الشمس متحركة ~٧ ثوانٍ",
  },
  fr: {
    title: "Partager la météo",
    subtitle: "Vidéo story 9:16 (~7 s) avec soleil animé — Facebook ou Instagram via la feuille de partage.",
    close: "Fermer",
    facebook: "Facebook — vidéo story",
    facebookBusy: "Préparation de la vidéo…",
    instagram: "Instagram — vidéo story",
    instagramBusy: "Préparation de la vidéo…",
    igFail:
      "Impossible de créer la vidéo. Essayez Safari ou Chrome, ou rechargez. Si vous êtes dans l’app Instagram/Facebook, ouvrez le lien dans le navigateur du téléphone.",
    igFailInApp:
      "L’enregistrement vidéo ne fonctionne pas dans l’application Instagram ou Facebook. Ouvrez le site dans Safari ou Chrome, puis réessayez.",
    igTabHint:
      "Appui long sur la vidéo pour l’enregistrer, ou « Télécharger ». Puis dans Instagram, créez une story et ajoutez la vidéo depuis la galerie.",
    igOpenedTabNote: "Un onglet avec la vidéo est ouvert — suivez les instructions pour votre story.",
    igInlineHint:
      "Impossible d’ouvrir un nouvel onglet. Utilisez la vidéo ci-dessous : enregistrez-la, puis ajoutez-la à votre story Instagram.",
    wind: "Vent",
    previewNote: "Aperçu statique — la vidéo partagée anime le soleil (~7 s)",
  },
  en: {
    title: "Share weather",
    subtitle: "9:16 story video (~7 s) with animated sun — pick Facebook or Instagram in the share sheet.",
    close: "Close",
    facebook: "Facebook — story video",
    facebookBusy: "Preparing video…",
    instagram: "Instagram — story video",
    instagramBusy: "Preparing video…",
    igFail:
      "Could not create the video. Try Safari or Chrome, or reload. If you are inside the Instagram or Facebook app, open this site in the phone browser.",
    igFailInApp:
      "Video recording does not work inside the Instagram or Facebook app. Open the site in Safari or Chrome, then try again.",
    igTabHint:
      "Long-press the video to save it, or use Download. Then in the Instagram app, start a story and pick the video from your gallery.",
    igOpenedTabNote: "A new tab has the video — follow the steps there to add it to your story.",
    igInlineHint:
      "A new tab could not open. Use the video below: save it, then add it to your Instagram story from Photos.",
    wind: "Wind",
    previewNote: "Static preview — shared video animates the sun for ~7 seconds",
  },
};

const btnFb =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110";
const btnIg =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134AF] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110";

function shareWeatherTitle(weather: WeatherSharePayload, uiLang: UiLang): string {
  return `${weather.city} — ${weatherCodeLabel(weather.current.weatherCode, uiLang)}`;
}

function shareWeatherFilename(weather: WeatherSharePayload, mime: string): string {
  const ext = weatherVideoExtension(mime);
  return `${slugFilename(`${weather.city}-${weather.countryId}-weather`)}.${ext}`;
}

function WeatherStoryPreview({
  weather,
  siteLabel,
  countryName,
  uiLang,
}: {
  weather: WeatherSharePayload;
  siteLabel: string;
  countryName: string;
  uiLang: UiLang;
}) {
  const rtl = uiLang === "ar";
  const loc = uiLang === "ar" ? "ar" : "fr-TN";
  const condition = weatherCodeLabel(weather.current.weatherCode, uiLang);
  const days = weather.daily.slice(0, 5);
  const windLabel = WEATHER_LABELS[uiLang].wind;
  const windText = `${windLabel}: ${weather.current.windSpeed == null ? "—" : `${Math.round(weather.current.windSpeed)} km/h`}`;

  return (
    <div
      className="relative flex h-[640px] w-[360px] flex-col overflow-hidden bg-gradient-to-br from-sky-950/95 via-amber-950/25 to-indigo-950/90 text-white"
      dir={rtl ? "rtl" : "ltr"}
      lang={uiLang === "ar" ? "ar" : uiLang === "fr" ? "fr" : "en"}
    >
      <div className="relative z-[1] flex flex-1 flex-col px-4 pb-4 pt-5">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-sky-200/90">{siteLabel}</p>
        <p className="text-center text-[11px] font-semibold text-slate-200/90">{countryName}</p>
        <div className="flex flex-1 flex-col justify-center">
          <WeatherSunHero
            variant="story"
            interactive={false}
            weatherCode={weather.current.weatherCode}
            temperature={weather.current.temperature}
            label={condition}
            city={weather.city}
            windText={windText}
            className="py-0"
          />
        </div>
        <div className="mt-auto space-y-1.5 border-t border-white/15 pt-3">
          {days.map((d) => (
            <div
              key={d.date}
              className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-1.5 text-[12px]"
            >
              <span className="text-sky-100/80">
                {new Date(d.date).toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span aria-hidden>{weatherCodeEmoji(d.weatherCode)}</span>
                <span className="max-w-[9rem] truncate text-[11px] font-medium text-white/95">
                  {weatherCodeLabel(d.weatherCode, uiLang)}
                </span>
              </span>
              <span className="shrink-0 text-sky-50/95">
                {d.max == null ? "—" : `${Math.round(d.max)}°`}/{d.min == null ? "—" : `${Math.round(d.min)}°`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShareWeatherDialog({
  weather,
  siteLabel,
  countryName,
  uiLang,
  weatherPageUrl,
  onClose,
}: {
  weather: WeatherSharePayload;
  siteLabel: string;
  countryName: string;
  captureTheme: ThemeMode;
  uiLang: "ar" | "fr" | "en";
  weatherPageUrl: string;
  onClose: () => void;
}) {
  const labels = WEATHER_LABELS[uiLang];
  const [igBusy, setIgBusy] = useState(false);
  const [igTabNote, setIgTabNote] = useState(false);
  const [igErr, setIgErr] = useState<string | null>(null);
  const [fbBusy, setFbBusy] = useState(false);
  const [fbTabNote, setFbTabNote] = useState(false);
  const [fbErr, setFbErr] = useState<string | null>(null);
  const [fbInlineVideoUrl, setFbInlineVideoUrl] = useState<string | null>(null);
  const [inlineVideoUrl, setInlineVideoUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const previewRevokeRef = useRef<string | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    videoBlobRef.current = null;
    void recordWeatherStoryVideo(weather, siteLabel, countryName, uiLang, WEATHER_VIDEO_MS).then((blob) => {
      if (cancelled) return;
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current);
        previewRevokeRef.current = null;
      }
      videoBlobRef.current = blob;
      if (blob) {
        const url = URL.createObjectURL(blob);
        previewRevokeRef.current = url;
        setPreviewVideoUrl(url);
      }
      setPreviewLoading(false);
    });
    return () => {
      cancelled = true;
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current);
        previewRevokeRef.current = null;
      }
      videoBlobRef.current = null;
    };
  }, [weather, siteLabel, countryName, uiLang]);

  useEffect(() => {
    return () => {
      if (inlineVideoUrl) URL.revokeObjectURL(inlineVideoUrl);
      if (fbInlineVideoUrl) URL.revokeObjectURL(fbInlineVideoUrl);
    };
  }, [inlineVideoUrl, fbInlineVideoUrl]);

  const shareMeta = useCallback(
    (mime: string) => ({
      title: shareWeatherTitle(weather, uiLang),
      filename: shareWeatherFilename(weather, mime),
    }),
    [weather, uiLang],
  );

  const getShareVideoBlob = useCallback(async () => {
    if (videoBlobRef.current) return videoBlobRef.current;
    const blob = await recordWeatherStoryVideo(weather, siteLabel, countryName, uiLang, WEATHER_VIDEO_MS);
    if (blob) videoBlobRef.current = blob;
    return blob;
  }, [weather, siteLabel, countryName, uiLang]);

  const runFacebookShare = useCallback(async () => {
    setIgErr(null);
    setIgTabNote(false);
    setInlineVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFbErr(null);
    setFbTabNote(false);
    setFbInlineVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFbBusy(true);
    try {
      const blob = await getShareVideoBlob();
      if (!blob) {
        setFbErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
        window.open(facebookFeedShareUrl(weatherPageUrl), "_blank", "noopener,noreferrer");
        return;
      }
      const outcome = await shareStoryVideoBlobViaSheetOrFallback(blob, shareMeta(blob.type));
      if (outcome.kind === "tab") {
        setFbTabNote(true);
      } else if (outcome.kind === "inline") {
        setFbInlineVideoUrl(URL.createObjectURL(outcome.blob));
      }
    } catch {
      setFbErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
      window.open(facebookFeedShareUrl(weatherPageUrl), "_blank", "noopener,noreferrer");
    } finally {
      setFbBusy(false);
    }
  }, [getShareVideoBlob, labels.igFail, labels.igFailInApp, shareMeta, weatherPageUrl]);

  const runInstagramShare = useCallback(async () => {
    setFbErr(null);
    setFbTabNote(false);
    setFbInlineVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIgErr(null);
    setIgTabNote(false);
    setInlineVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIgBusy(true);
    try {
      const blob = await getShareVideoBlob();
      if (!blob) {
        setIgErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
        return;
      }
      const outcome = await shareStoryVideoBlobViaSheetOrFallback(blob, shareMeta(blob.type));
      if (outcome.kind === "tab") {
        setIgTabNote(true);
      } else if (outcome.kind === "inline") {
        setInlineVideoUrl(URL.createObjectURL(outcome.blob));
      }
    } catch {
      setIgErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
    } finally {
      setIgBusy(false);
    }
  }, [getShareVideoBlob, labels.igFail, labels.igFailInApp, shareMeta]);

  const busy = fbBusy || igBusy;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-weather-dialog-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={labels.close} onClick={onClose} />
      <div
        className="theme-panel relative z-[1] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="share-weather-dialog-title" className="theme-headline text-lg font-semibold">
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

        <div className="max-h-[42vh] min-h-[220px] overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {previewLoading ? (
            <p className="theme-muted flex h-[220px] items-center justify-center text-sm">…</p>
          ) : previewVideoUrl ? (
            <video
              src={previewVideoUrl}
              className="mx-auto max-h-[42vh] w-full object-contain"
              autoPlay
              loop
              muted
              playsInline
              controls
            />
          ) : (
            <div className="flex justify-center overflow-hidden" style={{ height: 220 }}>
              <div
                className="shrink-0"
                style={{ transform: "scale(0.34)", transformOrigin: "top center", width: 360, height: 640 }}
                aria-hidden
              >
                <WeatherStoryPreview
                  weather={weather}
                  siteLabel={siteLabel}
                  countryName={countryName}
                  uiLang={uiLang}
                />
              </div>
            </div>
          )}
        </div>
        <p className="theme-muted mt-1.5 text-center text-[10px]">{labels.previewNote}</p>

        <div className="relative z-10 mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || previewLoading}
            className={`${btnFb} disabled:opacity-50`}
            onClick={() => void runFacebookShare()}
          >
            {fbBusy ? labels.facebookBusy : labels.facebook}
          </button>
          <button
            type="button"
            disabled={busy || previewLoading}
            className={`${btnIg} disabled:opacity-50`}
            onClick={() => void runInstagramShare()}
          >
            {igBusy ? labels.instagramBusy : labels.instagram}
          </button>
        </div>
        {igErr ? <p className="mt-2 text-center text-sm text-red-400">{igErr}</p> : null}
        {fbErr ? <p className="mt-2 text-center text-sm text-red-400">{fbErr}</p> : null}
        {igTabNote && !inlineVideoUrl ? (
          <p className="mt-2 text-center text-sm text-emerald-300/95">{labels.igOpenedTabNote}</p>
        ) : null}
        {fbTabNote && !fbInlineVideoUrl ? (
          <p className="mt-2 text-center text-sm text-emerald-300/95">{labels.igOpenedTabNote}</p>
        ) : null}
        {inlineVideoUrl ? (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-400/30 bg-black/40 p-3">
            <p className="text-center text-sm font-medium text-amber-100/95">{labels.igInlineHint}</p>
            <video
              src={inlineVideoUrl}
              className="mx-auto max-h-[min(65vh,560px)] max-w-full rounded-lg border border-white/15"
              controls
              playsInline
              autoPlay
              loop
              muted
            />
            <p className="theme-muted text-center text-[11px] leading-snug text-slate-400">{labels.igTabHint}</p>
          </div>
        ) : null}
        {fbInlineVideoUrl ? (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-400/30 bg-black/40 p-3">
            <p className="text-center text-sm font-medium text-amber-100/95">{labels.igInlineHint}</p>
            <video
              src={fbInlineVideoUrl}
              className="mx-auto max-h-[min(65vh,560px)] max-w-full rounded-lg border border-white/15"
              controls
              playsInline
              autoPlay
              loop
              muted
            />
            <p className="theme-muted text-center text-[11px] leading-snug text-slate-400">{labels.igTabHint}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
