import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { TrustPanel } from "@/components/trust-panel";
import { getPublishedArticleBySlug } from "@/lib/db/public-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toggleSavedArticle } from "@/app/preferences/actions";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { AskNews } from "@/components/ask-news";
import { ReadCompleteBeacon } from "@/components/read-complete-beacon";
import { getPublicEnv } from "@/config/env";
export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const data=await getPublishedArticleBySlug(slug).catch(()=>null);
  if(!data)return{};
  const site=getPublicEnv().siteUrl;
  const url=`${site}/story/${slug}`;
  const title=data.article.seo_title||data.article.headline;
  const description=data.article.seo_description||data.article.summary||undefined;
  return {
    title,
    description,
    alternates:{canonical:url},
    openGraph:{type:"article",url,title:data.article.headline,description,publishedTime:data.article.published_at||undefined,modifiedTime:data.article.updated_at||undefined},
    twitter:{card:"summary_large_image",title,description},
  };
}

export default async function StoryPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const data=await getPublishedArticleBySlug(slug).catch(()=>null);
  if(!data)notFound();
  const {article,storySources,corrections,citations}=data!;
  let saved=false;
  try{const db=await createServerSupabaseClient(); const {data:claims}=await db.auth.getClaims(); const uid=claims?.claims?.sub; if(uid){const {data:save}=await db.from("saved_articles").select("article_id").eq("user_id",uid).eq("article_id",article.id).maybeSingle(); saved=Boolean(save);}}catch{}
  const citedIds=new Set((citations as any[]).map((citation:any)=>citation.document_id));
  const sourceRows=(storySources as any[]).map(r=>r.source_documents).filter((row:any)=>row&&citedIds.has(row.id));
  const primary=(storySources as any[]).filter((r:any)=>citedIds.has(r.document_id)&&(r.relationship==='PRIMARY_EVIDENCE'||r.source_documents?.sources?.source_type==='PRIMARY'||r.source_documents?.sources?.source_type==='REGULATOR')).length;
  const site=getPublicEnv().siteUrl;
  const canonical=`${site}/story/${slug}`;
  const jsonLd={"@context":"https://schema.org","@type":"NewsArticle",headline:article.headline,description:article.summary,datePublished:article.published_at,dateModified:article.updated_at,articleSection:article.category,mainEntityOfPage:{"@type":"WebPage","@id":canonical},publisher:{"@type":"Organization",name:getPublicEnv().brandName,url:site}};
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:site},{"@type":"ListItem",position:2,name:article.category??"News",item:`${site}/category/${encodeURIComponent(String(article.category??'news').toLowerCase())}`},{"@type":"ListItem",position:3,name:article.headline,item:canonical}]};
  return <main className="article-shell"><AnalyticsBeacon eventType="ARTICLE_VIEW" articleId={article.id}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumb).replace(/</g,"\\u003c")}}/><article><div className="article-kicker">{article.category ?? "News"} · VERIFIED STORY</div><h1>{article.headline}</h1><p className="article-summary">{article.summary}</p><div className="article-byline"><span>NewsOS Editorial System</span><span>{article.published_at?new Date(article.published_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}):""}{article.updated_at?` · Updated ${new Date(article.updated_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`:""}</span></div><form className="article-action" action={toggleSavedArticle}><input type="hidden" name="articleId" value={article.id}/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="saved" value={saved?"true":"false"}/><button className="secondary">{saved?"Remove from saved":"Save story"}</button></form><TrustPanel sourceCount={sourceRows.length} primaryCount={primary} lastVerified={article.last_verified_at} corrections={corrections.length}/><ArticleBody mdx={article.body_mdx}/><ReadCompleteBeacon articleId={article.id}/><AskNews articleId={article.id}/><section className="sources"><h2>Sources & provenance</h2>{sourceRows.length?sourceRows.map((s:any)=><a key={s.id} href={s.canonical_url} rel="noreferrer" target="_blank"><strong>{s.title||s.sources?.name||s.canonical_url}</strong><span>{s.sources?.domain} · {s.sources?.source_type}</span></a>):<p>No public source links are available for this article.</p>}</section>{corrections.length>0&&<section className="corrections"><h2>Corrections</h2>{corrections.map((c:any,i:number)=><div key={i}><strong>{c.reason}</strong>{c.previous_value&&<p><strong>Previous:</strong> {c.previous_value}</p>}<p><strong>Corrected:</strong> {c.corrected_value}</p>{c.published_at&&<time>{new Date(c.published_at).toLocaleString('en-IN')}</time>}</div>)}</section>}</article></main>;
}
