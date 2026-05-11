"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { UiLang } from "@/lib/countries";
import {
  captureSharePreviewAsJpegBlob,
  facebookFeedShareUrl,
  inAppBrowserLikely,
  shareStoryJpegBlobViaSheetOrFallback,
  slugFilename,
} from "@/lib/shareStoryCapture";
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
};

const WEATHER_LABELS: Record<"ar" | "fr" | "en", WeatherShareLabels> = {
  ar: {
    title: "مشاركة الطقس",
    subtitle: "فيسبوك وإنستغرام: صورة قصة ٩:١٦ من بطاقة الطقس. اختر التطبيق من ورقة المشاركة.",
    close: "إغلاق",
    facebook: "فيسبوك — منشور (صورة القصة)",
    facebookBusy: "جاري تجهيز صورة فيسبوك…",
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
    wind: "الرياح",
  },
  fr: {
    title: "Partager la météo",
    subtitle: "Facebook et Instagram : la même image story 9:16 depuis la carte météo. Choisissez l’app dans la feuille de partage.",
    close: "Fermer",
    facebook: "Facebook — publication (image story)",
    facebookBusy: "Préparation de l’image Facebook…",
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
    wind: "Vent",
  },
  en: {
    title: "Share weather",
    subtitle: "Facebook and Instagram use the same 9:16 story image from the weather card. Pick the app in the share sheet.",
    close: "Close",
    facebook: "Facebook — post (story image)",
    facebookBusy: "Preparing Facebook image…",
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
    wind: "Wind",
  },
};

const btnFb =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110";
const btnIg =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134AF] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110";

function shareWeatherFilename(weather: WeatherSharePayload): string {
  return `${slugFilename(`${weather.city}-${weather.countryId}-weather`)}.jpg`;
}

function shareWeatherTitle(weather: WeatherSharePayload, uiLang: UiLang): string {
  return `${weather.city} — ${weatherCodeLabel(weather.current.weatherCode, uiLang)}`;
}

