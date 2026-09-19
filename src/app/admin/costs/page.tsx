import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getGlobalAutomationConfig } from "@/lib/db/admin-repository";
import { classifyBudget } from "@/core/budget";
import { getOptionalIntegrationEnv } from "@/config/env";

export const dynamic = "force-dynamic";

export default async function Costs() {
  const db = createAdminSupabaseClient();
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [{ data: tavily }, { data: llm }, { data: api }, config] = await Promise.all([
    db.from("tavily_usage").select("operation,success,estimated_cost_usd,created_at").gte("created_at", since),
    db.from("llm_usage").select("model,input_tokens,output_tokens,estimated_cost_usd,created_at").gte("created_at", since),
    db.from("api_usage").select("provider,operation,success,estimated_cost_usd,created_at").gte("created_at", since),
    getGlobalAutomationConfig(),
  ]);
  const all = [...(tavily ?? []), ...(llm ?? []), ...(api ?? [])];
  const total30d = all.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  const todaySpend = all.filter((row) => Date.parse(row.created_at) >= today.getTime()).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  const dailyBudget = Number(config.config["cost.daily_budget_usd"] ?? 25);
  const state = classifyBudget(todaySpend, dailyBudget);
  const pricing = getOptionalIntegrationEnv();
  const pricingComplete = [
    pricing.llmInputCostPerMillionUsd,
    pricing.llmOutputCostPerMillionUsd,
    pricing.llmEmbeddingCostPerMillionUsd,
    pricing.tavilySearchCostUsd,
    pricing.tavilyExtractCostUsd,
    pricing.tavilyCrawlCostUsd,
    pricing.tavilyResearchCostUsd,
  ].every((value) => typeof value === "number");

  return <>
    <div className="admin-head"><div><p className="eyebrow">SPEND CONTROL</p><h1>Costs</h1></div></div>
    <div className="metric-grid">
      <div className="metric-card"><span>Today estimated spend</span><strong>${todaySpend.toFixed(4)}</strong></div>
      <div className="metric-card"><span>Daily budget</span><strong>${dailyBudget.toFixed(2)}</strong></div>
      <div className="metric-card"><span>Budget state</span><strong>{state}</strong></div>
      <div className="metric-card"><span>30-day estimated spend</span><strong>${total30d.toFixed(4)}</strong></div>
      <div className="metric-card"><span>Tavily calls</span><strong>{tavily?.length ?? 0}</strong></div>
      <div className="metric-card"><span>LLM runs</span><strong>{llm?.length ?? 0}</strong></div>
      <div className="metric-card"><span>Other API calls</span><strong>{api?.length ?? 0}</strong></div>
    </div>
    {!pricingComplete && <p className="admin-note"><strong>Pricing incomplete:</strong> configure current provider rates in server environment variables before relying on dollar-budget enforcement. Missing rates are intentionally not invented.</p>}
    <p className="admin-note">At 80% of the daily budget NewsOS enters <code>CONSERVE</code> mode and defers optional deep research/distribution. At 100% it defers paid automated jobs while RSS ingestion and explicit manual editorial work can continue.</p>
  </>;
}
