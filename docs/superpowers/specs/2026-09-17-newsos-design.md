# NewsOS Design

## Purpose
NewsOS is a production-grade AI-assisted business and technology news intelligence platform. The canonical product is a structured story intelligence record; articles, newsletters, social drafts, and Aveiro pages are derived outputs.

## Core architecture
A modular monolith in TypeScript/Next.js backed by PostgreSQL/Supabase. Tavily provides discovery/extraction/research. Deterministic code owns URL normalization, deduplication, confidence calculations, publication gates, and authorization. LLMs are isolated behind a provider interface and may rank, summarize, extract, and draft, but cannot publish directly in the initial operating mode.

## Data ownership
Supabase/PostgreSQL is the system of record. Aveiro is an optional publishing adapter. Removing Aveiro must not remove stories, sources, claims, articles, users, company intelligence, verification state, or publication history.

## Trust model
Every factual statement should trace to a claim, evidence, and source. Auto-publishing begins disabled. Shadow autonomy must precede any controlled auto-publish policy.

## Security model
All crawled/source text is untrusted input. Secrets are server-only. Public Supabase schemas use RLS. Authorization does not depend on user-editable metadata. Prompt-injection defense separates instructions from source content and validates structured model outputs.

## Phase 0 scope
Phase 0 creates a reproducible application foundation only: repository structure, pinned dependencies, Next.js App Router skeleton, strict TypeScript, environment validation, structured logging foundation, health endpoint, test harness, CI definition, Supabase client boundaries, and operating/security documentation. It does not create production database tables or auth policies; those belong to Phase 1.

## Phase 0 acceptance
- Application dependencies are pinned and lockfile generated.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Environment validation rejects missing/unsafe secret configuration.
- Health endpoint is deterministic and does not leak secrets.
- Supabase browser/server client responsibilities are separated.
- CI runs install, typecheck, lint, test, and build.
