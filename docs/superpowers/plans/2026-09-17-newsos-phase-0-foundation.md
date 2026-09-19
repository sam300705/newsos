# NewsOS Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the production-ready application foundation required before database/auth implementation.

**Architecture:** Use a Next.js App Router modular monolith with strict TypeScript. Keep configuration, logging, health checks, and Supabase client construction behind focused modules so later phases can depend on stable interfaces without scattering secrets or infrastructure logic.

**Tech Stack:** Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3, Supabase JS 2.116.0, Zod 4.6.5, Pino 10.3.1, Vitest 5.0.1, ESLint 9.39.5.

**Spec:** `docs/superpowers/specs/2026-09-17-newsos-design.md`

## Global Constraints
- TypeScript strict mode is mandatory.
- Secrets are server-only and never use `NEXT_PUBLIC_` names.
- Supabase/PostgreSQL remains the system of record.
- Aveiro remains an optional adapter and is not required in Phase 0.
- No fake features: every declared Phase 0 capability must have implementation and verification.
- Do not add Phase 1 database schema or RBAC during Phase 0.

---

### Task 1: Project scaffold and dependency contract

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Interfaces:**
- Consumes: Node.js >=22.
- Produces: scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run` and an App Router entrypoint.

- [ ] **Step 1:** Write the package/configuration files with pinned direct dependencies and strict compiler settings.
- [ ] **Step 2:** Create a minimal server-rendered homepage that identifies the service as NewsOS foundation status, without pretending later-phase features exist.
- [ ] **Step 3:** Run dependency installation and generate `package-lock.json`.
- [ ] **Step 4:** Run `npm run typecheck`, `npm run lint`, and `npm run build` and fix configuration failures.
- [ ] **Step 5:** Commit as `chore: scaffold NewsOS application foundation`.

### Task 2: Environment validation and secret boundaries

**Files:**
- Create: `src/config/env.ts`
- Create: `src/config/env.test.ts`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`

**Interfaces:**
- Consumes: environment key/value map.
- Produces: `validatePublicEnv(input)`, `validateServerEnv(input)`, `getPublicEnv()`, and `getServerEnv()`; browser Supabase factory uses only public URL/publishable key; server factory may accept a server-only secret.

- [ ] **Step 1:** Write tests proving public config rejects missing URL/key and server config rejects absent secrets when a server client is requested.
- [ ] **Step 2:** Run the focused test and confirm failure before implementation.
- [ ] **Step 3:** Implement Zod schemas that allow local boot without optional integration secrets but never expose server secret values to client modules.
- [ ] **Step 4:** Implement browser/server Supabase factories with separate imports and no service-role export from browser code.
- [ ] **Step 5:** Run tests, typecheck, lint, and commit as `feat: add validated environment and Supabase boundaries`.

### Task 3: Observability and health contract

**Files:**
- Create: `src/lib/observability/logger.ts`
- Create: `src/lib/observability/request-id.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`

**Interfaces:**
- Consumes: optional request ID and runtime metadata.
- Produces: structured logger, `getOrCreateRequestId(headers)`, and `GET /api/health` returning `{status:"ok", service:"newsos", version:string}` plus `x-request-id`.

- [ ] **Step 1:** Write tests for deterministic health payload and request-ID propagation/generation.
- [ ] **Step 2:** Run tests and confirm they fail before implementation.
- [ ] **Step 3:** Implement Pino logger with redaction for common secret/token fields.
- [ ] **Step 4:** Implement request-ID helper and health route without dependency/database checks or secret leakage.
- [ ] **Step 5:** Run tests, typecheck, lint, build, and commit as `feat: add structured observability and health endpoint`.

### Task 4: CI and operational documentation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `ARCHITECTURE.md`
- Create: `SECURITY.md`
- Create: `EDITORIAL_POLICY.md`
- Create: `SOURCE_POLICY.md`
- Create: `AUTOMATION_POLICY.md`
- Create: `RUNBOOK.md`
- Create: `docs/testing/phase-0-verification.md`

**Interfaces:**
- Consumes: npm scripts from Task 1.
- Produces: CI that runs `npm ci`, typecheck, lint, tests, and build on pull requests/pushes; docs define boundaries and next-phase prerequisites.

- [ ] **Step 1:** Add CI with Node 22, npm cache, immutable `npm ci`, and the complete verification sequence.
- [ ] **Step 2:** Add concise architecture, security, editorial, source, automation, and operational policy docs without claiming unimplemented features exist.
- [ ] **Step 3:** Record Phase 0 verification commands and expected outputs.
- [ ] **Step 4:** Run the entire local verification sequence one final time.
- [ ] **Step 5:** Commit as `docs: define NewsOS operating and CI foundation`.

## Phase gate
Phase 0 is PASS only when dependency installation succeeds and all of `npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build` succeed from a clean checkout. If package installation is blocked by the execution environment, implementation may be marked COMPLETE-BUT-UNVERIFIED and Phase 1 must not start until an internet-enabled CI/remote checkout verifies the gate.
