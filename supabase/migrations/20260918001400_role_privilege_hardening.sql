-- Defense in depth: RLS remains mandatory, but ordinary API roles should also
-- lack broad table-write privileges. Server-side editorial/worker mutations use
-- the service role after application authorization.
revoke insert, update, delete, truncate, references, trigger
on all tables in schema public
from anon, authenticated;

-- Authenticated users may maintain only their own explicit personalization data;
-- row-level policies still scope these operations to auth.uid().
grant select, insert, update, delete on public.user_topic_follows to authenticated;
grant select, insert, update, delete on public.user_company_follows to authenticated;
grant select, insert, update, delete on public.saved_articles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

-- Profiles are self-editable only for presentation fields. Authorization role is
-- deliberately excluded and remains server/admin managed.
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- Trigger helpers are internal implementation details, not API-callable RPCs.
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
