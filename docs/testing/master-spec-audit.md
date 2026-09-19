# Master Spec Audit

Allowed statuses in this document: `VERIFIED`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `MANUAL_INFRA_REQUIRED`, `BLOCKED_WITH_REASON`.

| Requirement | Implementation / evidence | Status |
|---|---|---|
| Phase 0 foundation/config/health/CI structure | Next.js/TS config, env validation, health endpoint, CI workflow | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Dedicated database/auth/RBAC/RLS | dedicated live NewsOS project; migrations applied; 45/45 public tables RLS-enabled; security advisor 0 findings | VERIFIED |
| RSS/Tavily ingestion | RSS fetch, Search/Extract/Crawl/Research adapters, watchlists, jobs | IMPLEMENTED_NOT_LIVE_VERIFIED |
| URL normalization + SSRF/redirect defense | `src/core/url.ts`, `src/lib/security/network*`; offline tests | VERIFIED |
| Dedupe/story clustering | deterministic signals + optional embeddings; offline tests | VERIFIED |
| Entity/company intelligence | entities, companies, verified timeline/funding/relationships plus founders/products/acquisitions/leadership sections; offline contracts | VERIFIED |
| Newsworthiness/source reputation | deterministic scoring/source types/authority | VERIFIED |
| Atomic claims/evidence/contradictions | claims + claim_evidence schema/pipeline | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Confidence engine | deterministic components/bands + tests | VERIFIED |
| Prompt versioning / prompt-injection isolation | DB prompt versions, hardened Ask prompt, source-untrusted instructions | VERIFIED |
| AI article generation constrained to claims | pipeline + claimUsages validation + citation creation | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Publication gate | unsupported facts/contradictions/duplicate/SEO checks + adversarial tests | VERIFIED |
| Admin newsroom actions | research/reextract/edit/reverify/approve/reject/schedule/publish/correct/merge/split/Aveiro | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Editable global settings/feature flags | validated OWNER/ADMIN actions + audit | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Source/feed controls | source authority/type/primary capability/feed interval/manual fetch/status | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Durable background jobs | job table, atomic SKIP LOCKED claim, retry/dead-letter, cron | VERIFIED |
| Budget/degraded mode | explicit provider rates, NORMAL/CONSERVE/EXHAUSTED policy + tests | VERIFIED |
| Public site/trust UI | article sources/provenance/corrections/company/search/latest | IMPLEMENTED_NOT_LIVE_VERIFIED |
| SEO/RSS/sitemaps | canonical metadata, NewsArticle/Breadcrumb/Organization, RSS/category feed, sitemap/news sitemap/robots | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Corrections/versioning | READY-gated RPC, article version/publication history + tests | VERIFIED |
| Aveiro adapter | bearer/idempotency/draft-first/distribution state/failure preservation contract | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Shadow autonomy | persisted decisions, editor comparison, disagreement metric | IMPLEMENTED_NOT_LIVE_VERIFIED |
| Controlled autonomy | centralized conditions incl high-risk and budget | VERIFIED |
| Personalization | follows/saves/preferences, explicit feed-focus ranking + ownership RLS tests | VERIFIED |
| Ask the News | verified/non-conflicted corpus and allowed-citation validation | VERIFIED |
| Analytics | bounded metadata, read completion, privacy-conscious event allowlist | VERIFIED |
| Security-definer/RLS audit | offline contracts + live role/function privilege checks + Supabase security advisor 0 findings | VERIFIED |
| Dependency lock/type/lint/Vitest/build | npm registry unavailable in current sandbox | BLOCKED_WITH_REASON |
| Dedicated Supabase migrations/live RLS/advisors/types | live NewsOS project created; migrations applied; schema types generated; advisor findings fixed | VERIFIED |
| Publisher ownership/contact | env-backed, real values not yet supplied | MANUAL_INFRA_REQUIRED |
| Aveiro live draft idempotency | needs server token/site ID in runtime | MANUAL_INFRA_REQUIRED |
| Vercel preview/live smoke test | needs verified build + project/secrets | MANUAL_INFRA_REQUIRED |
| Full real-story acceptance | Supabase ready; provider secrets/runtime and end-to-end execution still required | MANUAL_INFRA_REQUIRED |

## Phase status

| Phase | Status | Blocker/evidence |
|---|---|---|
| 0 Foundation | IMPLEMENTED_NOT_LIVE_VERIFIED | dependency-backed build pending |
| 1 Database/Auth | VERIFIED | live schema/RLS/privilege/advisor checks pass; live end-user role smoke remains release acceptance |
| 2 Ingestion | IMPLEMENTED_NOT_LIVE_VERIFIED | live DB/provider E2E pending |
| 3 Dedup/Clustering | VERIFIED | offline deterministic tests; live embedding optional |
| 4 Intelligence | VERIFIED | core deterministic contracts pass |
| 5 Verification | VERIFIED | claim/confidence/publication contracts pass |
| 6 AI Writing | IMPLEMENTED_NOT_LIVE_VERIFIED | live model + build verification pending |
| 7 Admin Newsroom | IMPLEMENTED_NOT_LIVE_VERIFIED | live auth/RLS/UI smoke pending |
| 8 Public Site | IMPLEMENTED_NOT_LIVE_VERIFIED | build/preview smoke pending |
| 9 Publishing | VERIFIED | version/correction/schedule gate contracts pass; live DB pending |
| 10 Aveiro | IMPLEMENTED_NOT_LIVE_VERIFIED | live token/site test pending |
| 11 Shadow Autonomy | IMPLEMENTED_NOT_LIVE_VERIFIED | needs real editor-decision sample |
| 12 Controlled Autonomy | VERIFIED | deterministic policy tested; should remain disabled operationally |
| 13 Company Intelligence | VERIFIED | verified-field rendering and offline contracts pass; real-data story acceptance remains release gate |
| 14 Personalization | VERIFIED | explicit feed focus + follows/saves + ownership RLS contracts pass; live auth smoke remains release gate |
| 15 Ask the News | VERIFIED | corpus/citation/prompt-injection contracts pass; live LLM pending |
| 16 Scale/Ops | IMPLEMENTED_NOT_LIVE_VERIFIED | cron/budget/jobs implemented; live runtime pending |
