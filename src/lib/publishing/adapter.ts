export interface DraftArticleInput { slug: string; title: string; summary?: string; mdx: string; metadata?: Record<string, unknown>; }
export interface ExternalDraft { id: string; path?: string; editorUrl?: string; raw?: unknown; }

export interface PublishingAdapter {
  createDraft(input: DraftArticleInput): Promise<ExternalDraft>;
  updateDraft(externalId: string, input: DraftArticleInput): Promise<ExternalDraft>;
  getChanges(): Promise<unknown>;
  publishSite(): Promise<unknown>;
  createNewsletterDraft(input: { subject: string; previewText?: string; html: string; idempotencyKey?: string }): Promise<unknown>;
  createSocialDraft(input: { text: string; accountIds?: string[]; idempotencyKey?: string }): Promise<unknown>;
}
