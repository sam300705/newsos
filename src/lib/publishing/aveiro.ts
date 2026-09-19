import "server-only";
import { getOptionalIntegrationEnv } from "@/config/env";
import type { DraftArticleInput, ExternalDraft, PublishingAdapter } from "@/lib/publishing/adapter";

export class AveiroPublishingAdapter implements PublishingAdapter {
  private readonly base: string;
  private readonly token: string;
  private readonly siteId: string;
  constructor(config = getOptionalIntegrationEnv()) {
    if (!config.aveiroApiToken || !config.aveiroSiteId) throw new Error("AVEIRO_API_TOKEN / AVEIRO_SITE_ID are not configured");
    this.base = config.aveiroApiBaseUrl.replace(/\/$/, "");
    this.token = config.aveiroApiToken;
    this.siteId = config.aveiroSiteId;
  }

  private async request<T>(path: string, init: RequestInit = {}, idempotencyKey?: string): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    headers.set("Content-Type", "application/json");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    const response = await fetch(`${this.base}${path}`, { ...init, headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Aveiro API ${path} failed with HTTP ${response.status}: ${(await response.text()).slice(0,500)}`);
    return response.json() as Promise<T>;
  }

  async createDraft(input: DraftArticleInput): Promise<ExternalDraft> {
    const path = `/news/${input.slug}.mdx`;
    const raw = await this.request<any>(`/sites/${this.siteId}/pages`, { method: "POST", body: JSON.stringify({ path, content: input.mdx, metadata: { title: input.title, summary: input.summary, ...input.metadata } }) }, `news:${input.slug}`);
    return { id: String(raw.id ?? raw.content_id ?? raw.contentId), path, editorUrl: raw.editor_url ?? raw.editorUrl, raw };
  }

  async updateDraft(externalId: string, input: DraftArticleInput): Promise<ExternalDraft> {
    const raw = await this.request<any>(`/sites/${this.siteId}/pages/${encodeURIComponent(externalId)}`, { method: "PATCH", body: JSON.stringify({ content: input.mdx, metadata: { title: input.title, summary: input.summary, ...input.metadata } }) }, `news:${input.slug}:update`);
    return { id: externalId, path: raw.path, editorUrl: raw.editor_url ?? raw.editorUrl, raw };
  }
  getChanges() { return this.request(`/sites/${this.siteId}/changes`); }
  publishSite() { return this.request(`/sites/${this.siteId}/publish`, { method: "POST", body: "{}" }, `publish:${this.siteId}`); }
  createNewsletterDraft(input: { subject: string; previewText?: string; html: string; idempotencyKey?: string }) { return this.request(`/campaigns`, { method: "POST", body: JSON.stringify({ subject: input.subject, preview_text: input.previewText, html: input.html }) }, input.idempotencyKey ?? `campaign:${input.subject}`); }
  createSocialDraft(input: { text: string; accountIds?: string[]; idempotencyKey?: string }) { return this.request(`/social/posts`, { method: "POST", body: JSON.stringify({ text: input.text, account_ids: input.accountIds }) }, input.idempotencyKey ?? `social:${input.text.slice(0,80)}`); }
}
