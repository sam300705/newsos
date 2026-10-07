# Phase 1: reproducible canonical candidate

## Scope and branch truth

Base application: `134d27915a800761394e5523b9b46367fb3fd099` on feat/phases-1-16. main is `503dc22b206c3929dcc70a9787dedf5f28258ed6`. Common ancestor: `30f01d49d56bbe44f90ff4a9f1ce680b785dcb42`; main/application divergence is 45/14 commits. ops/netlify-deploy has the same application head. ops/live-smoke is `b23f233428aabcf0c2aa5347cd716b95f9f233f0`, adds smoke workflow intent and lacks final netlify.toml. PR #1 is a separate ingestion runner based on main; do not merge wholesale.

## Main bootstrap review

main's bootstrap-source.yml concatenates encoded archive fragments, checks a fixed byte count/hash, extracts files, checks out feat/phases-1-16, removes tracked contents, rsyncs reconstructed source, commits and pushes. It is a source-recovery mechanism, not a release gate. It can replace current application work with a historic archive. It was inspected but not executed or modified in Phase 1.

Proposed future integration: create a review integration branch from refreshed main; merge the hardened application lineage preserving both histories, deliberately resolve bootstrap-vs-app conflicts, retire the bootstrap workflow and fragments in that reviewed integration, and run exact-SHA checks plus preview acceptance. Review resulting app/lockfile/migrations against the hardened candidate. Never run archive reconstruction to perform the integration; never force-push or copy main over the application. Main still retains the old bootstrap workflow until that separate change is approved.

## CI semantics

The release gate uses default event checkout. pull_request checks GitHub's synthetic merge candidate; push and workflow_dispatch check their event commit. Both merge SHA and PR head SHA are reported. The workflow is never pull_request_target and uses fixture credentials, not production credentials. Checkout does not persist credentials. Repository token permissions are contents:read. Node is 22.16.0 and npm is 10.9.2. Action pins: checkout v4.2.2 and setup-node v4.4.0, verified against their upstream tag refs on 7 October 2026.

PR base branches and push branches include main, feat/**, phase*/** and release/**. No path-ignore excludes dependency/lockfile changes. Concurrency is event/ref or PR scoped. npm ci fails for missing/inconsistent lockfiles. CI never generates, commits, rebases or pushes a lockfile.

The final always-run step verifies package.json/package-lock.json are unchanged and reports tracked build effects. Next.js 16.3.5 generates next-env.d.ts and adds .next/dev/types to tsconfig.json during build. Phase 1 reports these effects rather than silently committing them; local verification restores only those known generated changes after inspection. No application configuration behavior is changed here.

## Acceptance limitations

Local command success verifies the application candidate with CI fixtures, not live Supabase/provider behavior. GitHub PR-event/lockfile-only acceptance requires an actual workflow run and must remain NOT RUN until observed. Branch protection/required status configuration is external configuration and is not silently changed. Deployments, merges and production changes are outside Phase 1.
