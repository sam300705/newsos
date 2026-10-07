# Phase 3: evidence and atomic publication safety

Stacked on Phase 2 PR #3 (`1db958eb769596f460f92ccd2b89ad4b974288ba`). No merge, deployment, production migration or live provider call is part of this change.

## Evidence contract

The model proposes `{claims:[{text,evidence:[{documentId,sourceVersion,start,end,quote,stance}]}]}`. Zod rejects malformed outputs and extra trust/authority fields. Document membership, SHA-256 content version, zero-based Unicode code-point offsets and exact passage text are checked in TypeScript and again in PostgreSQL. A forged reference or passage rolls back the entire candidate set. Source documents cannot change their content, canonical URL or source identity; extraction creates another version.

Candidates are always UNVERIFIED with confidence 0. A passage match proves provenance, not entailment. A REVIEWER/EDITOR/ADMIN/OWNER must inspect the full source context, confirm support/contradiction or reject it, and record a rationale. The review binds the exact evidence record, claim text, content version and source registry classification. Subsequent changes invalidate that review. Legacy excerpt-free evidence does not qualify for new approval.

Primary evidence requires a reviewed ACTIVE registry source of type PRIMARY/REGULATOR with primary_source_capability; model primary IDs and is_primary hints cannot grant it. Corroboration counts verified ownership/syndication groups, not domains or document counts. Unknown groups contribute no independent corroboration. Confidence is conservative: 60 single-source, 75 independently corroborated, 85 primary, and 0 unsupported/conflicted. Story confidence is the minimum active claim confidence. These are editorial signals, not probabilities of truth.

Claim sets use a versioned input hash and active story pointer. Retrying the same input cannot duplicate claims or reactivate an older set. New sets do not inherit verification; older claim/evidence records and published snapshots remain intact. Runtime schemas now cover the two trust-critical outputs. Entity enrichment and other provider schemas remain later-phase work; the new claim output does not create unvalidated entities as a side effect.

## Complete, conservative draft coverage

The model returns known headline/summary/body claim IDs, not free-form prose. The server composes exact reviewed claim text into a plain-text draft. PostgreSQL independently requires evidence-backed citations for the complete headline, summary and every body paragraph (`headline`, `summary`, `body:0`, ...). SEO mirrors the covered headline/summary. An omitted nonnumeric assertion blocks approval even if old generator fact arrays are empty. Unresolved contradictory evidence and exact headline/body duplicates of another published article block publication.

Free-form editorial paraphrases, rich MDX layout and fuzzy duplicate detection are deliberately not accepted as verified by this path. Editing to unsupported wording leaves a DRAFT until the wording has an explicitly reviewed claim. `runPublicationGate` remains a deprecated advisory surface-form helper for existing callers/tests; it is no longer the publication authorization boundary.

A passage reviewer cannot approve their own article or correction. This second-human requirement applies to all categories, so a model-selected low-risk category cannot evade it. Operator assignment of specialist reviewers for sensitive topics still requires real newsroom policy; database roles alone do not establish medical/legal expertise.

## Approval and publication transaction

The gate persists a SHA-256 snapshot hash and blockers in private records. Approval checks the browser's expected article revision, current gate hash, complete coverage and independent human actor. Edits use optimistic revision checks and invalidate approval; generated drafts carry the revision observed before the model request. Published rows and citations cannot be directly overwritten, demoted or regenerated.

All evidence, registry, membership and canonical editorial mutations take a conservative shared transaction advisory lock. An evidence revision clock is included in approval hashes; even unrelated evidence changes invalidate outstanding approval conservatively. Publication and correction recheck coverage/hash under that same lock. This trades throughput and extra re-review for a simple, verifiable safety boundary; narrowing locks and snapshots requires measured concurrency work in Phase 4.

`publish_article` commits article status, immutable article version, private evidence/review snapshot, publication history and unique outbox record in one transaction. Queued publication carries the requested article revision; stale jobs cannot publish a newer approved draft. Scheduling checks happen again in SQL. A missing/demoted actor, stale approval or write failure leaves no partial publication. Scheduled work uses the recorded human reviewer rather than an anonymous system approval. Auto-publish remains disabled in code and migration.

Corrections stage their own citations and proposed body without changing public content. Explicit independent approval binds the proposed body, reason, values, citation set and base article revision. Publication updates public body/citations and appends a new version, evidence snapshot, history and outbox event atomically. Competing corrections against an older revision fail. Original versions/history remain immutable. Correction currently changes the body; headline/summary changes fail closed rather than silently bypassing coverage.

Decision records, temporary correction authorization and evidence snapshots are private, with no direct service-client write grants. Newly introduced public RPCs are service-only; server actions authenticate staff and SQL checks their role again. The existing reader provenance projection remains published-only; private raw evidence/review metadata is not exposed.

## Verification

At local packaging, Node 22.16.0 / npm 10.9.2:

| Check | Result |
|---|---|
| Frozen clean installation | PASS; 415 packages; package/lockfile unchanged |
| Fresh embedded migration replay | PASS; 16 migrations, 131 SQL assertions |
| Offline contracts | PASS; 53/53 |
| Vitest | PASS; 18/18 |
| Generated database type drift | PASS |
| Typecheck, lint, production build | PASS; build uses explicit fixture environment |
| Shell/Python syntax | PASS |
| Full Supabase / two-session races | CI acceptance required; do not infer from embedded replay |
| Live NewsOS Auth / provider acceptance / advisors | BLOCKED by correct-project access; not run |

Next build-generated next-env.d.ts/tsconfig.json changes were inspected and restored. SQL tests cover forged document IDs/passages, model trust hints, unreviewed assertions, evidence changes, invalid actors, separate reviewers, stale edits/approvals, syndicated/unknown groups, contradictions, claim refresh, immutable content and outbox-failure rollback. No fabricated live acceptance is claimed.

`bash scripts/db/test-supabase.sh` resets only the disposable local loopback stack, replays shared permission/publication tests, then invokes `scripts/db/test-concurrency.py`. That native test uses independent psql sessions for competing editors, evidence mutation vs publication, two publications, and competing corrections. The CI check on this PR is the authoritative native result. It does not simulate real Auth login or exercise a connected production project.

The outbox commit is covered here; leased dispatch, provider retry/reconciliation and duplicate remote writes belong to Phase 4/6. Existing post-publication jobs remain compatibility consumers; this phase does not claim transactional external delivery.

## Rollout and rollback

Apply the additive migration only to the correct dedicated preview database after authorized access is restored, then deploy compatible code and validate the real newsroom/provider flows. Historical public snapshots remain readable; legacy approvals cannot pass the new gate without versioned passage review. Existing in-flight old prompt/publication jobs may fail schema or revision checks and require a safe retry; never repair trust fields automatically.

For operational rollback, pause automation and set `evidence_draft_workflow=false`, keeping SQL safety guards and immutable snapshots. Do not revert to the old publish/correction RPCs or delete evidence/history. Fix forward with compatible migrations. No unrelated Supabase project was used.
