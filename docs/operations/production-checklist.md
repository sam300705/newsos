# Production Checklist

## Code gate

- [ ] `package-lock.json` committed.
- [ ] `npm ci` exit 0.
- [ ] `npm run verify:offline` exit 0.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.
- [ ] `npm run test:run` exit 0.
- [ ] `npm run build` exit 0.
- [ ] Secret scan clean.
- [ ] Git diff check clean.

## Supabase

- [ ] Dedicated NewsOS project (not CourseOS).
- [ ] Migrations applied in order.
- [ ] Security advisor reviewed/fixed.
- [ ] Performance advisor reviewed/fixed.
- [ ] Generated DB types current.
- [ ] Live role/RLS matrix tested.
- [ ] OWNER bootstrap verified.

## Providers

- [ ] Tavily Search/Extract/Crawl/Research test calls recorded.
- [ ] LLM structured-output calls verified.
- [ ] Current provider pricing configured or dollar budget explicitly considered incomplete.
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
