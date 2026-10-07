import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublishedSources } from "@/lib/db/public-sources";

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
  const [claimResult, citationResult, correctionResult, storySources] = await Promise.all([
    db.from("claims").select("id,claim_text,status,confidence").eq("story_id", article.story_id),
    db.from("article_citations").select("claim_id,document_id,article_locator").eq("article_id", article.id),
    db.from("corrections").select("reason,previous_value,corrected_value,published_at").eq("article_id", article.id).not("published_at", "is", null).order("published_at", { ascending: false }),
    getPublishedSources(db, [article.story_id]),
  ]);
  for (const result of [claimResult, citationResult, correctionResult]) if (result.error) throw result.error;
  const claims = claimResult.data;
  const citations = citationResult.data;
  const corrections = correctionResult.data;
  // Fail explicitly on failed provenance/claim reads rather than hiding them as empty results.
  return { article, claims: claims ?? [], citations: citations ?? [], corrections: corrections ?? [], storySources: storySources ?? [] };
}

export async function getCompanyBySlug(slug: string) {
  const db = await createServerSupabaseClient();
  const { data: company, error } = await db.from("companies").select("*,entities(canonical_name,aliases,metadata)").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!company) return null;
  const [timelineResult, fundingResult, relationResult] = await Promise.all([
    db.from("company_timeline").select("*").eq("company_id", company.id).order("event_at", { ascending: false }).limit(100),
    db.from("funding_rounds").select("*").eq("company_id", company.id).order("announced_at", { ascending: false }),
    db.from("company_relationships").select("*,entities!company_relationships_target_entity_id_fkey(canonical_name,entity_type)").eq("source_company_id", company.id),
  ]);
  for (const result of [timelineResult, fundingResult, relationResult]) if (result.error) throw result.error;
  const timeline = timelineResult.data;
  const funding = fundingResult.data;
  const relations = relationResult.data;
  const storyIds=[...new Set((timeline??[]).map((row:any)=>row.story_id).filter(Boolean))];
  let sources:any[]=[];
  if (storyIds.length) {
    const rows = await getPublishedSources(db, storyIds as string[]);
    const seen = new Set<string>();
    sources = rows.map(row => row.source_documents).filter(row => !seen.has(row.id) && Boolean(seen.add(row.id)));
  }
  return { company, timeline: timeline ?? [], funding: funding ?? [], relations: relations ?? [], sources };
}
