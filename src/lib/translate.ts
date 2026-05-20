import type { NewsArticle } from "./aggregateNews";
import type { UiLang } from "./countries";

const cache = new Map<string, string>();

function mapUiToTargetLang(lang: UiLang): "ar" | "fr" | "en" {
  if (lang === "ar") return "ar";
  if (lang === "en") return "en";
  return "fr";
}

function alreadyInTarget(article: NewsArticle, target: "ar" | "fr" | "en"): boolean {
  if (target === "ar") return article.locale === "ar";
  // We classify non-ar feeds as fr in current model, so fr/en can both need translation.
  if (target === "fr") return article.locale === "fr";
  return false;
}

async function translateText(text: string, target: "ar" | "fr" | "en"): Promise<string> {
  const input = text.trim();
  if (!input) return input;
  const key = `${target}::${input}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(input)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) return input;

  const data = (await res.json()) as unknown;
  // Shape: [[["translated", "original", ...], ...], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) return input;
  const chunks = data[0] as unknown[];
  const translated = chunks
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : ""))
    .join("")
    .trim();

  const out = translated || input;
  cache.set(key, out);
  return out;
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

/** Article ids shown in the home grid (matches HomeClient slice caps). */
function visibleArticleIds(articles: NewsArticle[]): Set<string> {
  const ar = articles.filter((a) => a.locale === "ar").slice(0, 72);
  const fr = articles.filter((a) => a.locale === "fr").slice(0, 48);
  return new Set([...ar, ...fr].map((a) => a.id));
}

/**
 * Translate article titles according to UI language.
 * Only visible grid items are translated to limit external API calls.
 */
export async function translateArticlesForUi(
  articles: NewsArticle[],
  uiLang: UiLang,
): Promise<NewsArticle[]> {
  const target = mapUiToTargetLang(uiLang);
  const visibleIds = visibleArticleIds(articles);

  const toTranslate = articles.filter(
    (a) => visibleIds.has(a.id) && !alreadyInTarget(a, target),
  );

  const translatedById = new Map<string, NewsArticle>();
  const translated = await mapWithLimit(toTranslate, 10, async (article) => {
    try {
      const translatedTitle = await translateText(article.title, target);
      return { ...article, translatedTitle };
    } catch {
      return article;
    }
  });
  for (const a of translated) translatedById.set(a.id, a);

  return articles.map((a) => translatedById.get(a.id) ?? a);
}

