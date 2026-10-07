# Verification evidence

## Phase 1 release candidate

Date: 7 October 2026. Base application: `134d27915a800761394e5523b9b46367fb3fd099`. Branch: `phase1/reproducible-ci`. Verified implementation commit: `b4a5cac34e562546e40f404edb5c20fd4f2db66f`. The following evidence-only commit does not alter application or workflow behavior; GitHub will verify its own exact event SHA.

The checked-in lockfile exists. Node 22.16.0 / npm 10.9.2 are the pinned verification runtime. The release workflow uses read-only permissions, event checkout, frozen installation and no lockfile generation or remote write step. See `phase-1-reproducibility.md`.

## Earlier audit evidence at application base

The 7 October architecture audit passed 53/53 offline tests, 8/8 Vitest tests, typecheck, lint and Next build using fixture Supabase configuration. Its installation used --ignore-scripts and Node 24.19.0 / npm 11.9.0; Phase 1 must rerun with the pinned CI runtime and normal npm ci. GitHub release run 35497581414 at the application base succeeded, but used the old mutable release workflow.

## Historical external assertions

Previous documentation reported migrations through 20260918001400, 45/45 RLS tables, service-only operational RPCs, role-escalation restrictions and zero Supabase security-advisor findings in project ycsmobruueoafsftyvps. These are historical assertions, not fresh verification. Current connected project inventory does not expose that NewsOS project. Live DB migration replay, Auth roles and RLS acceptance are NOT RUN in this phase.

Netlify smoke run 35497482981 failed at Public routes; all following acceptance steps were skipped. Direct audit requests to https://newsos.netlify.app/ and /api/health returned 404. A connected Vercel NewsOS search returned no matching project in the searched scope. Cause/deployed SHA are not established.

## Remaining release gates

Provider calls, actual story/evidence correctness, live Aveiro idempotency, browser E2E, job concurrency/failure drills, cost reservation races, preview acceptance, production deployment and restore drills remain NOT RUN or later-phase work. Placeholder credentials used for builds never establish live acceptance. Controlled auto-publish remains off initially.

## Fresh Phase 1 command results

All commands exited 0 on implementation commit b4a5cac34e562546e40f404edb5c20fd4f2db66f with Node 22.16.0 / npm 10.9.2 and the workflow fixture variables:

| Command | Result |
|---|---|
| npm ci --no-audit --no-fund | PASS; 413 packages, lifecycle scripts enabled |
| npm run verify:offline | PASS; 53/53 |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:run | PASS; 8/8 in 2 files |
| npm run build | PASS; Next.js 16.3.5 |

YAML parsed successfully; event triggers/read-only permissions/default checkout and every embedded shell step were checked. Package metadata/lockfile were unchanged. Build-generated next-env.d.ts and tsconfig.json diffs were inspected and restored locally. No application configuration changes were retained.

GitHub execution of the new workflow and PR-trigger acceptance remain NOT RUN until a run completes. Lockfile-only triggers are present by configuration but no synthetic lockfile change was introduced merely to test them.

## Phase 2 evidence

See `phase-2-database.md` for the exact local implementation SHA, 15-migration replay, 85 DB assertions, 53 offline tests, 11 Vitest tests and remaining external limits. Phase 1 PR/push checks completed successfully in runs 37633565392 and 37633560115 at head 1d9f4a7f9369f1eb048a04ae0ef2efe78c7383fe. These are separate from Phase 2 acceptance.

## Phase 3 candidate

The versioned passage/human-review/atomic-publication candidate is documented in [Phase 3 verification](../testing/phase-3-evidence-publication.md). Local replay includes 16 migrations and 131 SQL assertions. Full native Supabase concurrency acceptance is the PR database CI result; live project/Auth/provider acceptance remains blocked. No auto-publication, deployment or merge is authorized by a passing disposable database check.