function WeatherStoryCapture({
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
  const emoji = weatherCodeEmoji(weather.current.weatherCode);
  const condition = weatherCodeLabel(weather.current.weatherCode, uiLang);
  const days = weather.daily.slice(0, 5);
  const windLabel = WEATHER_LABELS[uiLang].wind;

  return (
    <div
      className="share-story-capture relative flex h-[640px] w-[360px] flex-col overflow-hidden bg-gradient-to-br from-sky-950 via-cyan-950 to-indigo-950 text-white"
      dir={rtl ? "rtl" : "ltr"}
      lang={uiLang === "ar" ? "ar" : uiLang === "fr" ? "fr" : "en"}
    >
      <div className="pointer-events-none absolute right-0 top-0 text-[140px] leading-none opacity-25" aria-hidden>
        {emoji}
      </div>
      <div className="relative z-[1] flex flex-1 flex-col px-5 pb-5 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-200/90">{siteLabel}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-200/90">{countryName}</p>
        <p className="mt-4 text-sm text-sky-100/90">{weather.city}</p>
        <p className="mt-1 text-[56px] font-black leading-none tracking-tight">
          {weather.current.temperature == null ? "—" : `${Math.round(weather.current.temperature)}°`}
        </p>
        <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-white">
          <span className="text-2xl" aria-hidden>
            {emoji}
          </span>
          <span className="leading-snug">{condition}</span>
        </p>
        <p className="mt-2 text-[12px] text-sky-100/85">
          {windLabel}:{" "}
          {weather.current.windSpeed == null ? "—" : `${Math.round(weather.current.windSpeed)} km/h`}
        </p>
        <div className="mt-auto space-y-1.5 border-t border-white/15 pt-4">
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
  captureTheme,
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
  const storyCaptureRef = useRef<HTMLDivElement>(null);
  const [storyRevealForCapture, setStoryRevealForCapture] = useState(false);
  const [igBusy, setIgBusy] = useState(false);
  const [igTabNote, setIgTabNote] = useState(false);
  const [igErr, setIgErr] = useState<string | null>(null);
  const [fbBusy, setFbBusy] = useState(false);
  const [fbTabNote, setFbTabNote] = useState(false);
  const [fbErr, setFbErr] = useState<string | null>(null);
  const [fbInlineImageUrl, setFbInlineImageUrl] = useState<string | null>(null);
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
      if (fbInlineImageUrl) URL.revokeObjectURL(fbInlineImageUrl);
    };
  }, [inlineImageUrl, fbInlineImageUrl]);

  const compactCapture = narrow || inAppBrowserLikely();

  const shareMeta = useCallback(
    () => ({
      title: shareWeatherTitle(weather, uiLang),
      filename: shareWeatherFilename(weather),
    }),
    [weather, uiLang],
  );

  const runFacebookShare = useCallback(async () => {
    setIgErr(null);
    setIgTabNote(false);
    setInlineImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFbErr(null);
    setFbTabNote(false);
    setFbInlineImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFbBusy(true);
    const meta = shareMeta();
    try {
      flushSync(() => setStoryRevealForCapture(true));
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise<void>((r) => window.setTimeout(() => r(), 320));
      const blob = await captureSharePreviewAsJpegBlob(storyCaptureRef.current, captureTheme, compactCapture);
      if (!blob) {
        setFbErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
        window.open(facebookFeedShareUrl(weatherPageUrl), "_blank", "noopener,noreferrer");
        return;
      }
      const outcome = await shareStoryJpegBlobViaSheetOrFallback(blob, meta);
      if (outcome.kind === "tab") {
        setFbTabNote(true);
      } else if (outcome.kind === "inline") {
        setFbInlineImageUrl(URL.createObjectURL(outcome.blob));
      }
    } catch {
      setFbErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
      window.open(facebookFeedShareUrl(weatherPageUrl), "_blank", "noopener,noreferrer");
    } finally {
      flushSync(() => setStoryRevealForCapture(false));
      setFbBusy(false);
    }
  }, [captureTheme, compactCapture, labels.igFail, labels.igFailInApp, shareMeta, weatherPageUrl]);

  const runInstagramShare = useCallback(async () => {
    setFbErr(null);
    setFbTabNote(false);
    setFbInlineImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIgErr(null);
    setIgTabNote(false);
    setInlineImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIgBusy(true);
    const meta = shareMeta();
    try {
      flushSync(() => setStoryRevealForCapture(true));
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise<void>((r) => window.setTimeout(() => r(), 320));
      const blob = await captureSharePreviewAsJpegBlob(storyCaptureRef.current, captureTheme, compactCapture);
      if (!blob) {
        setIgErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
        return;
      }
      const outcome = await shareStoryJpegBlobViaSheetOrFallback(blob, meta);
      if (outcome.kind === "tab") {
        setIgTabNote(true);
      } else if (outcome.kind === "inline") {
        setInlineImageUrl(URL.createObjectURL(outcome.blob));
      }
    } catch {
      setIgErr(inAppBrowserLikely() ? labels.igFailInApp : labels.igFail);
    } finally {
      flushSync(() => setStoryRevealForCapture(false));
      setIgBusy(false);
    }
  }, [captureTheme, compactCapture, labels.igFail, labels.igFailInApp, shareMeta]);

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={
                storyRevealForCapture
                  ? "fixed inset-0 z-[300] flex items-center justify-center bg-black/80 pointer-events-none"
                  : "pointer-events-none fixed left-[-12000px] top-0 flex h-[640px] w-[360px] overflow-hidden"
              }
              aria-hidden
            >
              <div
                ref={storyCaptureRef}
                data-instagram-story="1"
                data-share-capture-root
                className="relative h-[640px] w-[360px] shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
              >
                <WeatherStoryCapture
                  weather={weather}
                  siteLabel={siteLabel}
                  countryName={countryName}
                  uiLang={uiLang}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
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

          <div className="max-h-[38vh] min-h-[200px] overflow-hidden rounded-lg border border-white/10">
            <div className="flex justify-center overflow-hidden" style={{ height: 280 }}>
              <div
                className="shrink-0"
                style={{ transform: "scale(0.42)", transformOrigin: "top center", width: 360, height: 640 }}
                aria-hidden
              >
                <WeatherStoryCapture
                  weather={weather}
                  siteLabel={siteLabel}
                  countryName={countryName}
                  uiLang={uiLang}
                />
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={fbBusy || igBusy}
              className={`${btnFb} disabled:opacity-50`}
              onClick={() => void runFacebookShare()}
            >
              {fbBusy ? labels.facebookBusy : labels.facebook}
            </button>
            <button
              type="button"
              disabled={igBusy || fbBusy}
              className={`${btnIg} disabled:opacity-50`}
              onClick={() => void runInstagramShare()}
            >
              {igBusy ? labels.instagramBusy : labels.instagram}
            </button>
          </div>
          {igErr ? <p className="mt-2 text-center text-sm text-red-400">{igErr}</p> : null}
          {fbErr ? <p className="mt-2 text-center text-sm text-red-400">{fbErr}</p> : null}
          {igTabNote && !inlineImageUrl ? (
            <p className="mt-2 text-center text-sm text-emerald-300/95">{labels.igOpenedTabNote}</p>
          ) : null}
          {fbTabNote && !fbInlineImageUrl ? (
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
          {fbInlineImageUrl ? (
            <div className="mt-3 space-y-2 rounded-xl border border-amber-400/30 bg-black/40 p-3">
              <p className="text-center text-sm font-medium text-amber-100/95">{labels.igInlineHint}</p>
              <img
                src={fbInlineImageUrl}
                alt=""
                className="mx-auto max-h-[min(65vh,560px)] max-w-full rounded-lg border border-white/15 object-contain"
              />
              <p className="theme-muted text-center text-[11px] leading-snug text-slate-400">{labels.igTabHint}</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
