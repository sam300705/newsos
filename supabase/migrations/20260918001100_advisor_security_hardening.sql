-- Resolve live Supabase security-advisor findings without weakening RLS.
create schema if not exists extensions;

-- pgvector is relocatable; keep extension objects out of the exposed public schema.
alter extension vector set schema extensions;

-- Recreate the embedding matcher with explicit extension schema references so the
-- hardened empty search_path remains safe after relocating pgvector.
create or replace function public.match_story_embeddings(
  query_embedding extensions.vector(1536),
  match_threshold real default 0.78,
  match_count integer default 10
)
returns table(story_id uuid, similarity real)
language sql
stable
security definer
set search_path=''
as $$
  select se.story_id, (1 - (se.embedding OPERATOR(extensions.<=>) query_embedding))::real as similarity
  from public.story_embeddings se
  where 1 - (se.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by se.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 50));
$$;
revoke all on function public.match_story_embeddings(extensions.vector,real,integer) from public, anon, authenticated;
grant execute on function public.match_story_embeddings(extensions.vector,real,integer) to service_role;

-- story_entities had RLS enabled but no explicit policies. Public readers may
-- only see entity links for published stories; authenticated staff may see all.
create policy "public_story_entities_read" on public.story_entities
for select to anon
using (exists(select 1 from public.stories s where s.id=story_id and s.status='PUBLISHED'));

create policy "authenticated_story_entities_read" on public.story_entities
for select to authenticated
using (
  exists(select 1 from public.stories s where s.id=story_id and s.status='PUBLISHED')
  or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))
);

create policy "editor_story_entities_insert" on public.story_entities
for insert to authenticated
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

create policy "editor_story_entities_update" on public.story_entities
for update to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));

create policy "editor_story_entities_delete" on public.story_entities
for delete to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
