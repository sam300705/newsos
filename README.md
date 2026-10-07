# NewsOS

NewsOS is a trust-first technology and business news intelligence platform. Its canonical unit is a structured **story record** backed by source documents, atomic claims, evidence, provenance, confidence, corrections, and publication history. Generated articles are outputs of that record, not the source of truth.

## What it does

NewsOS can discover public reporting through RSS and Tavily, normalize and deduplicate URLs, cluster multiple reports into one story, score newsworthiness, identify primary evidence, extract and verify atomic claims, generate a source-constrained draft, run deterministic publication gates, route work through an editorial newsroom, publish to the first-party Next.js site, and optionally create Aveiro page/newsletter/social drafts.

## Trust model

- Source content is untrusted data, never instruction.
- Important facts are represented as atomic claims linked to supporting or contradicting evidence.
- Article citations are created from verified claim evidence rather than arbitrary source lists.
- Deterministic gates own publication eligibility, confidence aggregation, URL safety, automation policy, and authorization.
- High-risk categories such as politics/elections, legal, health, high-impact finance, and major cybersecurity incidents require human review.
- Significant corrections create history instead of silently replacing published facts.

## Stack

- Next.js 16 / React 19 / TypeScript
- Supabase Auth + PostgreSQL + RLS as canonical storage
- pgvector for optional semantic clustering
- Tavily Search / Extract / Crawl / Research
- Provider-neutral OpenAI-compatible LLM adapter
- Aveiro as an optional outbound publishing/distribution adapter
- Vercel-compatible worker cron and deployment configuration

## Architecture

```text
RSS / Tavily / watchlists
          ↓
     discovery URLs
          ↓
 extraction + canonicalization
          ↓
 dedupe / story clustering
          ↓
 newsworthiness + entities + primary-source detection
          ↓
 claims → evidence → contradictions → confidence
          ↓
 source-constrained article draft
          ↓
 deterministic publication gate
          ↓
 editorial review / shadow autonomy / controlled autonomy
          ↓
 canonical Supabase article + versions + corrections
          ↓
 Next.js public site / RSS / news sitemap / Aveiro drafts
```

See `docs/architecture/pipeline.md` and `ARCHITECTURE.md` for details.

## Project structure

- `src/app` — public site, admin newsroom, API and cron entrypoints.
- `src/core` — deterministic domain rules: URL safety, dedupe, confidence, publication gate, autonomy, budget, analytics bounds.
- `src/lib/jobs` — durable job orchestration and worker handlers.
- `src/lib/db` — canonical Supabase repositories.
- `src/lib/ai` — model and versioned-prompt adapters.
- `src/lib/tavily` — Tavily integration.
- `src/lib/publishing` — replaceable outbound adapters such as Aveiro.
- `supabase/migrations` — schema, RLS, RPCs, seeds and hardening.
- `tests/offline` — dependency-free trust/security/regression contracts runnable with Node 22.

## Local development

1. Copy `.env.example` to `.env.local` and configure a **dedicated NewsOS Supabase project**. Never point NewsOS migrations at CourseOS.
2. Use Node 22.16.0 and npm 10.9.2 for the release gate. The dependency lockfile is committed.
3. Install from it with `npm ci`; do not regenerate it during verification.
4. Apply Supabase migrations to the dedicated project.
5. Run the verification sequence below.
6. Start with `npm run dev`.

## Environment variables

Public values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_PUBLISHER_NAME` (required before public launch for publisher transparency)
- `NEXT_PUBLIC_CONTACT_EMAIL` (required before public launch)

Server-only values:

- `SUPABASE_SECRET_KEY`
- `TAVILY_API_KEY`
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_EMBEDDING_MODEL`
- `AVEIRO_API_BASE_URL`, `AVEIRO_API_TOKEN`, `AVEIRO_SITE_ID`
- `CRON_SECRET`

Optional pricing variables are documented in `.env.example`. Set them to current provider-account pricing; NewsOS intentionally does not invent rates.

## Worker model

