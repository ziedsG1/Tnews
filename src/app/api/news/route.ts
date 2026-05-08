import { NextResponse } from "next/server";
import { getCountry } from "@/lib/countries";
import { aggregateFromFeeds } from "@/lib/aggregateNews";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = getCountry(url.searchParams.get("country"));
  const result = await aggregateFromFeeds(country.feeds);
  return NextResponse.json(result);
}
