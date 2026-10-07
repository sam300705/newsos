-- Shared by embedded replay and full Supabase CI. Roll back every fixture.
begin;
create function pg_temp.assert(condition boolean, message text) returns text
language plpgsql as $$ begin
 if condition is not true then raise exception 'ASSERTION FAILED: %', message; end if;
 return message;
end; $$;
create function pg_temp.expect_denied(statement text) returns text
language plpgsql as $$ begin
 begin execute statement; exception when insufficient_privilege then return 'denied'; end;
 raise exception 'Expected permission denial: %', statement;
end; $$;

insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','user1@example.test','{"role":"OWNER"}'),
('00000000-0000-0000-0000-000000000002','user2@example.test','{}'),
('00000000-0000-0000-0000-000000000003','reviewer@example.test','{}'),
('00000000-0000-0000-0000-000000000004','editor@example.test','{}'),
('00000000-0000-0000-0000-000000000005','admin@example.test','{}'),
('00000000-0000-0000-0000-000000000006','owner@example.test','{}');
update public.profiles set role = case id::text
 when '00000000-0000-0000-0000-000000000003' then 'REVIEWER'::public.app_role
 when '00000000-0000-0000-0000-000000000004' then 'EDITOR'::public.app_role
 when '00000000-0000-0000-0000-000000000005' then 'ADMIN'::public.app_role
 when '00000000-0000-0000-0000-000000000006' then 'OWNER'::public.app_role
 else 'USER'::public.app_role end
where id::text like '00000000-0000-0000-0000-%';
insert into public.sources(id,name,domain,source_type,editorial_notes) values
('10000000-0000-0000-0000-000000000001','Example','example.test','PRIMARY','PRIVATE NOTE');
insert into public.discovered_urls(id,normalized_url,original_url,url_hash,discovery_channel) values
('20000000-0000-0000-0000-000000000001','https://example.test/1','https://example.test/1','hash1','TEST'),
('20000000-0000-0000-0000-000000000002','https://example.test/2','https://example.test/2','hash2','TEST');
insert into public.source_documents(id,discovered_url_id,source_id,canonical_url,title,content_text,raw_metadata) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','https://example.test/1','Cited source','PRIVATE RAW TEXT','{"secret":"raw"}'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','https://example.test/2','Uncited source','PRIVATE RAW TEXT','{}');
insert into public.stories(id,status,canonical_title) values
('40000000-0000-0000-0000-000000000001','PUBLISHED','Public story'),
('40000000-0000-0000-0000-000000000002','DRAFTED','Private story');
insert into public.story_sources(story_id,document_id,relationship) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PRIMARY_EVIDENCE'),
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','REPORTS'),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','REPORTS');
insert into public.claims(id,story_id,claim_text,claim_type,status) values
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Published claim','FACT','SUPPORTED'),
('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Private claim','FACT','SUPPORTED');
insert into public.articles(id,story_id,slug,status,headline) values
('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','test-published','PUBLISHED','Published article'),
('60000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','test-draft','DRAFT','Draft article');
insert into public.article_citations(article_id,claim_id,document_id,article_locator) values
('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','paragraph1'),
('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','paragraph1');
insert into public.user_preferences(user_id,preferences) values
('00000000-0000-0000-0000-000000000001','{"owner":1}'),
('00000000-0000-0000-0000-000000000002','{"owner":2}');

insert into public.entities(id,entity_type,canonical_name,normalized_name) values
('70000000-0000-0000-0000-000000000001','COMPANY','Example Co','example co');
insert into public.companies(id,slug) values ('70000000-0000-0000-0000-000000000001','test-co');
insert into public.user_topic_follows(user_id,topic_id)
 select u.id,t.id from auth.users u cross join public.topics t where u.id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') and t.slug='ai';
insert into public.user_company_follows(user_id,company_id) values
('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001');
insert into public.saved_articles(user_id,article_id) values
('00000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001');

select pg_temp.assert(not exists(select 1 from pg_tables where schemaname='public' and not rowsecurity),'All public tables enable RLS');
select pg_temp.assert((select role='USER' from public.profiles where id='00000000-0000-0000-0000-000000000001'),'User metadata cannot bootstrap OWNER');
select pg_temp.assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_job_batch','publish_article','merge_stories','split_story_source','publish_correction','match_story_embeddings') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'Operational RPCs denied to ordinary roles');
select pg_temp.assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_job_batch','publish_article','merge_stories','split_story_source','publish_correction','match_story_embeddings') and not has_function_privilege('service_role',p.oid,'EXECUTE')),'Operational RPCs granted to service role');
select pg_temp.assert(not has_column_privilege('authenticated','public.profiles','role','UPDATE'),'Profile role update denied');
select pg_temp.assert(has_column_privilege('authenticated','public.profiles','display_name','UPDATE'),'Display name update granted');
select pg_temp.assert(not has_function_privilege('authenticated','private.handle_new_user()','EXECUTE'),'Internal trigger not API executable');
select pg_temp.assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not ('search_path=""'=any(p.proconfig))),'Definer search paths pinned');

