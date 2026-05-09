/** Same-origin proxy so share capture can rasterize the source photo without a tainted canvas. */
export function proxiedArticleImageUrl(remoteUrl: string | null | undefined): string | null {
  if (!remoteUrl?.trim()) return null;
  const trimmed = remoteUrl.trim();
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".local")) return null;
    if (trimmed.length > 2048) return null;
    return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
  } catch {
    return null;
  }
}
