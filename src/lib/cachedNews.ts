import { unstable_cache } from "next/cache";
import { aggregateFromFeeds, type AggregateResult } from "@/lib/aggregateNews";
import { getCountry, type CountryId, type UiLang } from "@/lib/countries";
import { translateArticlesForUi } from "@/lib/translate";

export type NewsPayload = AggregateResult;

/** RSS aggregation is slow; cache per country. */
const CACHE_RSS_SECONDS = 300;

/** Translation is slower; cache per country + UI language. */
const CACHE_FULL_SECONDS = 300;

async function aggregateForCountry(countryId: CountryId): Promise<AggregateResult> {
  const country = getCountry(countryId);
  return aggregateFromFeeds(country.feeds);
}

const cachedAggregate = unstable_cache(
  async (countryId: CountryId) => aggregateForCountry(countryId),
  ["news-aggregate"],
  { revalidate: CACHE_RSS_SECONDS, tags: ["news"] },
);

const cachedPayload = unstable_cache(
  async (countryId: CountryId, uiLang: UiLang): Promise<NewsPayload> => {
    const result = await cachedAggregate(countryId);
    const articles = await translateArticlesForUi(result.articles, uiLang);
    return { ...result, articles };
  },
  ["news-payload"],
  { revalidate: CACHE_FULL_SECONDS, tags: ["news"] },
);

export async function getCachedNewsPayload(countryId: CountryId, uiLang: UiLang): Promise<NewsPayload> {
  return cachedPayload(countryId, uiLang);
}
