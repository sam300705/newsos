import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function SavedPage(){const db=await createServerSupabaseClient(); const {data:claims}=await db.auth.getClaims(); const userId=claims?.claims?.sub; if(!userId)redirect('/login'); const {data}=await db.from('saved_articles').select('created_at,articles(id,slug,headline,summary,published_at)').eq('user_id',userId).order('created_at',{ascending:false}); return <main className="page-shell narrow"><div className="page-title"><p className="eyebrow">YOUR LIBRARY</p><h1>Saved stories</h1></div><div className="list-stack">{(data??[]).map((row:any)=><Link className="list-story" href={`/story/${row.articles.slug}`} key={row.articles.id}><div><h2>{row.articles.headline}</h2><p>{row.articles.summary}</p></div></Link>)}</div></main>}
