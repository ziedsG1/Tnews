import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_URL_LEN = 2048;
const MAX_BYTES = 6 * 1024 * 1024;

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  return false;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams.get("url");
  if (!sp || sp.length > MAX_URL_LEN) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(sp);
  } catch {
    return NextResponse.json({ error: "parse" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "protocol" }, { status: 400 });
  }
  if (isBlockedHostname(target.hostname)) {
    return NextResponse.json({ error: "host" }, { status: 400 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const upstream = await fetch(target.href, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "TnewsImageProxy/1.0",
      },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream", status: upstream.status }, { status: 502 });
    }

    const ct = upstream.headers.get("content-type") || "";
    if (!ct.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "not_image" }, { status: 415 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct.split(";")[0]!.trim(),
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