set local role anon;
select pg_temp.assert((select count(*)=1 from public.articles),'Anon sees only published article');
select pg_temp.assert((select count(*)=1 from public.claims),'Anon sees only published supported claim');
select pg_temp.assert((select count(*)=1 from public.article_citations),'Anon sees only published citation');
select pg_temp.assert((select count(*)=0 from public.source_documents),'Anon cannot read raw documents');
select pg_temp.assert((select count(*)=1 from public.get_published_sources(array['40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002']::uuid[])),'Public projection excludes drafts and uncited sources');
select pg_temp.assert((select canonical_url='https://example.test/1' and relationship='PRIMARY_EVIDENCE' from public.get_published_sources(array['40000000-0000-0000-0000-000000000001']::uuid[])),'Public citation metadata resolves');
select pg_temp.assert((select count(*)=0 from public.get_published_sources('{}'::uuid[])),'Empty projection input reveals nothing');
select pg_temp.expect_denied($q$select editorial_notes from public.sources$q$);
select pg_temp.expect_denied($q$update public.articles set headline='hacked'$q$);
select pg_temp.expect_denied($q$select * from public.claim_job_batch(1)$q$);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*)=1 from public.profiles),'USER sees own profile only');
select pg_temp.assert((select count(*)=1 from public.user_preferences),'USER sees own preferences only');
select pg_temp.assert((select count(*)=1 from public.user_topic_follows),'user_topic_follows own read only');
with removed as (delete from public.user_topic_follows where user_id=auth.uid() returning *) select pg_temp.assert((select count(*)=1 from removed),'user_topic_follows own delete succeeds');
insert into public.user_topic_follows(user_id,topic_id) values(auth.uid(),(select id from public.topics where slug='ai'));
select pg_temp.assert((select count(*)=1 from public.user_topic_follows),'user_topic_follows own insert succeeds');

with changed as (update public.user_topic_follows set user_id='00000000-0000-0000-0000-000000000003' where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from changed),'user_topic_follows other-user update denied');
select pg_temp.expect_denied($q$update public.user_topic_follows set user_id='00000000-0000-0000-0000-000000000003' where user_id=auth.uid()$q$);
with removed as (delete from public.user_topic_follows where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from removed),'user_topic_follows other-user delete denied');

select pg_temp.assert((select count(*)=1 from public.user_company_follows),'user_company_follows own read only');
with removed as (delete from public.user_company_follows where user_id=auth.uid() returning *) select pg_temp.assert((select count(*)=1 from removed),'user_company_follows own delete succeeds');
insert into public.user_company_follows(user_id,company_id) values(auth.uid(),'70000000-0000-0000-0000-000000000001'::uuid);
select pg_temp.assert((select count(*)=1 from public.user_company_follows),'user_company_follows own insert succeeds');

with changed as (update public.user_company_follows set user_id='00000000-0000-0000-0000-000000000003' where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from changed),'user_company_follows other-user update denied');
select pg_temp.expect_denied($q$update public.user_company_follows set user_id='00000000-0000-0000-0000-000000000003' where user_id=auth.uid()$q$);
with removed as (delete from public.user_company_follows where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from removed),'user_company_follows other-user delete denied');

select pg_temp.assert((select count(*)=1 from public.saved_articles),'saved_articles own read only');
with removed as (delete from public.saved_articles where user_id=auth.uid() returning *) select pg_temp.assert((select count(*)=1 from removed),'saved_articles own delete succeeds');
insert into public.saved_articles(user_id,article_id) values(auth.uid(),'60000000-0000-0000-0000-000000000001'::uuid);
select pg_temp.assert((select count(*)=1 from public.saved_articles),'saved_articles own insert succeeds');

with changed as (update public.saved_articles set user_id='00000000-0000-0000-0000-000000000003' where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from changed),'saved_articles other-user update denied');
select pg_temp.expect_denied($q$update public.saved_articles set user_id='00000000-0000-0000-0000-000000000003' where user_id=auth.uid()$q$);
with removed as (delete from public.saved_articles where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from removed),'saved_articles other-user delete denied');

