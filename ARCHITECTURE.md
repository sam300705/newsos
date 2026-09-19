# NewsOS Architecture

## System of record

Supabase/PostgreSQL is canonical for sources, source documents, stories, claims, evidence, entities, companies, article drafts/versions/citations, corrections, jobs, usage, personalization, automation decisions, and distribution state. Aveiro is outbound-only and replaceable.

## Shape

NewsOS is a modular monolith with durable database-backed jobs. This minimizes distributed-system failure modes while keeping provider boundaries explicit.

### Public and admin application

Next.js App Router serves public articles/company/topic/search/personalization routes, API endpoints, and the authenticated newsroom. Public reads use publishable-key/RLS clients. Privileged writes use server-only clients and explicit role checks.

### Ingestion

RSS is preferred for known sources. Tavily supports search, extraction, crawl watchlists and selective deep research. Every external URL passes normalization/safety validation. RSS fetching manually follows and revalidates redirects.

### Story intelligence

A source document is attached to a story through deterministic URL/content/title/time signals plus optional embeddings. Story intelligence stores source reputation, entities, newsworthiness and primary-source relationships.

### Claim/provenance layer

Claims are atomic. `claim_evidence` identifies supporting, contradicting and contextual source documents. Article citations are generated from verified claim evidence. Confidence is a deterministic aggregate, not an LLM self-score.

### Editorial/publishing layer

AI produces source-constrained structured drafts. The publication gate checks unsupported surface facts, contradictions, provenance, duplicate state and SEO readiness. Manual edits return a draft to verification. Corrections create version/history records. Scheduled publication reruns the gate when due.

### Automation

`job_runs` is the durable queue. Atomic claiming uses `FOR UPDATE SKIP LOCKED`; retries are bounded and dead-lettered. A global pause and per-capability feature flags govern automated jobs. Shadow autonomy records `WOULD_AUTO_PUBLISH` without publishing. Controlled auto-publish additionally requires approved category/source tier, confidence, complete provenance, no contradiction, quality-gate success, non-high-risk classification and available budget.

### Cost control

Provider usage is recorded. Dollar estimates are only calculated when current provider rates are explicitly configured. At 80% of the daily budget the worker enters `CONSERVE` and defers optional deep research/distribution; at 100% it defers paid automated jobs while RSS remains available.

### Distribution

The first-party Next.js site, RSS feeds, sitemap and News sitemap derive from canonical Supabase data. Aveiro receives drafts through `PublishingAdapter`; its failure cannot erase or mutate the canonical story/article.

## Invariants

1. Source and user-provided corpus text is untrusted data, never agent instruction.
2. Server secrets never enter browser bundles.
3. Every exposed public table has RLS.
4. Privileged RPCs are revoked from anon/authenticated and granted to service-role execution only.
5. High-risk editorial categories require human review.
6. A publication action cannot bypass the deterministic publication gate.
7. Significant corrections retain history.
8. Missing provider pricing is reported as unknown, not silently treated as known zero cost.
