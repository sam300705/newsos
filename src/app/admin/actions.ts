"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/require-role";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { enqueueJob, recordAudit, setGlobalPause } from "@/lib/db/admin-repository";
import { makeIdempotencyKey } from "@/core/jobs";
import { assertSafePublicUrl } from "@/core/url";
import { normalizeFeedInterval, validateConfigValue, validateFeatureFlagKey } from "@/core/config-validation";
import { validateSourceType } from "@/core/source-validation";

const id = (fd:FormData,name:string) => {const v=String(fd.get(name)??'').trim(); if(!v)throw new Error(`${name} is required`); return v;};

export async function approveArticle(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const articleId=id(fd,'articleId'); const db=createAdminSupabaseClient(); const {data:article,error:read}=await db.from('articles').select('status').eq('id',articleId).single(); if(read)throw read; if(article.status!=='REVIEW')throw new Error('Only REVIEW articles can be approved'); const {error}=await db.from('articles').update({status:'APPROVED',reviewer_id:actor.userId,updated_at:new Date().toISOString()}).eq('id',articleId); if(error)throw error; await db.from('autonomy_decisions').update({editor_decision:'APPROVED',decided_by:actor.userId,reviewed_at:new Date().toISOString()}).eq('article_id',articleId).is('editor_decision',null); await recordAudit(actor.userId,'APPROVE_ARTICLE','article',articleId,{status:'APPROVED'},{status:article.status}); revalidatePath('/admin');}
export async function rejectArticle(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR','REVIEWER']); const articleId=id(fd,'articleId'); const reason=String(fd.get('reason')??'Rejected by editor').slice(0,1000); const db=createAdminSupabaseClient(); const {error}=await db.from('articles').update({status:'REJECTED',updated_at:new Date().toISOString()}).eq('id',articleId); if(error)throw error; await db.from('autonomy_decisions').update({editor_decision:'REJECTED',editor_reason:reason,decided_by:actor.userId,reviewed_at:new Date().toISOString()}).eq('article_id',articleId).is('editor_decision',null); await recordAudit(actor.userId,'REJECT_ARTICLE','article',articleId,{reason}); revalidatePath('/admin');}
export async function publishArticle(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const articleId=id(fd,'articleId'); const db=createAdminSupabaseClient(); const {data:article,error}=await db.from('articles').select('status,scheduled_for').eq('id',articleId).single(); if(error)throw error; if(!['APPROVED','SCHEDULED'].includes(article.status))throw new Error('Article must be approved or due for scheduled publication'); if(article.status==='SCHEDULED'&&article.scheduled_for&&Date.parse(article.scheduled_for)>Date.now())throw new Error('Scheduled article is not due yet'); await enqueueJob('PUBLISH_ARTICLE',makeIdempotencyKey('manual-publish',[articleId,Date.now()]),{articleId,actorId:actor.userId,manual:true}); await recordAudit(actor.userId,'REQUEST_PUBLISH_ARTICLE','article',articleId,{status:article.status}); revalidatePath('/admin'); revalidatePath('/latest');}
export async function researchMore(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR','REVIEWER']); const storyId=id(fd,'storyId'); await enqueueJob('RESEARCH_STORY',makeIdempotencyKey('manual-research',[storyId,Date.now()]),{storyId,manual:true}); await recordAudit(actor.userId,'RESEARCH_MORE','story',storyId); revalidatePath(`/admin/story/${storyId}`);}
export async function reextractDocument(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const discoveredUrlId=id(fd,'discoveredUrlId'); await enqueueJob('EXTRACT_DOCUMENT',makeIdempotencyKey('manual-extract',[discoveredUrlId,Date.now()]),{discoveredUrlId,manual:true}); await recordAudit(actor.userId,'REEXTRACT_DOCUMENT','discovered_url',discoveredUrlId);}
export async function regenerateArticle(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const storyId=id(fd,'storyId'); await enqueueJob('GENERATE_ARTICLE',makeIdempotencyKey('manual-regenerate',[storyId,Date.now()]),{storyId,manual:true}); await recordAudit(actor.userId,'REGENERATE_ARTICLE','story',storyId); revalidatePath(`/admin/story/${storyId}`);}
export async function syncAveiro(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const articleId=id(fd,'articleId'); await enqueueJob('SYNC_AVEIRO',makeIdempotencyKey('manual-aveiro',[articleId,Date.now()]),{articleId,manual:true}); await recordAudit(actor.userId,'SYNC_AVEIRO','article',articleId); revalidatePath('/admin');}
export async function mergeStories(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const target=id(fd,'targetStoryId'); const source=id(fd,'sourceStoryId'); const db=createAdminSupabaseClient(); const {error}=await db.rpc('merge_stories',{p_target:target,p_source:source,p_actor:actor.userId}); if(error)throw error; revalidatePath(`/admin/story/${target}`);}
export async function splitSource(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const storyId=id(fd,'storyId'); const documentId=id(fd,'documentId'); const db=createAdminSupabaseClient(); const {error}=await db.rpc('split_story_source',{p_story:storyId,p_document:documentId,p_actor:actor.userId}); if(error)throw error; revalidatePath(`/admin/story/${storyId}`);}
export async function toggleGlobalPause(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN']); const paused=String(fd.get('paused'))==='true'; await setGlobalPause(paused,actor.userId); revalidatePath('/admin/automation'); revalidatePath('/admin');}
export async function updateSource(fd:FormData){const actor=await requireStaff(['OWNER','ADMIN','EDITOR']); const sourceId=id(fd,'sourceId'); const sourceType=validateSourceType(id(fd,'sourceType')); const rawAuthority=Number(fd.get('authorityScore')??.5); if(!Number.isFinite(rawAuthority)||rawAuthority<0||rawAuthority>1)throw new Error('Authority must be between 0 and 1'); const authority=rawAuthority; const primary=String(fd.get('primarySourceCapability'))==='on'; const db=createAdminSupabaseClient(); const {data:before,error:readError}=await db.from('sources').select('source_type,authority_score,primary_source_capability').eq('id',sourceId).single(); if(readError)throw readError; const {error}=await db.from('sources').update({source_type:sourceType,authority_score:authority,primary_source_capability:primary,updated_at:new Date().toISOString()}).eq('id',sourceId); if(error)throw error; await recordAudit(actor.userId,'UPDATE_SOURCE','source',sourceId,{sourceType,authority,primary},before); revalidatePath('/admin/sources');}

export async function editArticle(fd:FormData){
  const actor=await requireStaff(['OWNER','ADMIN','EDITOR']);
  const articleId=id(fd,'articleId');
  const headline=id(fd,'headline').slice(0,300);
  const summary=String(fd.get('summary')??'').slice(0,1000);
  const bodyMdx=id(fd,'bodyMdx').slice(0,100000);
  const seoTitle=String(fd.get('seoTitle')??headline).slice(0,300);
  const seoDescription=String(fd.get('seoDescription')??summary).slice(0,500);
  const db=createAdminSupabaseClient();
  const {data:article,error:read}=await db.from('articles').select('id,story_id,status').eq('id',articleId).single();
  if(read)throw read;
  if(['PUBLISHED','CORRECTED'].includes(article.status))throw new Error('Published articles must use the correction workflow');
  const {error}=await db.from('articles').update({headline,summary,body_mdx:bodyMdx,seo_title:seoTitle,seo_description:seoDescription,status:'DRAFT',updated_at:new Date().toISOString()}).eq('id',articleId);
  if(error)throw error;
  await enqueueJob('VERIFY_EDITED_ARTICLE',makeIdempotencyKey('verify-edit',[articleId,Date.now()]),{articleId});
  await recordAudit(actor.userId,'EDIT_ARTICLE','article',articleId,{headline,status:'DRAFT'});
  revalidatePath(`/admin/story/${article.story_id}`);
}

export async function scheduleArticle(fd:FormData){
  const actor=await requireStaff(['OWNER','ADMIN','EDITOR']);
  const articleId=id(fd,'articleId');
  const scheduledFor=id(fd,'scheduledFor');
  const when=new Date(scheduledFor);
  if(Number.isNaN(when.valueOf())||when.getTime()<=Date.now())throw new Error('Schedule time must be in the future');
  const db=createAdminSupabaseClient();
  const {data:article,error:read}=await db.from('articles').select('status,story_id').eq('id',articleId).single(); if(read)throw read;
  if(article.status!=='APPROVED')throw new Error('Only approved articles can be scheduled');
  const {error}=await db.from('articles').update({status:'SCHEDULED',scheduled_for:when.toISOString(),updated_at:new Date().toISOString()}).eq('id',articleId); if(error)throw error;
  await recordAudit(actor.userId,'SCHEDULE_ARTICLE','article',articleId,{scheduledFor:when.toISOString()});
  revalidatePath(`/admin/story/${article.story_id}`);
}

export async function proposeCorrection(fd:FormData){
  const actor=await requireStaff(['OWNER','ADMIN','EDITOR']);
  const articleId=id(fd,'articleId');
  const reason=id(fd,'reason').slice(0,2000);
  const previousValue=String(fd.get('previousValue')??'').slice(0,5000);
  const correctedValue=String(fd.get('correctedValue')??'').slice(0,5000);
  const proposedBody=id(fd,'proposedBodyMdx').slice(0,100000);
  const db=createAdminSupabaseClient();
  const {data:article,error:read}=await db.from('articles').select('status,story_id').eq('id',articleId).single(); if(read)throw read;
  if(!['PUBLISHED','CORRECTED'].includes(article.status))throw new Error('Corrections can only target published articles');
  const {data:correction,error}=await db.from('corrections').insert({article_id:articleId,reason,previous_value:previousValue||null,corrected_value:correctedValue||null,created_by:actor.userId,status:'VERIFYING',proposed_body_mdx:proposedBody}).select('id').single(); if(error)throw error;
  await enqueueJob('VERIFY_CORRECTION',makeIdempotencyKey('verify-correction',[correction.id]),{correctionId:correction.id});
  await recordAudit(actor.userId,'PROPOSE_CORRECTION','article',articleId,{correctionId:correction.id,reason});
  revalidatePath(`/admin/story/${article.story_id}`);
}

export async function publishCorrection(fd:FormData){
  const actor=await requireStaff(['OWNER','ADMIN','EDITOR']);
  const correctionId=id(fd,'correctionId');
  const db=createAdminSupabaseClient();
  const {data,error}=await db.rpc('publish_correction',{p_correction_id:correctionId,p_actor_id:actor.userId});
  if(error)throw error;
  revalidatePath('/admin'); revalidatePath('/latest'); if(data?.story_id)revalidatePath(`/admin/story/${data.story_id}`);
}

export async function createSourceAndFeed(fd:FormData){
  const actor=await requireStaff(['OWNER','ADMIN','EDITOR']);
  const name=id(fd,'name').slice(0,200);
  const domain=id(fd,'domain').toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
  const sourceType=validateSourceType(id(fd,'sourceType'));
  const feedUrl=id(fd,'feedUrl');
  assertSafePublicUrl(feedUrl);
  const db=createAdminSupabaseClient();
  const {data:source,error}=await db.from('sources').upsert({name,domain,source_type:sourceType,authority_score:.5},{onConflict:'domain'}).select('id').single(); if(error)throw error;
  const intervalMinutes=normalizeFeedInterval(fd.get('intervalMinutes')??10);
  const {data:feed,error:feedError}=await db.from('feeds').upsert({source_id:source.id,url:feedUrl,enabled:true,interval_minutes:intervalMinutes},{onConflict:'url'}).select('id').single(); if(feedError)throw feedError;
  await enqueueJob('FETCH_FEED',makeIdempotencyKey('manual-feed',[feed.id,Date.now()]),{feedId:feed.id,manual:true});
  await recordAudit(actor.userId,'CREATE_SOURCE_FEED','feed',feed.id,{sourceId:source.id,feedUrl,intervalMinutes});
  revalidatePath('/admin/sources');
}

export async function createWatchlist(fd:FormData){
  const actor=await requireStaff(['OWNER','ADMIN','EDITOR']);
  const name=id(fd,'name').slice(0,200);
  const kind=id(fd,'kind');
  const query=String(fd.get('query')??'').trim()||null;
  const url=String(fd.get('url')??'').trim()||null;
  const instructions=String(fd.get('instructions')??'').trim().slice(0,1000)||null;
  const intervalMinutes=normalizeFeedInterval(fd.get('intervalMinutes')??30);
  if(kind==='TAVILY_QUERY'&&!query)throw new Error('Query required');
  if(kind==='CRAWL_URL'&&!url)throw new Error('URL required');
  if(url)assertSafePublicUrl(url);
  const db=createAdminSupabaseClient();
  const {data,error}=await db.from('source_watchlists').insert({name,kind,query,url,instructions,interval_minutes:intervalMinutes,enabled:true}).select('id').single(); if(error)throw error;
  await recordAudit(actor.userId,'CREATE_WATCHLIST','source_watchlist',data.id,{name,kind});
  revalidatePath('/admin/automation');
}


export async function updateFeatureFlag(fd: FormData) {
  const actor = await requireStaff(["OWNER", "ADMIN"]);
  const key = validateFeatureFlagKey(id(fd, "key"));
  const enabled = String(fd.get("enabled")) === "true";
  const db = createAdminSupabaseClient();
  const { data: before, error: readError } = await db.from("feature_flags").select("enabled").eq("key", key).single();
  if (readError) throw readError;
  const { error } = await db.from("feature_flags").update({ enabled, updated_by: actor.userId, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) throw error;
  await recordAudit(actor.userId, "UPDATE_FEATURE_FLAG", "feature_flag", key, { enabled }, { enabled: before.enabled });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/automation");
}

export async function updateAppConfig(fd: FormData) {
  const actor = await requireStaff(["OWNER", "ADMIN"]);
  const key = id(fd, "key");
  const raw = id(fd, "value");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Configuration value must be valid JSON"); }
  const value = validateConfigValue(key, parsed);
  const db = createAdminSupabaseClient();
  const { data: before, error: readError } = await db.from("app_config").select("value").eq("key", key).single();
  if (readError) throw readError;
  const { error } = await db.from("app_config").update({ value, updated_by: actor.userId, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) throw error;
  await recordAudit(actor.userId, "UPDATE_APP_CONFIG", "app_config", key, { value }, { value: before.value });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/automation");
}

export async function updateFeed(fd: FormData) {
  const actor = await requireStaff(["OWNER", "ADMIN", "EDITOR"]);
  const feedId = id(fd, "feedId");
  const enabled = String(fd.get("enabled")) === "true";
  const intervalMinutes = normalizeFeedInterval(fd.get("intervalMinutes") ?? 10);
  const db = createAdminSupabaseClient();
  const { data: before, error: readError } = await db.from("feeds").select("enabled,interval_minutes").eq("id", feedId).single();
  if (readError) throw readError;
  const { error } = await db.from("feeds").update({ enabled, interval_minutes: intervalMinutes }).eq("id", feedId);
  if (error) throw error;
  await recordAudit(actor.userId, "UPDATE_FEED", "feed", feedId, { enabled, intervalMinutes }, before);
  revalidatePath("/admin/sources");
}

export async function fetchFeedNow(fd: FormData) {
  const actor = await requireStaff(["OWNER", "ADMIN", "EDITOR"]);
  const feedId = id(fd, "feedId");
  await enqueueJob("FETCH_FEED", makeIdempotencyKey("manual-feed", [feedId, Date.now()]), { feedId, manual: true });
  await recordAudit(actor.userId, "FETCH_FEED_NOW", "feed", feedId);
  revalidatePath("/admin/sources");
}
