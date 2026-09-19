# NewsOS Security Policy

## Trust boundaries

Untrusted inputs include crawled pages, RSS/Atom, Tavily output, model output, search strings, analytics metadata, newsletter forms and all browser requests. They are data and cannot alter system instructions or authorization.

## Secrets

Server-only secrets include `SUPABASE_SECRET_KEY`, Tavily, LLM, Aveiro and cron credentials. They must never have a `NEXT_PUBLIC_` prefix, appear in logs, client JavaScript, source control or API responses. Pino redaction covers authorization and common token/secret fields.

## Authentication and authorization

Supabase Auth establishes identity. Server-protected pages use verified claims. Application roles are OWNER, ADMIN, EDITOR, REVIEWER and ordinary authenticated user. Authorization uses protected role storage, not user-editable metadata. Privileged database RPCs are service-role-only.

## RLS

All tables in the exposed `public` schema enable RLS. Public access is limited to explicitly publishable records. User personalization tables use `auth.uid() = user_id` ownership policies. See `docs/security/rls-matrix.md`.

## SSRF

External URLs require HTTP(S), no embedded credentials, and reject localhost, `.local`, loopback, RFC1918, carrier-grade NAT, link-local, multicast/reserved and IPv6 local ranges. RSS network fetching resolves DNS and manually validates each redirect target. The same safety helpers should be used by any new direct-fetch integration.

## Prompt injection

Critical prompts explicitly classify source/corpus text as untrusted data. Ask-the-News sees only verified non-conflicted claims and supporting evidence IDs, and output citation IDs are checked against the allowed set. Invalid model citations fail closed.

## Publication safety

The publication gate runs before live publication, including scheduled and manual publication. High-risk categories cannot auto-publish under the current policy. Manual factual edits require re-verification. Correction publication requires a READY correction and preserves article/version/history data.

## Analytics/privacy

Analytics metadata is bounded structurally without truncating raw JSON. Events are limited to a small allowlist. Newsletter analytics record email domain rather than raw email. Product telemetry is intended for product/editorial quality, not advertising profiles.

## Operational security

Cron requires a bearer secret. Jobs are idempotent, bounded-retry and dead-lettered. Canonical records survive external-provider failures. Incident procedures and credential rotation are documented in `docs/operations/disaster-recovery.md`.

## Launch blockers

Do not launch until a dedicated NewsOS Supabase project has live RLS tests, current dependencies/build pass, publisher/contact details are configured, Vercel secrets are installed and one end-to-end real story has been acceptance-tested.
