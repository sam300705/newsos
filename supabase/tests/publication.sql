begin;
create function pg_temp.assert(condition boolean,message text) returns text language plpgsql as $$begin if condition is not true then raise exception 'ASSERTION FAILED: %',message; end if; return message; end$$;
create function pg_temp.expect_blocked(statement text) returns text language plpgsql as $$begin begin execute statement; exception when raise_exception or insufficient_privilege or check_violation then if sqlerrm like 'Expected block:%' then raise; end if; return 'blocked: '||sqlerrm; end; raise exception 'Expected block: %',statement; end$$;
insert into auth.users(id,email,raw_user_meta_data) values
('91000000-0000-0000-0000-000000000001','phase3-review@example.test','{}'),
('91000000-0000-0000-0000-000000000002','phase3-editor@example.test','{}'),
('91000000-0000-0000-0000-000000000003','phase3-user@example.test','{}');
update public.profiles set role='REVIEWER' where id='91000000-0000-0000-0000-000000000001';
update public.profiles set role='EDITOR' where id='91000000-0000-0000-0000-000000000002';
insert into public.sources(id,name,domain,source_type,primary_source_capability,independence_group) values('92000000-0000-0000-0000-000000000001','Acme','phase3.example.test','PRIMARY',true,'acme');
insert into public.discovered_urls(id,normalized_url,original_url,url_hash,discovery_channel) values('93000000-0000-0000-0000-000000000001','https://phase3.example.test/report','https://phase3.example.test/report','phase3','TEST');
insert into public.source_documents(id,discovered_url_id,source_id,canonical_url,content_text) values('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','https://phase3.example.test/report',E'Acme launched its product.\nAcme opened a laboratory.\nAcme delayed its launch.');
insert into public.stories(id,canonical_title) values('95000000-0000-0000-0000-000000000001','Acme news');
insert into public.story_sources(story_id,document_id,relationship) values('95000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','REPORTS');
create temp table candidates as select jsonb_agg(jsonb_build_object('text',piece,'evidence',jsonb_build_array(jsonb_build_object('documentId',d.id,'sourceVersion',private.digest(d.content_text),'start',strpos(d.content_text,piece)-1,'end',strpos(d.content_text,piece)-1+length(piece),'quote',piece,'stance','SUPPORTS')))) value from public.source_documents d cross join lateral unnest(string_to_array(d.content_text,E'\n')) piece where d.id='94000000-0000-0000-0000-000000000001';
select pg_temp.expect_blocked($q$select public.store_claim_candidates('95000000-0000-0000-0000-000000000001',repeat('0',64),'[{"text":"Made up","evidence":[{"documentId":"94000000-0000-0000-0000-000000000099","quote":"Made up","start":0,"end":7,"sourceVersion":"bad","stance":"SUPPORTS"}]}]')$q$);
select pg_temp.assert((select count(*)=0 from public.claim_sets where story_id='95000000-0000-0000-0000-000000000001'),'Bad evidence rolls back whole claim set');
select pg_temp.expect_blocked($q$select public.store_claim_candidates('95000000-0000-0000-0000-000000000001',repeat('0',64),jsonb_set((select value from candidates),'{0,evidence,0,quote}','"invented"'::jsonb))$q$);
select public.store_claim_candidates('95000000-0000-0000-0000-000000000001',repeat('1',64),(select value from candidates));
select public.store_claim_candidates('95000000-0000-0000-0000-000000000001',repeat('1',64),(select value from candidates));
select pg_temp.assert((select count(*)=3 from public.claims where story_id='95000000-0000-0000-0000-000000000001'),'Claim-set retries do not duplicate claims');
select pg_temp.assert((select bool_and(status='UNVERIFIED' and confidence=0) from public.claims where story_id='95000000-0000-0000-0000-000000000001'),'AI primary IDs never promote claims');
insert into public.articles(id,story_id,slug,headline,summary,body_mdx,seo_title,seo_description) values('96000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001','phase3-acme','Acme launched its product.','Acme opened a laboratory.',E'Acme launched its product.\n\nAcme opened a laboratory.','Acme launched its product.','Acme opened a laboratory.');
select pg_temp.expect_blocked($q$update public.articles set status='APPROVED' where id='96000000-0000-0000-0000-000000000001'$q$);
select pg_temp.assert(not (public.refresh_article_gate('96000000-0000-0000-0000-000000000001')->>'allowed')::boolean,'Unreviewed passages cannot pass coverage');
select pg_temp.expect_blocked($q$select public.review_claim_evidence((select id from public.claim_evidence limit 1),'91000000-0000-0000-0000-000000000003','SUPPORTS','Claim supported by this passage.')$q$);
select public.review_claim_evidence(e.id,'91000000-0000-0000-0000-000000000001','SUPPORTS','Exact passage supports this atomic claim.') from public.claim_evidence e join public.claims c on c.id=e.claim_id where c.story_id='95000000-0000-0000-0000-000000000001';
select pg_temp.assert((select bool_and(status='PRIMARY_SOURCE_VERIFIED' and confidence=85) from public.claims where story_id='95000000-0000-0000-0000-000000000001'),'Primary support requires registry and human passage review');
select public.save_generated_draft('96000000-0000-0000-0000-000000000001',1,(select active_claim_set_id from public.stories where id='95000000-0000-0000-0000-000000000001'),jsonb_build_object('headline','Acme launched its product.','summary','Acme opened a laboratory.','body',E'Acme launched its product.\n\nAcme opened a laboratory.'));
select pg_temp.assert((public.refresh_article_gate('96000000-0000-0000-0000-000000000001')->>'allowed')::boolean,'Every headline/summary/body statement has reviewed citation');
select pg_temp.expect_blocked($q$select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000003',1)$q$);
select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',1);
-- Passage reviewers may not approve their own work, regardless of category.
update public.profiles set role='EDITOR' where id='91000000-0000-0000-0000-000000000001';
update public.articles set status='REVIEW' where id='96000000-0000-0000-0000-000000000001';
select pg_temp.expect_blocked($q$select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',1)$q$);
update public.profiles set role='REVIEWER' where id='91000000-0000-0000-0000-000000000001';
select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',1);
-- Altering any evidence field invalidates the exact human-reviewed passage.
update public.claim_evidence set is_primary=true where claim_id in(select id from public.claims where story_id='95000000-0000-0000-0000-000000000001');
select pg_temp.assert(not (public.refresh_article_gate('96000000-0000-0000-0000-000000000001')->>'allowed')::boolean,'Changed evidence cannot inherit a previous passage review');
update public.claim_evidence set is_primary=false where claim_id in(select id from public.claims where story_id='95000000-0000-0000-0000-000000000001');
select public.refresh_article_gate('96000000-0000-0000-0000-000000000001');
select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',1);
-- Non-numeric fabricated statement is blocked even if generator fact arrays are empty.
select public.edit_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',1,'{"headline":"Acme launched its product.","summary":"Acme opened a laboratory.","body":"Acme secretly acquired its competitor."}');
select pg_temp.assert((select revision=2 and status='DRAFT' from public.articles where id='96000000-0000-0000-0000-000000000001'),'Content edit increments revision and removes approved state');
select pg_temp.assert(not (public.refresh_article_gate('96000000-0000-0000-0000-000000000001')->>'allowed')::boolean,'Unsupported nonnumeric assertion cannot pass');
select pg_temp.expect_blocked($q$select public.publish_article('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002')$q$);
select pg_temp.expect_blocked($q$select public.edit_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',1,'{"headline":"stale","body":"stale"}')$q$);
select public.edit_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',2,jsonb_build_object('headline','Acme launched its product.','summary','Acme opened a laboratory.','body',E'Acme launched its product.\n\nAcme opened a laboratory.'));
select public.refresh_article_gate('96000000-0000-0000-0000-000000000001');
select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',3);
update public.sources set independence_group='new-owner' where id='92000000-0000-0000-0000-000000000001';
select pg_temp.expect_blocked($q$select public.publish_article('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002')$q$);
select pg_temp.assert((select count(*)=0 from public.publication_outbox where article_id='96000000-0000-0000-0000-000000000001'),'Stale evidence never writes distribution outbox');
select public.review_claim_evidence(e.id,'91000000-0000-0000-0000-000000000001','SUPPORTS','Registry ownership rechecked; passage still supports claim.') from public.claim_evidence e join public.claims c on c.id=e.claim_id where c.story_id='95000000-0000-0000-0000-000000000001';
select public.refresh_article_gate('96000000-0000-0000-0000-000000000001');
select public.approve_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',3);
select pg_temp.expect_blocked($q$select public.publish_article_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',1)$q$);
-- Inject an outbox failure: all publication writes must roll back together.
create function pg_temp.fail_outbox() returns trigger language plpgsql as $$begin raise exception 'Injected outbox failure'; end$$;
create trigger test_outbox_failure before insert on public.publication_outbox for each row execute function pg_temp.fail_outbox();
select pg_temp.expect_blocked($q$select public.publish_article('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002')$q$);
select pg_temp.assert((select status='APPROVED' from public.articles where id='96000000-0000-0000-0000-000000000001') and (select count(*)=0 from public.article_versions where article_id='96000000-0000-0000-0000-000000000001'),'Outbox failure rolls back article, version, history and snapshots');
drop trigger test_outbox_failure on public.publication_outbox;
select public.publish_article('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*)=1 from public.article_versions where article_id='96000000-0000-0000-0000-000000000001') and (select count(*)=1 from public.publication_outbox where article_id='96000000-0000-0000-0000-000000000001'),'Publish commits exactly one snapshot and outbox event');
select pg_temp.expect_blocked($q$select public.publish_article('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002')$q$);
select pg_temp.expect_blocked($q$update public.articles set body_mdx='changed' where id='96000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_blocked($q$update public.articles set status='DRAFT' where id='96000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_blocked($q$delete from public.article_citations where article_id='96000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_blocked($q$update public.article_versions set body_mdx='rewritten' where article_id='96000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_blocked($q$delete from public.publication_history where article_id='96000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_blocked($q$update public.source_documents set content_text='new content' where id='94000000-0000-0000-0000-000000000001'$q$);
create temp table correction_ids as select public.propose_correction_revision('96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002',3,jsonb_build_object('reason','Correct the second paragraph based on reviewed source.','body',E'Acme launched its product.\n\nAcme delayed its launch.')) id;
select pg_temp.assert((public.check_correction_gate((select id from correction_ids))->>'allowed')::boolean,'Correction covers proposed content using separate citations');
select public.approve_correction_revision((select id from correction_ids),'91000000-0000-0000-0000-000000000002',3);
select public.publish_correction((select id from correction_ids),'91000000-0000-0000-0000-000000000002');
select pg_temp.assert((select status='CORRECTED' and revision=4 and body_mdx=E'Acme launched its product.\n\nAcme delayed its launch.' from public.articles where id='96000000-0000-0000-0000-000000000001'),'Correction publishes exact approved body with new revision');
select pg_temp.assert((select body_mdx=E'Acme launched its product.\n\nAcme opened a laboratory.' from public.article_versions where article_id='96000000-0000-0000-0000-000000000001' and version=1),'Original published snapshot remains unchanged');
select pg_temp.assert((select count(*)=2 from private.publication_snapshots where article_id='96000000-0000-0000-0000-000000000001') and (select count(*)=2 from public.publication_outbox where article_id='96000000-0000-0000-0000-000000000001'),'Correction snapshot/history/outbox commit together');
select pg_temp.expect_blocked($q$select public.publish_correction((select id from correction_ids),'91000000-0000-0000-0000-000000000002')$q$);
-- Distinct domains are not independent corroboration without reviewed ownership.
update public.sources set source_type='UNKNOWN',primary_source_capability=false where id='92000000-0000-0000-0000-000000000001';
insert into public.sources(id,name,domain,source_type,independence_group) values('92000000-0000-0000-0000-000000000002','Syndicated copy','copy.phase3.example.test','UNKNOWN','new-owner');
insert into public.discovered_urls(id,normalized_url,original_url,url_hash,discovery_channel) values('93000000-0000-0000-0000-000000000002','https://copy.phase3.example.test/report','https://copy.phase3.example.test/report','phase3-copy','TEST');
insert into public.source_documents(id,discovered_url_id,source_id,canonical_url,content_text) values('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','https://copy.phase3.example.test/report','Acme launched its product.');
insert into public.story_sources(story_id,document_id,relationship) values('95000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000002','REPORTS');
insert into public.claim_evidence(claim_id,document_id,stance,evidence_excerpt,span_start,span_end,source_version,is_primary) select id,'94000000-0000-0000-0000-000000000002','SUPPORTS',claim_text,0,length(claim_text),private.digest(claim_text),true from public.claims where story_id='95000000-0000-0000-0000-000000000001' and claim_text='Acme launched its product.';
select public.review_claim_evidence(e.id,'91000000-0000-0000-0000-000000000001','SUPPORTS','Passage supports claim; ownership group checked.') from public.claim_evidence e join public.claims c on c.id=e.claim_id where c.story_id='95000000-0000-0000-0000-000000000001' and c.claim_text='Acme launched its product.';
select pg_temp.assert((select status='SUPPORTED' and confidence=60 from public.claims where story_id='95000000-0000-0000-0000-000000000001' and claim_text='Acme launched its product.'),'Syndicated domains and forged primary hint do not increase confidence');
update public.sources set independence_group=null where id in ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002');
select public.review_claim_evidence(e.id,'91000000-0000-0000-0000-000000000001','SUPPORTS','Passage supports claim; ownership unknown.') from public.claim_evidence e join public.claims c on c.id=e.claim_id where c.story_id='95000000-0000-0000-0000-000000000001' and c.claim_text='Acme launched its product.';
select pg_temp.assert((select status='SUPPORTED' from public.claims where story_id='95000000-0000-0000-0000-000000000001' and claim_text='Acme launched its product.'),'Unknown ownership is not independent reporting');
update public.sources set independence_group=case when id='92000000-0000-0000-0000-000000000001' then 'acme' else 'independent-reporter' end where id in ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002');
select public.review_claim_evidence(e.id,'91000000-0000-0000-0000-000000000001','SUPPORTS','Passage supports claim; distinct ownership reviewed.') from public.claim_evidence e join public.claims c on c.id=e.claim_id where c.story_id='95000000-0000-0000-0000-000000000001' and c.claim_text='Acme launched its product.';
select pg_temp.assert((select status='MULTI_SOURCE_SUPPORTED' and confidence=75 from public.claims where story_id='95000000-0000-0000-0000-000000000001' and claim_text='Acme launched its product.'),'Only reviewed distinct ownership establishes multi-source support');
-- An unresolved contradictory passage blocks even a nominal supported status.
insert into public.claim_evidence(claim_id,document_id,stance,evidence_excerpt,span_start,span_end,source_version)
select c.id,d.id,'CONTRADICTS','Acme delayed its launch.',strpos(d.content_text,'Acme delayed its launch.')-1,strpos(d.content_text,'Acme delayed its launch.')-1+length('Acme delayed its launch.'),private.digest(d.content_text)
from public.claims c cross join public.source_documents d where c.story_id='95000000-0000-0000-0000-000000000001' and c.claim_text='Acme launched its product.' and d.id='94000000-0000-0000-0000-000000000001';
select pg_temp.assert((select not private.claim_supported(id) from public.claims where story_id='95000000-0000-0000-0000-000000000001' and claim_text='Acme launched its product.'),'Unreviewed contradiction blocks otherwise supported claim');
select public.review_claim_evidence(e.id,'91000000-0000-0000-0000-000000000001','REJECTED','Editor adjudicated these refer to different dated launches.') from public.claim_evidence e join public.claims c on c.id=e.claim_id where c.story_id='95000000-0000-0000-0000-000000000001' and c.claim_text='Acme launched its product.' and e.stance='CONTRADICTS';
select pg_temp.assert((select private.claim_supported(id) from public.claims where story_id='95000000-0000-0000-0000-000000000001' and claim_text='Acme launched its product.'),'Explicit human contradiction adjudication restores support');
-- A new claim set replaces active input, without deleting old published evidence.
select public.store_claim_candidates('95000000-0000-0000-0000-000000000001',repeat('2',64),(select value from candidates));
select pg_temp.assert((select count(*)=6 from public.claims where story_id='95000000-0000-0000-0000-000000000001'),'New source snapshot retains historical claim set');
select pg_temp.assert((select bool_and(c.status='UNVERIFIED') from public.claims c join public.stories st on st.active_claim_set_id=c.claim_set_id where st.id='95000000-0000-0000-0000-000000000001'),'New claim set never inherits previous verification');
select public.store_claim_candidates('95000000-0000-0000-0000-000000000001',repeat('1',64),(select value from candidates));
select pg_temp.assert((select cs.input_hash=repeat('2',64) from public.claim_sets cs join public.stories st on st.active_claim_set_id=cs.id where st.id='95000000-0000-0000-0000-000000000001'),'Retry of an old input cannot reactivate stale claims');
select pg_temp.assert((select count(*)=2 from private.publication_snapshots where article_id='96000000-0000-0000-0000-000000000001'),'Claim refresh preserves immutable publication evidence');
-- All newly introduced RPCs are service-only and private approval state is inaccessible.
select pg_temp.assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('store_claim_candidates','review_claim_evidence','refresh_article_gate','approve_article_revision','edit_article_revision','approve_correction_revision','propose_correction_revision','check_correction_gate','save_generated_draft','publish_article_revision') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'Every Phase 3 RPC denies ordinary API roles');
select pg_temp.assert(not has_table_privilege('service_role','private.article_approvals','INSERT'),'Service clients cannot forge approval records');
rollback;
