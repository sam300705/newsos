# NewsOS Runbook

## Verification

Run the dependency-free trust suite at any time:

```bash
npm run verify:offline
```

Once dependencies and `package-lock.json` are available:

```bash
npm ci
npm run verify:offline
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Treat any non-zero command as a release blocker until resolved or explicitly documented as an external environment blocker.

## Worker

Vercel cron calls `/api/cron/run` every ten minutes. The endpoint requires `Authorization: Bearer $CRON_SECRET`. Each invocation schedules due feeds/watchlists/articles then atomically claims a bounded job batch.

## Pause

Use `/admin/automation` to enable **PAUSE ALL AUTOMATION**. This prevents new scheduled automation and defers non-manual queued work. Manual newsroom actions remain explicit and audited.

## Failed jobs

Inspect `job_runs` and `dead_letters`. Retry by addressing the provider/data failure and re-enqueueing with a deliberate idempotency key. Do not edit canonical records merely to make a job appear successful.

## Provider outage

- Tavily unavailable: keep RSS/canonical data, defer paid discovery/research.
- LLM unavailable: keep sources/stories/claims already verified; do not publish incomplete drafts.
- Aveiro unavailable: canonical article remains live in Supabase/Next.js; distribution job fails/retries.
- Vercel/worker unavailable: queued jobs remain in PostgreSQL until processing resumes.

## Bad publication

Pause automation, create a correction or retract according to editorial policy, preserve version/publication history, then investigate source/claim/gate logs.

## Health

`GET /api/health` returns service/version/status and an `x-request-id`; it intentionally does not expose privileged dependency details.
