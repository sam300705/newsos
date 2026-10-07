# NewsOS infrastructure handoff

## Verified repository baseline

The GitHub repository exists and the application branch has a committed npm lockfile. Do not create a replacement repository or regenerate a lockfile merely to verify the code. See `docs/testing/final-verification.md` and `docs/testing/phase-1-reproducibility.md`.

Phase 1 changes CI/documentation only. No migration, external provider call, deployment or merge is part of it.

## Supabase access and acceptance

Historical documentation identifies dedicated NewsOS project `ycsmobruueoafsftyvps` and reports 45/45 RLS tables and zero security-advisor findings. These remain historical evidence. The 7 October connected inventory exposed only an unrelated project; the documented NewsOS project was unavailable. This does not establish that it was deleted. Restore the correct organization/account access before live verification. Do not use CourseOS or the unrelated project.

Then verify migration history, generated types, actual grants/RLS and USER/REVIEWER/EDITOR/ADMIN/OWNER behavior. Configure Auth redirect URLs and bootstrap the intended OWNER through a controlled operation. Store server credentials securely, never in chat or git.

## Provider setup

Configure Tavily, production LLM API credentials/model/base URL, optional embedding model, Aveiro credentials/site and CRON_SECRET in secure environment settings. Consumer AI subscriptions do not prove API access. Configure current pricing before unattended paid work. Live acceptance still needs Tavily extraction, claim/draft quality, usage/cost accounting and Aveiro create/retry/update identity checks.

## Hosting and publisher setup

The repository has Netlify and Vercel configuration. Observed `https://newsos.netlify.app/` and `/api/health` returned 404; smoke run 35497482981 failed on public routes. The connected Vercel NewsOS search returned no project in the searched scope. Neither observation establishes the underlying cause or the state of other accounts.

Identify the actual host/project and deployed SHA before changing infrastructure. Select a host and scheduler that support measured worker duration and polling requirements; configure separate preview/production data and secrets. Set publisher/operator name, contact and site URL before public launch.

## Outstanding release acceptance

- Actual Auth/RLS/role tests and disposable migration replay.
- Evidence passage validation, complete publication coverage and approval version binding.
- Job interruption/concurrency/retry and budget-race drills.
- Provider contracts and budgeted live acceptance.
- Browser E2E and full story → review → publication → RSS/sitemap → distribution acceptance.
- Preview runtime health, alerts, backups and restore drill.

Main integration, deployment and public publishing require separate task authorization. Auto-publish remains off; shadow mode remains the initial policy.
