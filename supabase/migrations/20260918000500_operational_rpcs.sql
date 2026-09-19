create or replace function public.claim_job_batch(batch_size integer default 10)
returns setof public.job_runs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select id
    from public.job_runs
    where status = 'QUEUED'
      and (next_attempt_at is null or next_attempt_at <= now())
    order by created_at
    for update skip locked
    limit greatest(1, least(batch_size, 50))
  )
  update public.job_runs j
     set status='RUNNING', attempt=j.attempt+1, started_at=now(), updated_at=now()
    from picked
   where j.id=picked.id
  returning j.*;
end;
$$;
revoke all on function public.claim_job_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_job_batch(integer) to service_role;

create or replace function public.publish_article(p_article_id uuid, p_actor_id uuid default null)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.articles;
  next_version integer;
begin
  select * into current_row from public.articles where id=p_article_id for update;
  if current_row.id is null then raise exception 'Article not found'; end if;
  if current_row.status not in ('APPROVED','SCHEDULED','CORRECTED') then
    raise exception 'Article must be approved before publication';
  end if;
  select coalesce(max(version),0)+1 into next_version from public.article_versions where article_id=p_article_id;
  insert into public.article_versions(article_id,version,headline,summary,body_mdx,change_reason,created_by)
  values(p_article_id,next_version,current_row.headline,current_row.summary,current_row.body_mdx,'Publication snapshot',p_actor_id);
  update public.articles set status='PUBLISHED', published_at=coalesce(published_at,now()), updated_at=now() where id=p_article_id returning * into current_row;
  update public.stories set status='PUBLISHED', updated_at=now() where id=current_row.story_id;
  insert into public.publication_history(article_id,event,from_status,to_status,actor_id)
  values(p_article_id,'PUBLISH',current_row.status,'PUBLISHED',p_actor_id);
  return current_row;
end;
$$;
revoke all on function public.publish_article(uuid,uuid) from public, anon, authenticated;
grant execute on function public.publish_article(uuid,uuid) to service_role;

create or replace function public.merge_stories(p_target uuid, p_source uuid, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_target = p_source then raise exception 'Target and source must differ'; end if;
  insert into public.story_sources(story_id,document_id,relationship,added_at)
  select p_target, document_id, relationship, added_at from public.story_sources where story_id=p_source
  on conflict(story_id,document_id) do update set relationship=excluded.relationship;
  update public.claims set story_id=p_target where story_id=p_source;
  insert into public.story_entities(story_id,entity_id,relationship,confidence,evidence_source_ids)
  select p_target, entity_id, relationship, confidence, evidence_source_ids
  from public.story_entities where story_id=p_source
  on conflict(story_id,entity_id,relationship) do nothing;
  delete from public.story_entities where story_id=p_source;
  update public.company_timeline set story_id=p_target where story_id=p_source;
  update public.funding_rounds set story_id=p_target where story_id=p_source;
  update public.company_relationships set story_id=p_target where story_id=p_source;
  delete from public.stories where id=p_source;
  insert into public.audit_logs(actor_id,action,target_type,target_id,after_data)
  values(p_actor,'MERGE_STORY','story',p_target,jsonb_build_object('merged_source_story',p_source));
end;
$$;
revoke all on function public.merge_stories(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.merge_stories(uuid,uuid,uuid) to service_role;

create or replace function public.split_story_source(p_story uuid, p_document uuid, p_actor uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_story uuid;
begin
  if not exists(select 1 from public.story_sources where story_id=p_story and document_id=p_document) then
    raise exception 'Source is not attached to story';
  end if;
  insert into public.stories(status,canonical_title,first_seen_at,last_seen_at)
  select 'CANDIDATE', sd.title, coalesce(sd.published_at,now()), now()
  from public.source_documents sd where sd.id=p_document
  returning id into new_story;
  delete from public.story_sources where story_id=p_story and document_id=p_document;
  insert into public.story_sources(story_id,document_id,relationship) values(new_story,p_document,'REPORTS');
  insert into public.audit_logs(actor_id,action,target_type,target_id,after_data)
  values(p_actor,'SPLIT_STORY_SOURCE','story',p_story,jsonb_build_object('document_id',p_document,'new_story_id',new_story));
  return new_story;
end;
$$;
revoke all on function public.split_story_source(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.split_story_source(uuid,uuid,uuid) to service_role;
