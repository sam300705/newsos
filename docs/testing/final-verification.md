# Final Verification Evidence

## Dependency-free evidence

Run:

```bash
npm run verify:offline
```

Latest repository-wide dependency-free result after live Supabase hardening and personalization/company-intelligence completion: **48 tests, 48 passed, 0 failed**.

The suite covers URL/SSRF/redirect safety, dedupe, clustering signals, newsworthiness, source reputation, claim confidence/contradictions, unsupported-fact publication gates, high-risk autonomy, Ask-the-News prompt/citation constraints, bounded retries and atomic job claiming, RLS/static security contracts, settings validation, feed intervals, analytics bounds, newsletter honeypot, read completion, automation flags, search sanitization, budget policy, personalization ownership and feed focus, article edit re-verification, correction readiness/history, scheduled publication gating, Aveiro idempotency, explicit cost estimation, shadow-autonomy disagreement metrics, profile-role escalation prevention, source validation, public rendering safety, cron authentication, and ordinary-role privilege hardening.

A TypeScript parser pass over **104 TS/TSX files** produced **0 syntax diagnostics**. Full project typechecking is still dependency-blocked (see below).

## Live Supabase evidence

Dedicated project: `NewsOS` (`ycsmobruueoafsftyvps`), `ap-south-1`.

Verified live:

- all migrations through `20260918001400_role_privilege_hardening.sql` applied;
- 45/45 public tables have RLS enabled;
- 0 public tables are missing an RLS policy;
- privileged operational RPCs are not executable by `anon` or `authenticated` and are executable by `service_role`;
- `authenticated` cannot update `profiles.role`;
- `anon` cannot update profiles;
- normal authenticated users cannot directly update canonical articles;
- authenticated users retain intended own-preference writes;
- internal trigger helpers are no longer API-executable;
- pgvector lives in `extensions`, not the exposed `public` schema;
- Supabase security advisor: **0 findings**;
- performance advisor: no actionable warnings; only unused-index INFO notices on the fresh empty database.

Live schema TypeScript generation was executed successfully against the project. Persisting/regenerating the generated file is part of the dependency-connected release workflow so it can be kept in sync by CI.

## Dependency-backed gate

Not proven until all commands run in the same release candidate:

```bash
npm ci
npm run verify:offline
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Current sandbox cannot reliably reach the npm registry, so `node_modules` and `package-lock.json` are unavailable. A global TypeScript fallback cannot substitute for framework/package typings; its missing-module/JSX errors are expected in this environment.

## Remaining live gate

Production verification additionally requires:

- real Auth signup/login plus live USER/REVIEWER/EDITOR/ADMIN/OWNER behavior;
- live Tavily story acceptance in the release runtime;
- configured LLM provider and one verified claim→draft flow;
- Aveiro draft sync/update/retry test;
- Vercel preview build and route smoke test;
- full real-story and deliberate-failure acceptance tests.

## Repository hosting / preview state

- Local branch `feat/phases-1-16` is clean and split into logical commits.
- Connected GitHub installation currently contains no `NewsOS`/`newsos` repository; the available connector cannot create a repository, so remote creation is a genuine manual infrastructure step.
- Connected Vercel team `sam300705's projects` contains no NewsOS project yet. Preview deployment remains intentionally blocked behind the dependency-backed build plus secure deployment secrets.
