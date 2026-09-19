import "server-only";
import { fetchPublicResource } from "@/lib/security/network";
import { parseFeed } from "@/lib/rss/parser";

export async function fetchFeed(url: string, validators?: { etag?: string | null; lastModified?: string | null }) {
  const headers = new Headers({ "User-Agent": "NewsOS/1.0 (+news intelligence feed fetcher)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" });
  if (validators?.etag) headers.set("If-None-Match", validators.etag);
  if (validators?.lastModified) headers.set("If-Modified-Since", validators.lastModified);
  const response = await fetchPublicResource(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status === 304) return { status: 304, items: [], etag: validators?.etag ?? null, lastModified: validators?.lastModified ?? null };
  if (!response.ok) throw new Error(`Feed fetch failed with HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error("Feed exceeded 5 MB safety limit");
  return { status: response.status, items: parseFeed(body), etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
}
