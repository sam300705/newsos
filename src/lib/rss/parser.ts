import { XMLParser } from "fast-xml-parser";
import { normalizeUrl, stableHash } from "@/core/url";

export interface FeedItem {
  title: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  publishedAt?: string;
  author?: string;
  summary?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
const arr = <T>(value: T | T[] | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "#text" in value) return String((value as Record<string, unknown>)["#text"]).trim();
  return undefined;
};

function atomLink(entry: Record<string, unknown>): string | undefined {
  for (const link of arr(entry.link as Record<string, unknown> | Array<Record<string, unknown>> | undefined)) {
    const href = link?.["@_href"];
    const rel = link?.["@_rel"];
    if (typeof href === "string" && (rel == null || rel === "alternate")) return href;
  }
  return undefined;
}

export function parseFeed(xml: string): FeedItem[] {
  const root = parser.parse(xml) as Record<string, any>;
  const rssItems = arr(root?.rss?.channel?.item);
  const atomItems = arr(root?.feed?.entry);
  const rawItems = rssItems.length ? rssItems : atomItems;
  const results: FeedItem[] = [];
  for (const item of rawItems) {
    const rawUrl = text(item.link) ?? atomLink(item) ?? text(item.guid) ?? text(item.id);
    const title = text(item.title);
    if (!rawUrl || !title) continue;
    try {
      const normalizedUrl = normalizeUrl(rawUrl);
      const publishedAt = text(item.pubDate) ?? text(item.published) ?? text(item.updated);
      results.push({
        title,
        url: rawUrl,
        normalizedUrl,
        urlHash: stableHash(normalizedUrl),
        publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : undefined,
        author: text(item.author) ?? text(item["dc:creator"]),
        summary: text(item.description) ?? text(item.summary) ?? text(item.content),
      });
    } catch {
      // Unsafe or malformed URLs are dropped before persistence.
    }
  }
  return results;
}
