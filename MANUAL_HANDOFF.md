# Manual / Account-Dependent Handoff

Most infrastructure work that could be performed automatically has now been completed. Only items that require secrets, user-account interaction, external-provider authorization, an internet-connected npm environment, or production authorization remain here.

## Completed automatically

- Dedicated Supabase `NewsOS` project created in organization `sam`, region `ap-south-1`.
- Project cost confirmed at `$0/month` before creation.
- Database migrations applied and repaired where live PostgreSQL exposed migration bugs.
- Supabase security advisor reduced to **0 findings**.
- Performance advisor actionable warnings fixed; only expected unused-index INFO remains on the empty project.
- Live RLS/privilege structure checked: 45/45 public tables have RLS, no public table is policy-less, `profiles.role` is not user-updatable, privileged RPCs are service-only.
- Live database TypeScript generation executed.

## 1. Dependency lockfile and full build gate

The current sandbox cannot reach the npm registry reliably.

In an internet-connected checkout:

```bash
npm install
npm ci
npm run verify:offline
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Review resolved versions, commit `package-lock.json`, and fix any genuine type/lint/build issue before merge.

## 2. Supabase secret + Auth owner bootstrap

The project URL and publishable key are available from the Supabase project, but the server secret must be added through a secure environment store; never paste it into chat or commit it.

Then:

1. Configure Auth redirect URLs for the Vercel preview/production domains.
2. Sign up/sign in with the intended OWNER account through the application.
3. Promote that account to `OWNER` through a controlled one-time database/admin operation.
4. Live-test USER / REVIEWER / EDITOR / ADMIN / OWNER behavior.

Do **not** use CourseOS.

## 3. Tavily / LLM / Aveiro secrets and provider pricing

Add these only to secure deployment environment variables:

- `TAVILY_API_KEY`
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_EMBEDDING_MODEL`
- `AVEIRO_API_TOKEN`, `AVEIRO_SITE_ID`
- `CRON_SECRET`
- current provider pricing variables from `.env.example`

## 4. Publisher transparency

Before public launch configure real values for:

- `NEXT_PUBLIC_PUBLISHER_NAME`
- `NEXT_PUBLIC_CONTACT_EMAIL`
- production `NEXT_PUBLIC_SITE_URL`
- final brand name if different from NewsOS

## 5. Aveiro live test

With the server-side token configured, sync one verified article to an Aveiro page draft, retry it to prove idempotency, update the same draft, then create newsletter/social drafts. Confirm canonical Supabase data remains intact on a simulated Aveiro failure.

## 6. Vercel preview

After the dependency-backed build is green, connect the repository/project, add secure environment variables, deploy a preview, and smoke-test public/admin routes, role redirects, cron authentication and runtime logs.

## 7. Real story acceptance

Run one real current technology/business story end-to-end through discovery → extraction → clustering → verification → draft → editorial approval → publish → RSS/sitemap → Aveiro draft → company timeline. Record source/document/story/claim/article/publication/external IDs.

## 8. Production authorization

Final PR merge, production DNS/domain changes, public publishing, and enabling controlled auto-publish remain explicit owner-authorized actions.

## 9. GitHub repository remote

The local release branch is clean and logically committed, but the connected GitHub account currently has **no NewsOS repository** and the available GitHub connector does not expose repository creation.

Create one empty **private** repository under `sam300705` named `newsos` (do not initialize it with a README, license, or `.gitignore`). After that, link the local repository to that GitHub remote, push `feat/phases-1-16`, and open a PR into `main`. Do not merge the PR until the dependency-backed and preview gates pass.

## 10. Vercel project state

The connected Vercel team is `sam300705's projects`. A read-only project audit found **no NewsOS Vercel project** yet. Create/link/deploy NewsOS only after the GitHub remote exists, the dependency-backed build is green, and server-side secrets are stored securely in Vercel. Do not reuse one of the existing CourseOS or other project slots.
