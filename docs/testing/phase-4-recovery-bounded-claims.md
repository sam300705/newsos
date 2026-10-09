# Phase 4 recovery slice: bounded claim ordering (partial, not accepted)

This change is intentionally stacked on Phase 3 commit `47b010bccd2845aaab655a3efa7a44e2b1131d04` and is isolated from the **unavailable uncommitted** `phase4/durable-jobs-costs` worktree. Do not overwrite or merge that historical work without a tree comparison.

## Implemented
- `runJobBatch` claims at most one executable job at a time (`claim_job_batch(1)`), rather than marking the entire batch RUNNING at once.
- Refuses invalid batch limits and enforces a 45-second **between-handlers** claim deadline, without misleadingly claiming to abort an in-flight handler.
- Added behavioral Vitest coverage of claim/execute ordering, batch cap, late handler, empty queue, error propagation, and invalid limits.

## Still unsafe / Phase 4 exit not met
- `claim_job_batch` has no lease timeout/reclaim/fencing tokens. A worker crash can strand the active job RUNNING.
- Canonical stage writes are not yet fenced or committed atomically with job completion and child enqueues.
- Historical-spend budget checks are not atomic financial admissions; manual work can bypass the check.
- External create/unknown outcomes require remote identity journal, reservation and reconciliation.
- Publication outbox is stored but not fully drained through versioned, durable consumption.
- This only bounds additional claims after a long-running job; it does not stop a hung handler or establish a hosting SLA.

## Verification
- Run `npm ci`, `npm run verify:offline`, `npm run test:db`, `npm run db:types:check`, `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build` on the **final PR commit**.
- Native database workflow is required, but cannot prove Phase 4's missing concurrency acceptance by itself.
- Restore the old Phase 4 worktree or produce a documented tree-level reconciliation before completing this phase.
