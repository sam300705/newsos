# Disaster Recovery and Rollback

## Database

Use Supabase-managed backups appropriate to the production plan. Migrations are the canonical schema history. Before risky migration work, verify a backup/restore path in a non-production project.

### Bad migration

1. Pause automation.
2. Stop deployment promotion.
3. Assess whether a forward-fix migration is safer than rollback.
4. Restore from backup only when necessary and after preserving incident evidence.
5. Re-run RLS/security tests and advisor checks.

## Failed jobs

Canonical state is separate from job state. Correct the cause, then re-enqueue/retry with an idempotency key. Do not delete source/story/article records to clear a failure. Dead letters retain failure evidence.

## Provider outages

- **Tavily:** pause Tavily flags; RSS can continue.
- **LLM:** pause generation/verification jobs that depend on it; source/story records remain.
- **Aveiro:** disable `aveiro_sync`; first-party publication remains canonical.
- **Vercel:** queued work remains in Supabase; restore compute then resume.

## Bad prompt deployment

Deactivate the bad prompt version, reactivate a known-good version, pause affected automation, rerun relevant evaluations/drafts, and audit any content produced during the bad version window.

## Bad article publication

Pause automation if systemic, preserve the original version, publish a verified correction/retraction according to editorial policy, and inspect claims/evidence/publication gate/audit logs.

## Credential compromise

1. Pause automation and revoke/rotate the affected provider key.
2. Rotate deployment secrets.
3. Review audit/job/provider logs for misuse.
4. Invalidate sessions or privileged users if necessary.
5. Restore only after verifying new credentials and access controls.

## Admin account compromise

Disable/revoke the account, rotate relevant credentials, review audit logs/config/source-authority changes, revert unauthorized configuration through audited changes, and require fresh authentication/MFA according to deployment policy.
