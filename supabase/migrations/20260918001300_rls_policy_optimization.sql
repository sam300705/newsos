-- Consolidate overlapping permissive SELECT policies while preserving the
-- original public/staff access model. This resolves Supabase advisor warnings.

-- profiles: profile_self_read already includes OWNER/ADMIN staff access.
drop policy if exists "staff_profiles_read" on public.profiles;

-- feature_flags: keep one SELECT policy; split admin writes by command.
drop policy if exists "admins_flags_write" on public.feature_flags;
create policy "admins_flags_insert" on public.feature_flags for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "admins_flags_update" on public.feature_flags for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "admins_flags_delete" on public.feature_flags for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));

-- app_config: keep one SELECT policy; split admin writes by command.
drop policy if exists "admins_config_write" on public.app_config;
create policy "admins_config_insert" on public.app_config for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "admins_config_update" on public.app_config for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "admins_config_delete" on public.app_config for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));

-- sources: one read path for authenticated users; editor writes remain direct.
drop policy if exists "staff_sources" on public.sources;
drop policy if exists "public_sources_read" on public.sources;
create policy "anon_sources_read" on public.sources for select to anon using (status='ACTIVE');
create policy "authenticated_sources_read" on public.sources for select to authenticated
using (status='ACTIVE' or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "editor_sources_insert" on public.sources for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_sources_update" on public.sources for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_sources_delete" on public.sources for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

-- stories.
drop policy if exists "staff_stories" on public.stories;
drop policy if exists "public_published_stories" on public.stories;
create policy "anon_published_stories" on public.stories for select to anon using (status='PUBLISHED');
create policy "authenticated_stories_read" on public.stories for select to authenticated
using (status='PUBLISHED' or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "editor_stories_insert" on public.stories for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_stories_update" on public.stories for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_stories_delete" on public.stories for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

-- entities are publicly readable; split editor writes from SELECT.
drop policy if exists "staff_entities_write" on public.entities;
create policy "editor_entities_insert" on public.entities for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_entities_update" on public.entities for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_entities_delete" on public.entities for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

-- companies are publicly readable; split editor writes from SELECT.
drop policy if exists "staff_companies_write" on public.companies;
create policy "editor_companies_insert" on public.companies for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_companies_update" on public.companies for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_companies_delete" on public.companies for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

-- claims: one public/role-aware SELECT path plus editor writes.
drop policy if exists "staff_claims" on public.claims;
drop policy if exists "public_verified_claims" on public.claims;
create policy "anon_verified_claims" on public.claims for select to anon
using (status in ('SUPPORTED','MULTI_SOURCE_SUPPORTED','PRIMARY_SOURCE_VERIFIED')
  and exists(select 1 from public.stories s where s.id=story_id and s.status='PUBLISHED'));
create policy "authenticated_claims_read" on public.claims for select to authenticated
using (
  (status in ('SUPPORTED','MULTI_SOURCE_SUPPORTED','PRIMARY_SOURCE_VERIFIED')
   and exists(select 1 from public.stories s where s.id=story_id and s.status='PUBLISHED'))
  or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))
);
create policy "editor_claims_insert" on public.claims for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_claims_update" on public.claims for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_claims_delete" on public.claims for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

-- articles.
drop policy if exists "staff_articles" on public.articles;
drop policy if exists "public_articles" on public.articles;
create policy "anon_articles_read" on public.articles for select to anon using (status in ('PUBLISHED','CORRECTED'));
create policy "authenticated_articles_read" on public.articles for select to authenticated
using (status in ('PUBLISHED','CORRECTED') or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "editor_articles_insert" on public.articles for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_articles_update" on public.articles for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_articles_delete" on public.articles for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

-- article versions.
drop policy if exists "staff_versions" on public.article_versions;
drop policy if exists "public_versions" on public.article_versions;
create policy "anon_versions_read" on public.article_versions for select to anon
using (exists(select 1 from public.articles a where a.id=article_id and a.status in ('PUBLISHED','CORRECTED')));
create policy "authenticated_versions_read" on public.article_versions for select to authenticated
using (
  exists(select 1 from public.articles a where a.id=article_id and a.status in ('PUBLISHED','CORRECTED'))
  or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))
);

-- article citations.
drop policy if exists "staff_citations" on public.article_citations;
drop policy if exists "public_citations" on public.article_citations;
create policy "anon_citations_read" on public.article_citations for select to anon
using (exists(select 1 from public.articles a where a.id=article_id and a.status in ('PUBLISHED','CORRECTED')));
create policy "authenticated_citations_read" on public.article_citations for select to authenticated
using (
  exists(select 1 from public.articles a where a.id=article_id and a.status in ('PUBLISHED','CORRECTED'))
  or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))
);

-- corrections: public published corrections or staff; editor writes.
drop policy if exists "public_corrections" on public.corrections;
drop policy if exists "staff_corrections" on public.corrections;
create policy "anon_corrections_read" on public.corrections for select to anon using (published_at is not null);
create policy "authenticated_corrections_read" on public.corrections for select to authenticated
using (published_at is not null or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "editor_corrections_insert" on public.corrections for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_corrections_update" on public.corrections for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "editor_corrections_delete" on public.corrections for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
