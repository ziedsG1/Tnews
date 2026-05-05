import { NextResponse } from "next/server";
import { DEFAULT_FEEDS } from "@/lib/feeds";
import { aggregateFromFeeds } from "@/lib/aggregateNews";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await aggregateFromFeeds(DEFAULT_FEEDS);
  return NextResponse.json(result);
}
