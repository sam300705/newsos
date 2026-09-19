import "server-only";
import { getOptionalIntegrationEnv } from "@/config/env";
import { assertSafePublicUrl } from "@/core/url";

export interface TavilySearchResult { title: string; url: string; content?: string; score?: number; }

export class TavilyClient {
  private readonly apiKey: string;
  constructor(apiKey = getOptionalIntegrationEnv().tavilyApiKey) {
    if (!apiKey) throw new Error("TAVILY_API_KEY is not configured");
    this.apiKey = apiKey;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const started = Date.now();
    const response = await fetch(`https://api.tavily.com${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Tavily ${path} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const result = await response.json() as T;
    void started;
    return result;
  }

  async search(query: string, options: { maxResults?: number; includeDomains?: string[]; excludeDomains?: string[] } = {}) {
    const data = await this.post<{ results?: TavilySearchResult[] }>("/search", { query, search_depth: "advanced", max_results: options.maxResults ?? 8, include_domains: options.includeDomains, exclude_domains: options.excludeDomains, include_raw_content: false });
    return (data.results ?? []).filter((result) => { try { assertSafePublicUrl(result.url); return true; } catch { return false; } });
  }

  async extract(urls: string[]) {
    const safe = urls.map((url) => assertSafePublicUrl(url).toString());
    return this.post<{ results?: Array<{ url: string; raw_content?: string; images?: string[] }> }>("/extract", { urls: safe, extract_depth: "advanced", format: "markdown", include_images: false });
  }

  async research(query: string) {
    return this.post<Record<string, unknown>>("/research", { query, model: "pro" });
  }

  async crawl(url: string, instructions?: string) {
    const safe = assertSafePublicUrl(url).toString();
    return this.post<{ results?: Array<{ url: string; raw_content?: string; title?: string }> }>("/crawl", { url: safe, max_depth: 1, max_breadth: 20, limit: 50, extract_depth: "basic", format: "markdown", allow_external: false, instructions: instructions || undefined });
  }
}