update public.user_preferences set preferences='{"owner":1,"changed":true}' where user_id=auth.uid();
select pg_temp.assert((select preferences->>'changed'='true' from public.user_preferences),'Own preferences update succeeds');
update public.profiles set display_name='Own name' where id='00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select display_name='Own name' from public.profiles),'USER can update own presentation');
select pg_temp.expect_denied($q$update public.profiles set role='OWNER'$q$);
select pg_temp.expect_denied($q$update public.articles set headline='hacked'$q$);
select pg_temp.expect_denied($q$insert into public.user_preferences(user_id) values('00000000-0000-0000-0000-000000000003')$q$);
select pg_temp.expect_denied($q$update public.user_preferences set user_id='00000000-0000-0000-0000-000000000003'$q$);
with changed as (update public.user_preferences set preferences='{}' where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from changed),'Cannot update another user preferences');
with removed as (delete from public.user_preferences where user_id='00000000-0000-0000-0000-000000000002' returning *) select pg_temp.assert((select count(*)=0 from removed),'Cannot delete another user preferences');
select pg_temp.assert((select count(*)=0 from public.source_documents),'USER sees no raw documents');
select pg_temp.assert((select count(*)=1 from public.articles),'USER sees published content only');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select pg_temp.assert((select role='REVIEWER' from public.profiles where id=auth.uid()),'REVIEWER role resolves from DB');
select pg_temp.assert((select count(*)=2 from public.articles),'REVIEWER can read newsroom drafts');
select pg_temp.assert((select count(*)=0 from public.user_preferences),'REVIEWER cannot read other users preferences');
select pg_temp.assert((select count(*)=2 from public.source_documents),'REVIEWER can read staff evidence');
select pg_temp.expect_denied($q$update public.articles set headline='hacked'$q$);
select pg_temp.expect_denied($q$update public.profiles set role='OWNER'$q$);
select pg_temp.expect_denied($q$select * from public.claim_job_batch(1)$q$);
select pg_temp.assert((select count(*)=1 from public.get_published_sources(array['40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002']::uuid[])),'REVIEWER public RPC still excludes drafts');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
select pg_temp.assert((select role='EDITOR' from public.profiles where id=auth.uid()),'EDITOR role resolves from DB');
select pg_temp.assert((select count(*)=2 from public.articles),'EDITOR can read newsroom drafts');
select pg_temp.assert((select count(*)=0 from public.user_preferences),'EDITOR cannot read other users preferences');
select pg_temp.assert((select count(*)=2 from public.source_documents),'EDITOR can read staff evidence');
select pg_temp.expect_denied($q$update public.articles set headline='hacked'$q$);
select pg_temp.expect_denied($q$update public.profiles set role='OWNER'$q$);
select pg_temp.expect_denied($q$select * from public.claim_job_batch(1)$q$);
select pg_temp.assert((select count(*)=1 from public.get_published_sources(array['40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002']::uuid[])),'EDITOR public RPC still excludes drafts');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
select pg_temp.assert((select role='ADMIN' from public.profiles where id=auth.uid()),'ADMIN role resolves from DB');
select pg_temp.assert((select count(*)=2 from public.articles),'ADMIN can read newsroom drafts');
select pg_temp.assert((select count(*)=0 from public.user_preferences),'ADMIN cannot read other users preferences');
select pg_temp.assert((select count(*)=2 from public.source_documents),'ADMIN can read staff evidence');
select pg_temp.expect_denied($q$update public.articles set headline='hacked'$q$);
select pg_temp.expect_denied($q$update public.profiles set role='OWNER'$q$);
select pg_temp.expect_denied($q$select * from public.claim_job_batch(1)$q$);
select pg_temp.assert((select count(*)=1 from public.get_published_sources(array['40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002']::uuid[])),'ADMIN public RPC still excludes drafts');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000006';
select pg_temp.assert((select role='OWNER' from public.profiles where id=auth.uid()),'OWNER role resolves from DB');
select pg_temp.assert((select count(*)=2 from public.articles),'OWNER can read newsroom drafts');
select pg_temp.assert((select count(*)=0 from public.user_preferences),'OWNER cannot read other users preferences');
select pg_temp.assert((select count(*)=2 from public.source_documents),'OWNER can read staff evidence');
select pg_temp.expect_denied($q$update public.articles set headline='hacked'$q$);
select pg_temp.expect_denied($q$update public.profiles set role='OWNER'$q$);
select pg_temp.expect_denied($q$select * from public.claim_job_batch(1)$q$);
select pg_temp.assert((select count(*)=1 from public.get_published_sources(array['40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002']::uuid[])),'OWNER public RPC still excludes drafts');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select pg_temp.assert((select preferences='{"owner":2}'::jsonb from public.user_preferences),'Other user data stayed intact');
select pg_temp.assert((select count(*)=1 from public.profiles),'Second USER sees own profile only');
reset role;
set local role service_role;
select pg_temp.assert((select count(*)=2 from public.articles),'Service role reads canonical drafts');
update public.articles set headline='Service update' where id='60000000-0000-0000-0000-000000000002';
select pg_temp.assert((select headline='Service update' from public.articles where id='60000000-0000-0000-0000-000000000002'),'Service role canonical write works');
select pg_temp.assert((select editorial_notes='PRIVATE NOTE' from public.sources),'Staff service path retains source notes');
reset role;
rollback;
