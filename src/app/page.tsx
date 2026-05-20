import { headers } from "next/headers";
import { HomeClient } from "@/components/HomeClient";
import { getCachedNewsPayload } from "@/lib/cachedNews";
import { countryIdFromRequestHeaders } from "@/lib/defaultCountry";
import { getCountry, type UiLang } from "@/lib/countries";

export const revalidate = 300;

export default async function Page() {
  const headerStore = await headers();
  const initialCountry = countryIdFromRequestHeaders(headerStore);
  const country = getCountry(initialCountry);
  const initialUiLang: UiLang = country.primaryLocale === "ar" ? "ar" : "fr";
  const initialNews = await getCachedNewsPayload(initialCountry, initialUiLang);
  return (
    <HomeClient initialNews={initialNews} initialCountry={initialCountry} initialUiLang={initialUiLang} />
  );
}
