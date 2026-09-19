import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { domainOf, normalizeUrl, stableHash } from "@/core/url";

export async function enqueueJob(type: string, idempotencyKey: string, payload: Record<string, unknown>, maxAttempts = 3) {
  const db = createAdminSupabaseClient();
  const { data, error } = await db.from("job_runs").upsert({ job_type: type, idempotency_key: idempotencyKey, status: "QUEUED", payload, max_attempts: maxAttempts }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertDiscoveredUrl(originalUrl: string, channel: string, metadata: Record<string, unknown> = {}) {
  const db = createAdminSupabaseClient();
  const normalized = normalizeUrl(originalUrl);
  const urlHash = stableHash(normalized);
  const { data, error } = await db.from("discovered_urls").upsert({ normalized_url: normalized, original_url: originalUrl, url_hash: urlHash, discovery_channel: channel, last_seen_at: new Date().toISOString(), metadata }, { onConflict: "normalized_url" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function ensureSourceForUrl(url: string) {
  const db = createAdminSupabaseClient();
  const domain = domainOf(url);
  const { data: existing, error: readError } = await db.from("sources").select("*").eq("domain", domain).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  const { data, error } = await db.from("sources").insert({ name: domain, domain, source_type: "UNKNOWN", authority_score: 0.5 }).select("*").single();
  if (error) throw error;
  return data;
}

export async function recordAudit(actorId: string | null, action: string, targetType: string, targetId?: string, afterData?: unknown, beforeData?: unknown, requestId?: string) {
  const db = createAdminSupabaseClient();
  const { error } = await db.from("audit_logs").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, after_data: afterData ?? null, before_data: beforeData ?? null, request_id: requestId ?? null });
  if (error) throw error;
}

export async function getGlobalAutomationConfig() {
  const db = createAdminSupabaseClient();
  const [{ data: flags, error: fError }, { data: configs, error: cError }] = await Promise.all([
    db.from("feature_flags").select("key,enabled"),
    db.from("app_config").select("key,value"),
  ]);
  if (fError) throw fError;
  if (cError) throw cError;
  return {
    flags: Object.fromEntries((flags ?? []).map((row: any) => [row.key, row.enabled])),
    config: Object.fromEntries((configs ?? []).map((row: any) => [row.key, row.value])),
  };
}

export async function setGlobalPause(paused: boolean, actorId: string) {
  const db = createAdminSupabaseClient();
  const { error } = await db.from("app_config").upsert({ key: "automation.global_pause", value: paused, updated_by: actorId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  await recordAudit(actorId, paused ? "PAUSE_ALL_AUTOMATION" : "RESUME_AUTOMATION", "app_config", "automation.global_pause", { value: paused });
}

export async function getAdminDashboardSnapshot() {
  const db = createAdminSupabaseClient();
  const today = new Date(); today.setHours(0,0,0,0);
  const [stories, articles, jobs, tavily, llm] = await Promise.all([
    db.from("stories").select("id,status,newsworthiness_score,confidence_score,created_at", { count: "exact" }).gte("created_at", today.toISOString()).order("created_at", { ascending: false }).limit(100),
    db.from("articles").select("id,status,headline,slug,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(50),
    db.from("job_runs").select("id,status,job_type,error_message,updated_at").in("status", ["FAILED","DEAD_LETTER","QUEUED","RUNNING"]).order("updated_at", { ascending: false }).limit(50),
    db.from("tavily_usage").select("estimated_cost_usd,success").gte("created_at", today.toISOString()),
    db.from("llm_usage").select("estimated_cost_usd,input_tokens,output_tokens").gte("created_at", today.toISOString()),
  ]);
  for (const result of [stories, articles, jobs, tavily, llm]) if (result.error) throw result.error;
  const cost = [...(tavily.data ?? []), ...(llm.data ?? [])].reduce((sum: number, row: any) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  return { stories: stories.data ?? [], articles: articles.data ?? [], jobs: jobs.data ?? [], estimatedCostToday: cost };
}
