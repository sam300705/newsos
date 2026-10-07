# Phase 2 database truth and permissions

## Scope

Stacked on Phase 1 PR #2, head `1d9f4a7f9369f1eb048a04ae0ef2efe78c7383fe`. This phase adds a disposable DB replay/test harness, public source-metadata projection, column-level source-note protection, generated catalog types, typed provenance RPC boundary and CI verification. It does not change claim verification, publication approvals, worker semantics or providers.

## Public provenance boundary

`get_published_sources(uuid[])` deliberately uses SECURITY DEFINER because raw source documents remain staff-only. Its hardcoded query discloses only cited documents linked to the requested published/corrected article's story and supported claim. It returns IDs, title, URL/date, source name/domain/type and relationship. It never returns document content, raw_metadata, editorial_notes, author data or arbitrary table columns. All roles receive the same published-only output. Inputs are capped at 100 story IDs; no dynamic SQL. PUBLIC execution is revoked; anon/authenticated/service_role execution is explicitly granted. Empty search_path is pinned. Caller-supplied story IDs cannot expose drafts or uncited documents.

Article and company public repositories use this typed RPC. Failed reads propagate instead of silently becoming zero citations. Document IDs are preserved for primary-source counts. SELECT on public.sources is narrowed to presentation/reputation columns; editorial_notes remain available through the already-authorized service client, not public API users. No source_documents/story_sources raw-read policies were weakened.

## Verification routes

Docker-free checks:

```bash
npm ci
npm run test:db
npm run db:types:check
```

PGlite is a development-only embedded PostgreSQL engine with pgvector/pgcrypto. Every migration is executed unchanged, in timestamp order, in a new in-memory database. `scripts/db/bootstrap-embedded.sql` supplies a minimal test-only auth.users/auth.uid and Supabase-like default roles/grants. SQL permission assertions execute with actual SET ROLE and JWT claim settings. No remote connection or production reset is possible through this harness.

Limit: this verifies PostgreSQL SQL/RLS/grants against approximated Supabase bootstrap, not GoTrue login, session behavior, actual PostgREST or live project settings. PGlite is single-session; worker concurrency remains Phase 4. No claim of live Supabase acceptance follows from these tests.

Full local Supabase replay (Docker required):

```bash
supabase start
bash scripts/db/test-supabase.sh
supabase stop --no-backup
```

The script uses explicit `db reset --local` and a hardcoded loopback test URL. Shared SQL tests begin a transaction and roll back all users/content. The database CI workflow pins Supabase CLI/actions and runs these steps in an ephemeral hosted runner. Production/linked reset is never used. The local config disables email confirmation only for development; it is not a production Auth policy.

## Generated types

`npm run db:types` introspects fresh replay catalogs to generate public table Row/Insert/Update types, public enums/FK relationships and the public provenance RPC. `db:types:check` fails on drift. These are catalog-generated types, not a fabricated dump from the unavailable live project or an official Supabase CLI export. The new RPC boundary uses them; legacy privileged clients/RPCs remain untyped to avoid unrelated worker rewrites. Official live schema generation and drift comparison remain required when NewsOS project access is restored.

## Permission coverage

Anon and USER see published content only, cannot access raw documents or private source notes and cannot call operational RPCs. User-editable metadata cannot bootstrap OWNER. Profiles allow own presentation updates but deny role edits. All four personalization tables enforce ownership; cross-user reads/updates/deletes and ownership reassignment fail. REVIEWER/EDITOR/ADMIN/OWNER can read the newsroom/evidence but cannot directly write canonical articles/roles or invoke service-only operations. Their personal-data access stays ownership-scoped. Service-role canonical reads/writes remain functional. The projection excludes draft and uncited sources even for staff. All public tables require RLS and definer search paths are checked.

## External access and rollback

The current connected Supabase inventory still exposes only unrelated project `vcoenvwnuknltaptvtxe`; documented NewsOS project `ycsmobruueoafsftyvps` is unavailable. No unrelated project was queried/modified and no replacement project was created. Live Auth, production advisors and role acceptance remain BLOCKED by account/project access.

Before deploying, apply the additive projection migration to the correct dedicated preview DB and verify it, then deploy the repository change. If reverting code, the additive read RPC may remain; old public source reads will again be incomplete. If removing the RPC later, revoke/drop it only after callers stop using it. Do not restore broad SELECT on editorial_notes or weaken raw-document RLS as rollback.

## Fresh local evidence — 7 October 2026

Implementation commit `ebef03f6984c47db072a97a3616fa4f8b30fd8a4`, Node 22.16.0/npm 10.9.2:

| Check | Result |
|---|---|
| npm ci --no-audit --no-fund | PASS; 415 packages, lockfile unchanged |
| npm run verify:offline | PASS; 53/53 |
| npm run test:db | PASS; 15 migrations, 85 SQL assertions |
| npm run db:types:check | PASS |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:run | PASS; 11/11 |
| npm run build | PASS with fixture configuration |
| Workflow YAML / embedded shell syntax | PASS |
| Full local Supabase start | BLOCKED; Docker socket unavailable |
| Live dedicated NewsOS database / Auth | BLOCKED; project access unavailable |

Known build-generated next-env.d.ts/tsconfig.json diffs were inspected and restored. No tracked package drift remained. GitHub's full Supabase gate is pending until its actual run completes; do not infer its success from embedded replay.
