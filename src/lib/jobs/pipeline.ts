import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { enqueueJob, ensureSourceForUrl, getGlobalAutomationConfig, upsertDiscoveredUrl } from "@/lib/db/admin-repository";
import { fetchFeed } from "@/lib/rss/fetch-feed";
import { TavilyClient } from "@/lib/tavily/client";
import { OpenAICompatibleProvider } from "@/lib/ai/provider";
import { getActivePrompt, renderPrompt } from "@/lib/ai/prompts";
import { stableHash } from "@/core/url";
import { shouldCluster, tokenSetSimilarity } from "@/core/dedupe";
import { scoreNewsworthiness, DEFAULT_NEWSWORTHINESS_WEIGHTS } from "@/core/newsworthiness";
import { evaluateAutonomy, isHighRiskCategory } from "@/core/autonomy";
import { AveiroPublishingAdapter } from "@/lib/publishing/aveiro";
import { retryDelayMs, shouldDeadLetter, makeIdempotencyKey } from "@/core/jobs";
import { isJobAllowedByFlags } from "@/core/automation-flags";
import { classifyBudget, shouldDeferForBudget } from "@/core/budget";
import { estimateTavilyCost } from "@/core/costs";
import { getOptionalIntegrationEnv } from "@/config/env";
import type { StorySignalInput } from "@/domain/types";
import { composeStructuredDraft, sourceVersion, validateClaimCandidates } from "@/core/evidence";
import { logger } from "@/lib/observability/logger";

const db = () => createAdminSupabaseClient();

