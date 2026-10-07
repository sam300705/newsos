-- Read-only projection: disclose cited metadata, never raw source text or notes.
-- SECURITY DEFINER is deliberate because source documents remain staff-only.
-- Visibility is enforced here independently of caller role, including staff.
create or replace function public.get_published_sources(p_story_ids uuid[])
returns table (
  article_id uuid, story_id uuid, document_id uuid, relationship text,
  canonical_url text, title text, published_at timestamptz,
  source_name text, source_domain text, source_type public.source_type
)
language sql stable security definer set search_path = ''
as $$
  select distinct a.id, a.story_id, d.id, ss.relationship,
    d.canonical_url, d.title, d.published_at, s.name, s.domain, s.source_type
  from public.articles a
  join public.article_citations ac on ac.article_id = a.id
  join public.claims c on c.id = ac.claim_id and c.story_id = a.story_id
  join public.story_sources ss on ss.story_id = a.story_id and ss.document_id = ac.document_id
  join public.source_documents d on d.id = ac.document_id
  left join public.sources s on s.id = d.source_id
  where a.status in ('PUBLISHED', 'CORRECTED')
    and c.status in ('SUPPORTED', 'MULTI_SOURCE_SUPPORTED', 'PRIMARY_SOURCE_VERIFIED')
    and a.story_id = any(p_story_ids[1:100]);
$$;
revoke all on function public.get_published_sources(uuid[]) from public, anon, authenticated;
grant execute on function public.get_published_sources(uuid[]) to anon, authenticated, service_role;

-- ACTIVE source rows are public, but their internal editorial notes are not.
revoke select on public.sources from anon, authenticated;
grant select (id, name, domain, source_type, authority_score,
  primary_source_capability, historical_accuracy, correction_rate, failure_rate,
  status, last_checked_at, created_at, updated_at)
on public.sources to anon, authenticated;
