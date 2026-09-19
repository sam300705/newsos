export type BudgetState = "NORMAL" | "CONSERVE" | "EXHAUSTED";

export function classifyBudget(spend: number, dailyBudget: number, conserveAt = 0.8): BudgetState {
  if (!Number.isFinite(spend) || spend < 0) throw new Error("Spend must be a non-negative finite number");
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) throw new Error("Daily budget must be a positive finite number");
  if (!Number.isFinite(conserveAt) || conserveAt <= 0 || conserveAt >= 1) throw new Error("Conserve ratio must be between 0 and 1");
  if (spend >= dailyBudget) return "EXHAUSTED";
  if (spend >= dailyBudget * conserveAt) return "CONSERVE";
  return "NORMAL";
}

const OPTIONAL_WHEN_CONSERVING = new Set([
  "RESEARCH_STORY",
  "GENERATE_NEWSLETTER",
  "GENERATE_SOCIAL",
]);

const PAID_WHEN_EXHAUSTED = new Set([
  "DISCOVER_TAVILY",
  "CRAWL_WATCHLIST",
  "EXTRACT_DOCUMENT",
  "RESEARCH_STORY",
  "EXTRACT_CLAIMS",
  "GENERATE_ARTICLE",
  "VERIFY_EDITED_ARTICLE",
  "VERIFY_CORRECTION",
  "SYNC_AVEIRO",
  "GENERATE_NEWSLETTER",
  "GENERATE_SOCIAL",
]);

export function shouldDeferForBudget(jobType: string, state: BudgetState): boolean {
  if (state === "NORMAL") return false;
  if (state === "CONSERVE") return OPTIONAL_WHEN_CONSERVING.has(jobType);
  return PAID_WHEN_EXHAUSTED.has(jobType);
}