async function loadDailyBudgetSnapshot(client: ReturnType<typeof createAdminSupabaseClient>, dailyBudget: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [{ data: tavilyCost }, { data: llmCost }, { data: apiCost }] = await Promise.all([
    client.from("tavily_usage").select("estimated_cost_usd").gte("created_at", today.toISOString()),
    client.from("llm_usage").select("estimated_cost_usd").gte("created_at", today.toISOString()),
    client.from("api_usage").select("estimated_cost_usd").gte("created_at", today.toISOString()),
  ]);
  const spend = [...(tavilyCost ?? []), ...(llmCost ?? []), ...(apiCost ?? [])]
    .reduce((sum: number, row: any) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  const state = classifyBudget(spend, dailyBudget);
  return { spend, dailyBudget, state, budgetExceeded: state === "EXHAUSTED", conserving: state === "CONSERVE" };
}

async function logTavily(operation: string, storyId: string | null, started: number, success: boolean) {
  const pricing = getOptionalIntegrationEnv();
  const estimatedCostUsd = estimateTavilyCost(operation, { search: pricing.tavilySearchCostUsd, extract: pricing.tavilyExtractCostUsd, crawl: pricing.tavilyCrawlCostUsd, research: pricing.tavilyResearchCostUsd });
  await db().from("tavily_usage").insert({ operation, story_id: storyId, latency_ms: Date.now()-started, success, estimated_cost_usd: estimatedCostUsd });
}

async function logApiUsage(provider: string, operation: string, started: number, success: boolean) {
  await db().from("api_usage").insert({ provider, operation, success, latency_ms: Date.now() - started, estimated_cost_usd: null });
}

async function handleFetchFeed(payload: any) {
  const client = db();
  const { data: feed, error } = await client.from("feeds").select("*").eq("id", payload.feedId).single();
  if (error) throw error;
  try {
    const result = await fetchFeed(feed.url, { etag: feed.etag, lastModified: feed.last_modified });
    await client.from("feeds").update({ etag: result.etag, last_modified: result.lastModified, last_fetched_at: new Date().toISOString(), last_status: result.status, failure_count: 0, last_error: null }).eq("id", feed.id);
    for (const item of result.items) {
      const discovered = await upsertDiscoveredUrl(item.url, "RSS", { title: item.title, publishedAt: item.publishedAt, feedId: feed.id });
      await enqueueJob("EXTRACT_DOCUMENT", makeIdempotencyKey("extract", [discovered.id]), { discoveredUrlId: discovered.id });
    }
    return { discovered: result.items.length };
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    await client.from("feeds").update({ last_fetched_at: new Date().toISOString(), failure_count: Number(feed.failure_count ?? 0) + 1, last_error: message.slice(0,2000) }).eq("id", feed.id);
    throw failure;
  }
}

async function handleDiscoverTavily(payload: any) {
  const started = Date.now();
  const tavily = new TavilyClient();
  try {
    const results = await tavily.search(String(payload.query), { maxResults: payload.maxResults ?? 8 });
    for (const result of results) {
      const discovered = await upsertDiscoveredUrl(result.url, "TAVILY_SEARCH", { title: result.title, score: result.score, query: payload.query });
      await enqueueJob("EXTRACT_DOCUMENT", makeIdempotencyKey("extract", [discovered.id]), { discoveredUrlId: discovered.id });
    }
    await logTavily("SEARCH", null, started, true);
    return { discovered: results.length };
  } catch (error) {
    await logTavily("SEARCH", null, started, false);
    throw error;
  }
}

async function handleCrawlWatchlist(payload: any) {
  const client = db();
  const { data: watchlist, error } = await client.from("source_watchlists").select("*").eq("id", payload.watchlistId).single();
  if (error) throw error;
  if (watchlist.kind !== "CRAWL_URL" || !watchlist.url) throw new Error("Watchlist is not a crawl URL");
  const started = Date.now();
  const tavily = new TavilyClient();
  try {
    const result = await tavily.crawl(watchlist.url, watchlist.instructions ?? undefined);
    let discoveredCount = 0;
    for (const page of result.results ?? []) {
      const discovered = await upsertDiscoveredUrl(page.url, "TAVILY_CRAWL", { title: page.title, watchlistId: watchlist.id });
      discoveredCount++;
      if (page.raw_content) {
        const source = await ensureSourceForUrl(page.url);
        const contentHash = stableHash(page.raw_content);
        const { data: document, error: writeError } = await client.from("source_documents").upsert({ discovered_url_id: discovered.id, source_id: source.id, title: page.title ?? page.url, canonical_url: discovered.normalized_url, content_text: page.raw_content, content_hash: contentHash, extraction_provider: "TAVILY_CRAWL", extraction_quality: 0.8, http_status: 200 }, { onConflict: "discovered_url_id,content_hash" }).select("id").single();
        if (writeError) throw writeError;
        await enqueueJob("CLUSTER_SOURCE", makeIdempotencyKey("cluster", [document.id]), { documentId: document.id });
      } else {
        await enqueueJob("EXTRACT_DOCUMENT", makeIdempotencyKey("extract", [discovered.id]), { discoveredUrlId: discovered.id });
      }
    }
    await client.from("source_watchlists").update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", watchlist.id);
    await logTavily("CRAWL", null, started, true);
    return { discovered: discoveredCount };
  } catch (error) {
    await logTavily("CRAWL", null, started, false);
    throw error;
  }
}

async function handleExtractDocument(payload: any) {
  const client = db();
  const { data: discovered, error } = await client.from("discovered_urls").select("*").eq("id", payload.discoveredUrlId).single();
  if (error) throw error;
  const started = Date.now();
  const tavily = new TavilyClient();
  try {
    const extracted = await tavily.extract([discovered.normalized_url]);
    const page = extracted.results?.[0];
    if (!page?.raw_content) throw new Error("Tavily returned no extracted content");
    const source = await ensureSourceForUrl(discovered.normalized_url);
    const contentHash = stableHash(page.raw_content);
    const title = String(discovered.metadata?.title ?? discovered.normalized_url);
    const { data: document, error: writeError } = await client.from("source_documents").upsert({ discovered_url_id: discovered.id, source_id: source.id, title, published_at: discovered.metadata?.publishedAt ?? null, canonical_url: discovered.normalized_url, content_text: page.raw_content, content_hash: contentHash, extraction_provider: "TAVILY", extraction_quality: 0.9, http_status: 200 }, { onConflict: "discovered_url_id,content_hash" }).select("*").single();
    if (writeError) throw writeError;
    await enqueueJob("CLUSTER_SOURCE", makeIdempotencyKey("cluster", [document.id]), { documentId: document.id });
    await logTavily("EXTRACT", null, started, true);
    return { documentId: document.id };
  } catch (error) {
    await logTavily("EXTRACT", null, started, false);
    throw error;
  }
}

async function handleClusterSource(payload: any) {
  const client = db();
  const { data: document, error } = await client.from("source_documents").select("*").eq("id", payload.documentId).single();
  if (error) throw error;
  const since = new Date(Date.now()-7*24*3600_000).toISOString();
  const { data: candidates, error: candidateError } = await client.from("stories").select("id,canonical_title,first_seen_at,story_sources(source_documents(content_hash,canonical_url))").gte("last_seen_at", since).neq("status", "REJECTED").limit(100);
  if (candidateError) throw candidateError;

  let embedding: number[] | null = null;
  const semanticScores = new Map<string, number>();
  try {
    const model = new OpenAICompatibleProvider();
    const result = await model.embed([`${document.title ?? ""}\n${String(document.content_text ?? "").slice(0,6000)}`]);
    await client.from("llm_usage").insert({ provider: result.provider, model: result.model, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, estimated_cost_usd: result.estimatedCostUsd });
    if (result.value[0]?.length === 1536) {
      embedding = result.value[0];
      const { data: matches } = await client.rpc("match_story_embeddings", { query_embedding: embedding, match_threshold: 0.72, match_count: 20 });
      for (const row of matches ?? []) semanticScores.set(row.story_id, Number(row.similarity));
    }
  } catch {
    // Embeddings are optional. Deterministic URL/hash/title/time signals still run.
  }

  let best: any = null;
  let bestScore = 0;
  for (const candidate of candidates ?? []) {
    if (!candidate.canonical_title || !document.title) continue;
    const linked = (candidate.story_sources ?? []).map((r:any)=>r.source_documents).filter(Boolean);
    const sameContentHash = linked.some((d:any)=>d.content_hash && d.content_hash === document.content_hash);
    const sameCanonicalUrl = linked.some((d:any)=>d.canonical_url === document.canonical_url);
    const titleSimilarity = tokenSetSimilarity(document.title, candidate.canonical_title);
    const hoursApart = Math.abs(Date.parse(document.published_at ?? document.fetched_at) - Date.parse(candidate.first_seen_at))/3600_000;
    const embeddingSimilarity = semanticScores.get(candidate.id);
    const signals = { sameCanonicalUrl, sameContentHash, titleSimilarity, entityOverlap: 0, embeddingSimilarity, hoursApart };
    const clustered = shouldCluster(signals, 0.72);
    const score = sameCanonicalUrl || sameContentHash ? 1 : titleSimilarity * .45 + (embeddingSimilarity ?? 0) * .4 + Math.max(0,1-hoursApart/168)*.15;
    if (clustered && score > bestScore) { best = candidate; bestScore = score; }
  }

  let storyId = best?.id;
  if (!storyId) {
    const { data: story, error: storyError } = await client.from("stories").insert({ status: "CLUSTERED", canonical_title: document.title, first_seen_at: document.published_at ?? document.fetched_at, last_seen_at: document.fetched_at }).select("*").single();
    if (storyError) throw storyError;
    storyId = story.id;
  }
  await client.from("story_sources").upsert({ story_id: storyId, document_id: document.id, relationship: "REPORTS" }, { onConflict: "story_id,document_id" });
  if (embedding) await client.from("story_embeddings").upsert({ story_id: storyId, embedding, model: "configured-embedding-model", content_hash: stableHash(`${document.title ?? ""}:${document.content_hash ?? ""}`), updated_at: new Date().toISOString() }, { onConflict: "story_id" });
  await client.from("stories").update({ last_seen_at: new Date().toISOString(), status: "CLUSTERED" }).eq("id", storyId);
  await enqueueJob("SCORE_STORY", makeIdempotencyKey("score", [storyId]), { storyId });
  return { storyId, clustered: Boolean(best), score: bestScore };
}

async function handleScoreStory(payload: any) {
  const client = db();
  const { data: links, error } = await client.from("story_sources").select("relationship,source_documents(source_id,published_at,sources(authority_score,source_type,primary_source_capability))").eq("story_id", payload.storyId);
  if (error) throw error;
  const rows = links ?? [];
  const authorities = rows.map((r: any) => Number(r.source_documents?.sources?.authority_score ?? 0.5));
  const latest = Math.max(...rows.map((r: any) => Date.parse(r.source_documents?.published_at ?? 0)), 0);
  const recencyHours = latest ? Math.max(0,(Date.now()-latest)/3600_000) : 168;
  const raw: StorySignalInput = {
    sourceCount: Math.min(1, rows.length/4),
    sourceAuthority: authorities.length ? authorities.reduce((a:number,b:number)=>a+b,0)/authorities.length : 0.5,
    primarySourcePresence: rows.some((r:any)=>r.relationship==='PRIMARY_EVIDENCE'||r.source_documents?.sources?.primary_source_capability) ? 1 : 0,
    recency: Math.max(0,1-recencyHours/72),
    subjectImportance: 0.5,
    eventMagnitude: 0.5,
    geographicRelevance: 0.5,
    novelty: 0.6,
    readerInterest: 0.5,
    socialSignal: 0.2,
  };
  const config = await getGlobalAutomationConfig();
  const configuredWeights = config.config["newsworthiness.weights"] as Record<keyof StorySignalInput, number> | undefined;
  const weights = configuredWeights && Object.values(configuredWeights).every((v:any)=>Number.isFinite(Number(v))) ? Object.fromEntries(Object.entries(configuredWeights).map(([k,v])=>[k,Number(v)])) as Record<keyof StorySignalInput,number> : DEFAULT_NEWSWORTHINESS_WEIGHTS;
  const result = scoreNewsworthiness(raw, weights);
  await client.from("newsworthiness_scores").insert({ story_id: payload.storyId, score: result.score, raw_signals: raw, weights, components: result.components });
  await client.from("stories").update({ newsworthiness_score: result.score }).eq("id", payload.storyId);
  if (result.score >= 45) await enqueueJob("RESEARCH_STORY", makeIdempotencyKey("research", [payload.storyId]), { storyId: payload.storyId });
  return result;
}

async function loadStoryResearch(storyId: string) {
  const client = db();
  const [{ data: story, error }, { data: sources, error: sourceError }] = await Promise.all([
    client.from("stories").select("*").eq("id", storyId).single(),
    client.from("story_sources").select("relationship,source_documents(id,title,canonical_url,content_text,published_at,source_id,sources(name,domain,source_type,authority_score,primary_source_capability))").eq("story_id", storyId),
  ]);
  if (error) throw error; if (sourceError) throw sourceError;
  return { story, sources: sources ?? [] };
}

async function handleResearchStory(payload: any) {
  const client = db();
  const { story, sources } = await loadStoryResearch(payload.storyId);
  await client.from("stories").update({ status: "RESEARCHING" }).eq("id", story.id);
  const tavily = new TavilyClient();
  if ((sources?.length ?? 0) < 2 && story.canonical_title) {
    const started = Date.now();
    try {
      const results = await tavily.search(story.canonical_title, { maxResults: 5 });
      for (const result of results) {
        const discovered = await upsertDiscoveredUrl(result.url, "TAVILY_CORROBORATION", { title: result.title, storyId: story.id });
        await enqueueJob("EXTRACT_DOCUMENT", makeIdempotencyKey("extract", [discovered.id]), { discoveredUrlId: discovered.id });
      }
      await logTavily("SEARCH_CORROBORATION", story.id, started, true);
    } catch (error) { await logTavily("SEARCH_CORROBORATION", story.id, started, false); throw error; }
  }
  if (Number(story.newsworthiness_score ?? 0) >= 75 && story.canonical_title) {
    const started = Date.now();
    try {
      const research = await tavily.research(`Investigate this technology/business news story using independent sources and primary evidence where possible: ${story.canonical_title}`);
      await logTavily("RESEARCH", story.id, started, true);
      await client.from("audit_logs").insert({ action: "TAVILY_RESEARCH_RESULT", target_type: "story", target_id: story.id, after_data: { snapshot: JSON.stringify(research).slice(0,10000) } });
    } catch (error) { await logTavily("RESEARCH", story.id, started, false); throw error; }
  }
  await enqueueJob("EXTRACT_CLAIMS", makeIdempotencyKey("claims", [story.id, stableHash(JSON.stringify(sources.map((r:any)=>[r.source_documents.id,sourceVersion(String(r.source_documents.content_text??""))]).sort()))]), { storyId: story.id });
  return { storyId: story.id, sourceCount: sources.length };
}

async function handleExtractClaims(payload: any) {
  const client = db();
  const flags = await getGlobalAutomationConfig();
  if (flags.flags.evidence_draft_workflow !== true) throw new Error("Evidence draft workflow paused");
  const { story, sources } = await loadStoryResearch(payload.storyId);
  const documents = sources.map((row: any) => ({ id: row.source_documents.id, content: String(row.source_documents.content_text ?? "") }));
  if (!documents.length) throw new Error("Cannot extract claims without source documents");
  const provider = new OpenAICompatibleProvider();
  const promptVersion = await getActivePrompt("extract_claims");
  const sourceBlock = documents.map(d => JSON.stringify({ id: d.id, sourceVersion: sourceVersion(d.content), content: Array.from(d.content).slice(0, 12000).join("") })).join("\n");
  const result = await provider.generateJson<unknown>({ system: promptVersion.system, prompt: renderPrompt(promptVersion.user, { storyTitle: story.canonical_title ?? "Untitled", sourceBlock }), schemaName: "passage_claims_v2" });
  const candidates = validateClaimCandidates(result.value, documents);
  const inputHash = sourceVersion(JSON.stringify(documents.map(d => ({ id: d.id, version: sourceVersion(d.content) })).sort((a,b) => a.id.localeCompare(b.id))));
  const { data, error } = await client.rpc("store_claim_candidates", { p_story_id: story.id, p_input_hash: inputHash, p_claims: candidates.claims });
  if (error) throw error;
  // Candidate passages are not entailment proof. Only human review can promote them.
  const { data: aiRun, error: logError } = await client.from("ai_runs").insert({ story_id: story.id, operation: "EXTRACT_CLAIMS", provider: result.provider, model: result.model, prompt_version_id: promptVersion.id, input_hash: inputHash, output_json: { claimSetId: data, claimsCreated: candidates.claims.length, humanReviewRequired: true }, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, latency_ms: result.latencyMs, estimated_cost_usd: result.estimatedCostUsd, success: true }).select("id").single();
  if (logError) throw logError;
  const { error: usageError } = await client.from("llm_usage").insert({ ai_run_id: aiRun.id, provider: result.provider, model: result.model, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, estimated_cost_usd: result.estimatedCostUsd });
  if (usageError) throw usageError;
  return { claimSetId: data, humanReviewRequired: true };
}

async function handleGenerateArticle(payload: any) {
  const client = db();
  const flags = await getGlobalAutomationConfig();
  if (flags.flags.evidence_draft_workflow !== true) throw new Error("Evidence draft workflow paused");
  const { data: story, error } = await client.from("stories").select("*").eq("id", payload.storyId).single();
  if (error) throw error;
  if (!story.active_claim_set_id) throw new Error("No versioned claim set");
  const { data: claims, error: claimError } = await client.from("claims").select("id,claim_text,status").eq("story_id", story.id).eq("claim_set_id", story.active_claim_set_id).in("status", ["SUPPORTED","MULTI_SOURCE_SUPPORTED","PRIMARY_SOURCE_VERIFIED"]);
  if (claimError) throw claimError;
  if (!claims?.length) throw new Error("No human-reviewed claims available");
  const { data: previous, error: previousError } = await client.from("articles").select("id,revision,status").eq("story_id", story.id).maybeSingle();
  if (previousError) throw previousError;
  if (previous && ["PUBLISHED","CORRECTED"].includes(previous.status)) throw new Error("Published articles require correction workflow");
  const provider = new OpenAICompatibleProvider();
  const template = await getActivePrompt("draft_article");
  const result = await provider.generateJson<unknown>({ system: template.system, prompt: renderPrompt(template.user, { storyTitle: story.canonical_title ?? "Untitled", verifiedClaims: JSON.stringify(claims) }), schemaName: "structured_article_v2" });
  const content = composeStructuredDraft(result.value, claims);
  // Worker writes carry the revision observed before the external model call.
  let article = previous;
  if (!article) {
    const { data: inserted, error: insertError } = await client.from("articles").insert({ story_id: story.id, slug: `story-${story.id}`, headline: content.headline, status: "DRAFT", category: content.category }).select("id,revision,status").single();
    if (insertError) throw insertError;
    article = inserted;
  }
  const { error: saveError } = await client.rpc("save_generated_draft", { p_article_id: article!.id, p_expected_revision: article!.revision, p_claim_set_id: story.active_claim_set_id, p_content: content });
  if (saveError) throw saveError;
  const { data: aiRun, error: logError } = await client.from("ai_runs").insert({ story_id: story.id, article_id: article!.id, operation: "DRAFT_ARTICLE", provider: result.provider, model: result.model, prompt_version_id: template.id, output_json: { structured: true }, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, latency_ms: result.latencyMs, estimated_cost_usd: result.estimatedCostUsd, success: true }).select("id").single();
  if (logError) throw logError;
  const { error: usageError } = await client.from("llm_usage").insert({ ai_run_id: aiRun.id, provider: result.provider, model: result.model, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, estimated_cost_usd: result.estimatedCostUsd });
  if (usageError) throw usageError;
  return handleQualityCheck({ articleId: article!.id });
}

async function handleVerifyEditedArticle(payload: any) { return handleQualityCheck(payload); }
async function handleVerifyCorrection(payload: any) {
  const client = db();
  const { data, error } = await client.rpc("check_correction_gate", { p_correction_id: payload.correctionId });
  if (error) throw error;
  return data;
}
async function handleQualityCheck(payload: any) {
  const client = db();
  const { data, error } = await client.rpc("refresh_article_gate", { p_article_id: payload.articleId });
  if (error) throw error;
  return data;
}

async function handleEvaluateAutonomy(payload: any) {
  const client = db();
  const [{ data: article, error }, config] = await Promise.all([client.from("articles").select("*,stories(confidence_score)").eq("id", payload.articleId).single(), getGlobalAutomationConfig()]);
  if (error) throw error;
  const dailyBudget = Number(config.config["cost.daily_budget_usd"] ?? 25);
  const budget = await loadDailyBudgetSnapshot(client, dailyBudget);
  const [{ data: sourceRows }, { count: citations }, { data: conflicted }] = await Promise.all([
    client.from("story_sources").select("source_documents(sources(source_type))").eq("story_id", article.story_id),
    client.from("article_citations").select("id", { count: "exact", head: true }).eq("article_id", article.id),
    client.from("claims").select("id").eq("story_id", article.story_id).eq("status", "CONFLICTED"),
  ]);
  const sourceTypes = (sourceRows ?? []).map((r:any)=>r.source_documents?.sources?.source_type).filter(Boolean);
  const sourceTier = sourceTypes.includes("PRIMARY") ? "PRIMARY" : sourceTypes.includes("REGULATOR") ? "REGULATOR" : "OTHER";
  const category = String(article.category ?? "uncategorized").toLowerCase();
  const highRisk = isHighRiskCategory(category);
  const decision = evaluateAutonomy({ confidence: Number(article.stories?.confidence_score ?? 0), category, sourceTier, unresolvedContradictions: conflicted?.length ?? 0, provenanceComplete: Boolean(citations), qualityGatePassed: article.status === "REVIEW", globalPause: Boolean(config.config["automation.global_pause"]), autoPublishEnabled: false, shadowMode: config.config["automation.shadow_mode"] !== false, highRisk, approvedCategories: Array.isArray(config.config["autonomy.approved_categories"]) ? config.config["autonomy.approved_categories"] as string[] : ["ai","technology","startups","funding","developer-tools"], approvedSourceTiers: Array.isArray(config.config["autonomy.approved_source_tiers"]) ? config.config["autonomy.approved_source_tiers"] as string[] : ["PRIMARY","REGULATOR"], minimumConfidence: Number(config.config["confidence.minimum_auto_publish"] ?? 90), budgetAvailable: budget.state !== "EXHAUSTED" });
  const reason = { sourceTier, highRisk, citations, conflictedClaims: conflicted?.length ?? 0, qualityGatePassed: article.status === "REVIEW", autoPublishEnabled: false, shadowMode: config.config["automation.shadow_mode"] !== false, budgetState: budget.state, estimatedSpendToday: budget.spend, dailyBudget: budget.dailyBudget };
  await client.from("autonomy_decisions").insert({ article_id: article.id, system_decision: decision, system_reason: reason, confidence: Number(article.stories?.confidence_score ?? 0) });
  await client.from("audit_logs").insert({ action: "AUTONOMY_DECISION", target_type: "article", target_id: article.id, after_data: { decision, ...reason } });
  return { decision };
}

async function handlePublishArticle(payload: any) {
  const client = db();
  const { data: article, error: articleError } = await client.from("articles").select("*").eq("id", payload.articleId).single();
  if (articleError) throw articleError;
  if (article.status === "SCHEDULED" && article.scheduled_for && Date.parse(article.scheduled_for) > Date.now()) throw new Error("Scheduled article is not due yet");
  const { data, error } = await client.rpc("publish_article_revision", { p_article_id: payload.articleId, p_actor_id: payload.actorId ?? article.reviewer_id ?? null, p_expected_revision: payload.expectedRevision ?? null });
  if (error) throw error;
  const config = await getGlobalAutomationConfig();
  if (config.flags.aveiro_sync) await enqueueJob("SYNC_AVEIRO", makeIdempotencyKey("aveiro", [payload.articleId]), { articleId: payload.articleId });
  if (config.flags.newsletter_generation) await enqueueJob("GENERATE_NEWSLETTER", makeIdempotencyKey("newsletter", [payload.articleId]), { articleId: payload.articleId });
  if (config.flags.social_generation) await enqueueJob("GENERATE_SOCIAL", makeIdempotencyKey("social", [payload.articleId]), { articleId: payload.articleId });
  await enqueueJob("UPDATE_COMPANY_TIMELINE", makeIdempotencyKey("company-timeline", [payload.articleId]), { articleId: payload.articleId });
  return data;
}

async function handleSyncAveiro(payload: any) {
  const client = db();
  const started = Date.now();
  const { data: article, error } = await client.from("articles").select("*").eq("id", payload.articleId).single(); if (error) throw error;
  const adapter = new AveiroPublishingAdapter();
  const { data: existing } = await client.from("distribution_outputs").select("*").eq("article_id", article.id).eq("channel", "AVEIRO_PAGE").maybeSingle();
  const input = { slug: article.slug, title: article.headline, summary: article.summary, mdx: article.body_mdx, metadata: { category: article.category, publishedAt: article.published_at, lastVerifiedAt: article.last_verified_at } };
  try {
    const draft = existing?.external_id ? await adapter.updateDraft(existing.external_id, input) : await adapter.createDraft(input);
    await client.from("distribution_outputs").upsert({ article_id: article.id, channel: "AVEIRO_PAGE", external_id: draft.id, external_path: draft.path, status: "SYNCED", idempotency_key: `aveiro:${article.id}`, last_synced_at: new Date().toISOString(), metadata: { editorUrl: draft.editorUrl } }, { onConflict: "idempotency_key" });
    await logApiUsage("AVEIRO", "PAGE_DRAFT_SYNC", started, true);
    return draft;
  } catch (error) {
    await client.from("distribution_outputs").upsert({ article_id: article.id, channel: "AVEIRO_PAGE", status: "FAILED", idempotency_key: `aveiro:${article.id}`, last_error: error instanceof Error ? error.message : String(error) }, { onConflict: "idempotency_key" });
    await logApiUsage("AVEIRO", "PAGE_DRAFT_SYNC", started, false);
    throw error;
  }
}

async function handleGenerateNewsletter(payload: any) {
  const client = db();
  const started = Date.now();
  const { data: article, error } = await client.from("articles").select("*").eq("id", payload.articleId).single();
  if (error) throw error;
  const adapter = new AveiroPublishingAdapter();
  const result = await adapter.createNewsletterDraft({ subject: article.headline, previewText: article.summary ?? undefined, html: `<h1>${article.headline}</h1><p>${article.summary ?? ""}</p><p>Read the verified story on NewsOS.</p>`, idempotencyKey: `newsletter:${article.id}` });
  await logApiUsage("AVEIRO", "NEWSLETTER_DRAFT", started, true);
  await client.from("distribution_outputs").upsert({ article_id: article.id, channel: "NEWSLETTER", external_id: String((result as any)?.id ?? ""), status: "REVIEW", idempotency_key: `newsletter:${article.id}`, last_synced_at: new Date().toISOString(), metadata: result as any }, { onConflict: "idempotency_key" });
  return result;
}

async function handleGenerateSocial(payload: any) {
  const client = db();
  const started = Date.now();
  const { data: article, error } = await client.from("articles").select("*").eq("id", payload.articleId).single();
  if (error) throw error;
  const adapter = new AveiroPublishingAdapter();
  const text = `${article.headline}\n\n${article.summary ?? ""}`.slice(0,1800);
  const result = await adapter.createSocialDraft({ text, idempotencyKey: `social:${article.id}` });
  await logApiUsage("AVEIRO", "SOCIAL_DRAFT", started, true);
  await client.from("distribution_outputs").upsert({ article_id: article.id, channel: "SOCIAL", external_id: String((result as any)?.id ?? ""), status: "REVIEW", idempotency_key: `social:${article.id}`, last_synced_at: new Date().toISOString(), metadata: result as any }, { onConflict: "idempotency_key" });
  return result;
}

async function handleUpdateCompanyTimeline(payload: any) {
  const client = db();
  const { data: article, error } = await client.from("articles").select("id,story_id,headline,published_at").eq("id", payload.articleId).single(); if (error) throw error;
  const { data: entities, error: entityError } = await client.from("story_entities").select("entity_id,entities(entity_type),companies(id)").eq("story_id", article.story_id); if (entityError) throw entityError;
  let count = 0;
  for (const row of entities ?? []) {
    if ((row as any).entities?.entity_type !== "COMPANY") continue;
    await client.from("company_timeline").upsert({ company_id: row.entity_id, story_id: article.story_id, event_type: "NEWS", headline: article.headline, event_at: article.published_at ?? new Date().toISOString(), verified_at: new Date().toISOString() }, { onConflict: "company_id,story_id,event_type" });
    count++;
  }
  return { companiesUpdated: count };
}

export const JOB_HANDLERS: Record<string, (payload: any) => Promise<unknown>> = {
  FETCH_FEED: handleFetchFeed,
  DISCOVER_TAVILY: handleDiscoverTavily,
  CRAWL_WATCHLIST: handleCrawlWatchlist,
  EXTRACT_DOCUMENT: handleExtractDocument,
  CLUSTER_SOURCE: handleClusterSource,
  SCORE_STORY: handleScoreStory,
  RESEARCH_STORY: handleResearchStory,
  EXTRACT_CLAIMS: handleExtractClaims,
  GENERATE_ARTICLE: handleGenerateArticle,
  VERIFY_EDITED_ARTICLE: handleVerifyEditedArticle,
  VERIFY_CORRECTION: handleVerifyCorrection,
  QUALITY_CHECK: handleQualityCheck,
  EVALUATE_AUTONOMY: handleEvaluateAutonomy,
  PUBLISH_ARTICLE: handlePublishArticle,
  SYNC_AVEIRO: handleSyncAveiro,
  GENERATE_NEWSLETTER: handleGenerateNewsletter,
  GENERATE_SOCIAL: handleGenerateSocial,
  UPDATE_COMPANY_TIMELINE: handleUpdateCompanyTimeline,
};

export async function scheduleDueWork() {
  const client = db();
  const config = await getGlobalAutomationConfig();
  const paused = Boolean(config.config["automation.global_pause"]);
  if (paused) return { queued: 0, paused: true };
  const now = Date.now();
  let queued = 0;
  const { data: feeds, error: feedError } = await client.from("feeds").select("id,last_fetched_at,interval_minutes").eq("enabled", true).limit(500);
  if (feedError) throw feedError;
  for (const feed of feeds ?? []) {
    if (!isJobAllowedByFlags("FETCH_FEED", config.flags, false)) break;
    const last = feed.last_fetched_at ? Date.parse(feed.last_fetched_at) : 0;
    const feedInterval = Math.max(5,Number(feed.interval_minutes ?? 10))*60_000;
    if (now - last < feedInterval) continue;
    const bucket = Math.floor(now/feedInterval);
    await enqueueJob("FETCH_FEED", makeIdempotencyKey("scheduled-feed", [feed.id,bucket]), { feedId: feed.id });
    queued++;
  }
  const { data: watchlists, error: watchError } = await client.from("source_watchlists").select("*").eq("enabled", true).limit(500);
  if (watchError) throw watchError;
  for (const watch of watchlists ?? []) {
    const watchJob = watch.kind === "TAVILY_QUERY" ? "DISCOVER_TAVILY" : "CRAWL_WATCHLIST";
    if (!isJobAllowedByFlags(watchJob, config.flags, false)) continue;
    const intervalMs = Number(watch.interval_minutes)*60_000;
    const last = watch.last_run_at ? Date.parse(watch.last_run_at) : 0;
    if (now - last < intervalMs) continue;
    const bucket = Math.floor(now/intervalMs);
    if (watch.kind === "TAVILY_QUERY") await enqueueJob("DISCOVER_TAVILY", makeIdempotencyKey("watch-query", [watch.id,bucket]), { query: watch.query, watchlistId: watch.id });
    else await enqueueJob("CRAWL_WATCHLIST", makeIdempotencyKey("watch-crawl", [watch.id,bucket]), { watchlistId: watch.id });
    await client.from("source_watchlists").update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", watch.id);
    queued++;
  }
  const { data: due, error: dueError } = await client.from("articles").select("id,revision").eq("status", "SCHEDULED").lte("scheduled_for", new Date().toISOString()).limit(100);
  if (dueError) throw dueError;
  for (const article of due ?? []) {
    await enqueueJob("PUBLISH_ARTICLE", makeIdempotencyKey("scheduled-publish", [article.id,article.revision]), { articleId: article.id, expectedRevision: article.revision });
    queued++;
  }
  return { queued };
}

export async function runJobBatch(limit = 10) {
  const client = db();
  const config = await getGlobalAutomationConfig();
  const globalPaused = Boolean(config.config["automation.global_pause"]);
  const dailyBudget = Number(config.config["cost.daily_budget_usd"] ?? 25);
  const budget = await loadDailyBudgetSnapshot(client, dailyBudget);

  const { data: automationRun } = await client.from("automation_runs").insert({ automation: "newsos_worker", status: "RUNNING", metadata: { spend: budget.spend, dailyBudget: budget.dailyBudget, budgetState: budget.state, budgetExceeded: budget.budgetExceeded, conserving: budget.conserving, globalPaused } }).select("id").single();
  const { data: jobs, error } = await client.rpc("claim_job_batch", { batch_size: limit });
  if (error) throw error;
  let processed = 0;
  for (const job of jobs ?? []) {
    const handler = JOB_HANDLERS[job.job_type];
    const jobStarted = Date.now();
    try {
      const manual = Boolean(job.payload?.manual);
      logger.info({ jobId: job.id, jobType: job.job_type, attempt: job.attempt, storyId: job.payload?.storyId, articleId: job.payload?.articleId, manual, budgetState: budget.state }, "job_started");
      if (!manual && shouldDeferForBudget(job.job_type, budget.state)) {
        const reason = budget.state === "EXHAUSTED" ? "Daily cost budget reached; paid job deferred" : "Daily cost budget at conservation threshold; optional job deferred";
        await client.from("job_runs").update({ status: "QUEUED", error_message: reason, next_attempt_at: new Date(Date.now()+60*60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
        continue;
      }
      if (!isJobAllowedByFlags(job.job_type, config.flags, globalPaused, manual)) {
        const reason = globalPaused ? "Global automation pause active; automated job deferred" : "Feature flag disabled; automated job deferred";
        await client.from("job_runs").update({ status: "QUEUED", error_message: reason, next_attempt_at: new Date(Date.now()+60*60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
        continue;
      }
      if (!handler) throw new Error(`No job handler for ${job.job_type}`);
      const result = await handler(job.payload);
      await client.from("job_runs").update({ status: "SUCCEEDED", result, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
      logger.info({ jobId: job.id, jobType: job.job_type, attempt: job.attempt, storyId: job.payload?.storyId, articleId: job.payload?.articleId, durationMs: Date.now() - jobStarted, status: "SUCCEEDED" }, "job_finished");
    } catch (error) {
      const envelope = { id: job.id, type: job.job_type, idempotencyKey: job.idempotency_key, attempt: job.attempt, maxAttempts: job.max_attempts, payload: job.payload, createdAt: job.created_at };
      const dead = shouldDeadLetter(envelope);
      const message = error instanceof Error ? error.message : String(error);
      await client.from("job_runs").update({ status: dead ? "DEAD_LETTER" : "QUEUED", error_message: message, finished_at: dead ? new Date().toISOString() : null, next_attempt_at: dead ? null : new Date(Date.now()+retryDelayMs(job.attempt)).toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
      if (dead) await client.from("dead_letters").upsert({ job_run_id: job.id, reason: message, payload: job.payload }, { onConflict: "job_run_id" });
      logger.error({ jobId: job.id, jobType: job.job_type, attempt: job.attempt, storyId: job.payload?.storyId, articleId: job.payload?.articleId, durationMs: Date.now() - jobStarted, status: dead ? "DEAD_LETTER" : "QUEUED_RETRY", error: message }, "job_failed");
    }
    processed++;
  }
  if (automationRun) await client.from("automation_runs").update({ status: "SUCCEEDED", finished_at: new Date().toISOString(), items_processed: processed, metadata: { spend: budget.spend, dailyBudget: budget.dailyBudget, budgetState: budget.state, budgetExceeded: budget.budgetExceeded, conserving: budget.conserving, globalPaused } }).eq("id", automationRun.id);
  return { paused: globalPaused, processed, budgetState: budget.state, budgetExceeded: budget.budgetExceeded, conserving: budget.conserving, estimatedSpendToday: budget.spend };
}

