import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getPublishedArticles(limit = 30) {
  const db = await createServerSupabaseClient();
  const { data, error } = await db.from("articles").select("id,slug,headline,summary,category,published_at,last_verified_at,story_id").in("status", ["PUBLISHED","CORRECTED"]).order("published_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPublishedArticleBySlug(slug: string) {
  const db = await createServerSupabaseClient();
  const { data: article, error } = await db.from("articles").select("*").eq("slug", slug).in("status", ["PUBLISHED","CORRECTED"]).maybeSingle();
  if (error) throw error;
  if (!article) return null;
  const [{ data: claims }, { data: citations }, { data: corrections }, { data: storySources }] = await Promise.all([
    db.from("claims").select("id,claim_text,status,confidence").eq("story_id", article.story_id),
    db.from("article_citations").select("claim_id,document_id,article_locator").eq("article_id", article.id),
    db.from("corrections").select("reason,previous_value,corrected_value,published_at").eq("article_id", article.id).not("published_at", "is", null).order("published_at", { ascending: false }),
    db.from("story_sources").select("relationship,source_documents(id,canonical_url,title,published_at,source_id,sources(name,domain,source_type))").eq("story_id", article.story_id),
  ]);
  return { article, claims: claims ?? [], citations: citations ?? [], corrections: corrections ?? [], storySources: storySources ?? [] };
}

export async function getCompanyBySlug(slug: string) {
  const db = await createServerSupabaseClient();
  const { data: company, error } = await db.from("companies").select("*,entities(canonical_name,aliases,metadata)").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!company) return null;
  const [{ data: timeline }, { data: funding }, { data: relations }] = await Promise.all([
    db.from("company_timeline").select("*").eq("company_id", company.id).order("event_at", { ascending: false }).limit(100),
    db.from("funding_rounds").select("*").eq("company_id", company.id).order("announced_at", { ascending: false }),
    db.from("company_relationships").select("*,entities!company_relationships_target_entity_id_fkey(canonical_name,entity_type)").eq("source_company_id", company.id),
  ]);
  const storyIds=[...new Set((timeline??[]).map((row:any)=>row.story_id).filter(Boolean))];
  let sources:any[]=[];
  if(storyIds.length){const {data}=await db.from("story_sources").select("source_documents(id,canonical_url,title,sources(domain,source_type))").in("story_id",storyIds); const seen=new Set<string>(); sources=(data??[]).map((r:any)=>r.source_documents).filter((row:any)=>row&&!seen.has(row.id)&&(seen.add(row.id),true));}
  return { company, timeline: timeline ?? [], funding: funding ?? [], relations: relations ?? [], sources };
}
