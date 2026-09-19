# RLS / Authorization Matrix

This is the intended application-level matrix. The migration contract suite verifies RLS is enabled for every public table and that privileged RPCs are not executable by anon/authenticated roles.

| Data | ANON | USER | REVIEWER | EDITOR | ADMIN | OWNER | service role |
|---|---|---|---|---|---|---|---|
| Published articles/versions/citations/corrections | read | read | read | read | read | read | read/write |
| Unpublished stories/claims/evidence/articles | none | none | read where staff policy allows | editorial read/write | read/write | read/write | read/write |
| Sources/watchlists | limited public source data where policy allows | same | read | edit | edit | edit | read/write |
| Prompt/config/feature flags | none | none | limited read where exposed | limited read | read/write | read/write | read/write |
| User topic/company follows | none | own only | own only | own only | own only | own only | read/write |
| Saved articles | none | own only | own only | own only | own only | own only | read/write |
| User preferences | none | own only | own only | own only | own only | own only | read/write |
| Subscription records | none through table API | own if linked | own if linked | own if linked | admin visibility | admin visibility | read/write |
| Jobs/usage/automation | none | none | staff read | staff read | operational read | operational read | read/write |
| Dead letters | none | none | none | none | read | read | read/write |
| Analytics events | none | none | staff read where policy allows | staff read | staff read | staff read | read/write |

## Authorization rules

- Browser clients use publishable credentials and RLS.
- Privileged writes use server-only secret credentials after application role checks.
- `SECURITY DEFINER` functions pin an empty `search_path` and privileged RPCs are revoked from `public`, `anon`, and `authenticated`.
- User ownership policies explicitly compare `(select auth.uid())` with `user_id`.
- `profiles.role` is authorization data and is not user-updatable: authenticated clients receive column-level UPDATE privileges only for `display_name` and `avatar_url`; role changes require a privileged server/admin path.