Jobs are stored in `job_runs`, claimed atomically using `FOR UPDATE SKIP LOCKED`, retried with bounded backoff, and moved to a dead-letter state after exhaustion. Scheduled RSS/watchlist/publication work is created by `/api/cron/run`; the endpoint requires `CRON_SECRET`.

A global pause stops automated work. Explicit manual newsroom jobs remain auditable and can be processed independently. Feature flags control ingestion, research, generation, Aveiro, newsletter/social drafts, and auto-publishing.

## Editorial roles

- `OWNER` — full control.
- `ADMIN` — global operational/configuration control.
- `EDITOR` — editorial and source workflows.
- `REVIEWER` — review visibility and permitted review actions.
- ordinary authenticated users — personalization only, governed by ownership RLS.

Authorization never relies on user-editable metadata.

## Tavily

Tavily Search is used for discovery/corroboration, Extract for accessible source content, Crawl for selected watchlists, and Research only when deeper investigation is justified. Usage is recorded. Provider pricing can be configured for budget accounting.

## AI model abstraction

`OpenAICompatibleProvider` isolates the application from one model vendor. Critical prompts are versioned in PostgreSQL. Source-derived text is explicitly treated as untrusted data. The current adapter parses JSON and uses downstream evidence/publication checks; runtime output schemas and complete evidence validation remain later-phase work.

## Aveiro

Aveiro is a replaceable distribution adapter. Supabase remains canonical. Page/newsletter/social draft retries use idempotency semantics, and adapter failures leave the canonical article intact while the job system records and retries the failure.

## Testing and verification

Dependency-free trust suite:

```bash
npm run verify:offline
```

Full required gate after dependencies are available:

```bash
npm ci
npm run verify:offline
npm run typecheck
npm run lint
npm run test:run
npm run build
```

No production-ready claim should be made unless the relevant command has fresh exit-code-0 evidence. See `docs/testing/final-verification.md`.

## CI

GitHub Actions verifies the event checkout using the committed lockfile, then offline contracts, typecheck, lint, Vitest and build. PRs verify GitHub's merge candidate; the summary records its SHA and the PR head SHA. Push/manual runs verify the selected event commit. CI has read-only repository permissions, never commits/rebases/pushes, and includes lockfile-only changes. See `docs/testing/phase-1-reproducibility.md` for branch integration and evidence.

## Deployment

Deploy a preview only after local/CI verification and a dedicated Supabase project are ready. Configure all secrets in Vercel, never in git. Smoke-test public and admin routes, cron authentication, live RLS, one full story, Tavily, and Aveiro draft idempotency before production.

## Security and editorial safety

See `SECURITY.md`, `EDITORIAL_POLICY.md`, `SOURCE_POLICY.md`, and `docs/security/rls-matrix.md`. The platform blocks private/reserved URL targets, manually validates redirects, sanitizes bounded analytics metadata, constrains Ask-the-News to verified evidence, and keeps service credentials server-only.

## Current status

The substantial application is on `feat/phases-1-16`; `main` contains bootstrap material. Phase 1 establishes reproducible, read-only CI without merging branches. Fresh local verification passed 53 offline tests, 8 Vitest tests, typecheck, lint and build; see `docs/testing/final-verification.md` for exact candidate/runtime evidence and limits.

Historical live Supabase claims (45 tables with RLS, zero security-advisor findings) have not been reverified with the current connected account. The observed Netlify URL returned 404 and its smoke run failed. Live Auth/RLS, provider acceptance, browser E2E, evidence correctness, worker recovery, cost containment and deployment acceptance remain release gates. Auto-publish should remain off.

## Database verification (Phase 2)

Run `npm run test:db` for fresh disposable migration/RLS/grant tests and `npm run db:types:check` for catalog type drift. Full Supabase replay runs separately in CI using Docker and shared SQL assertions. Public citations use a bounded published-only metadata RPC; raw documents stay staff-only. See `docs/testing/phase-2-database.md` for evidence limits and setup.
