import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rankForUser, validateFeedFocus } from "@/core/ranking";
import { toggleTopicFollow } from "@/app/preferences/actions";
export const dynamic="force-dynamic";
export default async function FollowingPage(){
  const db=await createServerSupabaseClient();
  const {data:claims}=await db.auth.getClaims();
  const userId=claims?.claims?.sub;
  if(!userId)redirect('/login');
  const [{data:topicFollows},{data:companyFollows},{data:topics},{data:articles},{data:preferenceRow}]=await Promise.all([
    db.from('user_topic_follows').select('topic_id').eq('user_id',userId),
    db.from('user_company_follows').select('company_id').eq('user_id',userId),
    db.from('topics').select('id,slug,name,description').order('name'),
    db.from('articles').select('id,slug,headline,summary,published_at,story_id,stories(newsworthiness_score,confidence_score,story_topics(topic_id),story_entities(entity_id))').in('status',['PUBLISHED','CORRECTED']).order('published_at',{ascending:false}).limit(100),
    db.from('user_preferences').select('preferences').eq('user_id',userId).maybeSingle()
  ]);
  const topicSet=new Set<string>((topicFollows??[]).map((x:any)=>String(x.topic_id)));
  const companySet=new Set<string>((companyFollows??[]).map((x:any)=>String(x.company_id)));
  let feedFocus: ReturnType<typeof validateFeedFocus> = 'balanced';
  try { feedFocus=validateFeedFocus((preferenceRow?.preferences as any)?.feedFocus??'balanced'); } catch {}
  const ranked=(articles??[]).map((a:any)=>({a,score:rankForUser({id:a.id,topicIds:(a.stories?.story_topics??[]).map((x:any)=>x.topic_id),companyIds:(a.stories?.story_entities??[]).map((x:any)=>x.entity_id),publishedAt:a.published_at,newsworthiness:Number(a.stories?.newsworthiness_score??0),confidence:Number(a.stories?.confidence_score??0)},topicSet,companySet,Date.now(),feedFocus)})).sort((x:any,y:any)=>y.score-x.score);
  return <main className="page-shell narrow"><div className="page-title"><p className="eyebrow">YOUR EXPLICIT PREFERENCES</p><h1>Following</h1><p>No opaque recommendation model: this feed prioritizes companies and topics you chose to follow, using your explicit feed focus.</p></div><p><Link href="/preferences">Feed focus: {feedFocus} · Change preferences</Link></p><section className="section"><h2>Topics</h2><div className="topic-grid">{(topics??[]).map((t:any)=>{const following=topicSet.has(t.id); return <form className={`topic-card ${following?'selected':''}`} action={toggleTopicFollow} key={t.id}><input type="hidden" name="topicId" value={t.id}/><input type="hidden" name="following" value={following?'true':'false'}/><div><strong>{t.name}</strong><p>{t.description}</p></div><button className="small">{following?'Following ✓':'Follow'}</button></form>})}</div></section><section className="section"><h2>For you</h2><div className="list-stack">{ranked.map(({a,score}:any)=><Link className="list-story" href={`/story/${a.slug}`} key={a.id}><div><small>Preference score {score}</small><h2>{a.headline}</h2><p>{a.summary}</p></div></Link>)}</div></section></main>}
