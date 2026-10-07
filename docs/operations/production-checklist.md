# Production Checklist

## Code gate

- [x] `package-lock.json` committed on the application candidate.
- [ ] Read-only CI verifies the recorded event SHA using Node 22.16.0 / npm 10.9.2.
- [ ] PR and lockfile-only triggers accepted on GitHub.
- [ ] `npm ci` exit 0.
- [ ] `npm run verify:offline` exit 0.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.
- [ ] `npm run test:run` exit 0.
- [ ] `npm run build` exit 0.
- [ ] Secret scan clean.
- [ ] Git diff check clean.

Local Phase 1 command evidence is in `../testing/final-verification.md`; it does not close live release gates.

## Supabase

- [ ] Dedicated NewsOS project (not CourseOS).
- [ ] Migrations applied in order.
- [ ] Security advisor reviewed/fixed.
- [ ] Performance advisor reviewed/fixed.
- [ ] Generated replay catalog types match migrations (`npm run db:types:check`).
- [ ] Official live schema types compared after project access is restored.
- [ ] Disposable DB role/RLS tests pass (`npm run test:db` and full Supabase CI).
- [ ] Live Auth/session and role/RLS matrix tested.
- [ ] OWNER bootstrap verified.

## Providers

- [ ] Tavily Search/Extract/Crawl/Research test calls recorded.
- [ ] LLM structured-output calls verified.
- [ ] Current provider pricing and atomic paid-call budget admission verified; unknown pricing blocks unattended paid work.
- [ ] Aveiro draft create/update/retry idempotency verified without auto-publish permission.

## Publisher/product

- [ ] Publisher legal/operator name configured.
- [ ] Editorial contact configured.
- [ ] Final domain/site URL configured.
- [ ] About/Contact/Editorial/Corrections pages reviewed.
- [ ] RSS, sitemap, News sitemap and structured data validated.

## Preview acceptance

- [ ] Public routes smoke-tested.
- [ ] Admin routes + role redirects smoke-tested.
- [ ] Cron secret verified.
- [ ] One full real story accepted end-to-end.
- [ ] Failure drills completed for Tavily/LLM/Aveiro/job retry/budget/pause.

## Production

- [ ] Production publish explicitly authorized by owner.
- [ ] Controlled auto-publish remains disabled until shadow metrics justify deliberate activation.
