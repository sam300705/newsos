const FEATURE_FLAGS = new Set([
  "auto_publish",
  "evidence_draft_workflow",
  "multilingual_generation",
  "ask_the_news",
  "social_generation",
  "aveiro_sync",
  "newsletter_generation",
  "company_intelligence",
  "rss_ingestion",
  "tavily_discovery",
  "crawl_watchlists",
  "automatic_extraction",
  "story_clustering",
  "article_generation",
]);

const WEIGHT_KEYS = [
  "sourceCount",
  "sourceAuthority",
  "primarySourcePresence",
  "recency",
  "subjectImportance",
  "eventMagnitude",
  "geographicRelevance",
  "novelty",
  "readerInterest",
  "socialSignal",
] as const;

function assertFiniteNumber(value: unknown, label: string, min?: number, max?: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number`);
  if (min !== undefined && number < min) throw new Error(`${label} must be >= ${min}`);
  if (max !== undefined && number > max) throw new Error(`${label} must be <= ${max}`);
  return number;
}

export function validateFeatureFlagKey(key: string): string {
  if (!FEATURE_FLAGS.has(key)) throw new Error(`Unknown feature flag: ${key}`);
  return key;
}

export function normalizeFeedInterval(value: unknown): number {
  const interval = assertFiniteNumber(value, "Polling interval", 5, 10080);
  if (!Number.isInteger(interval)) throw new Error("Polling interval must be a whole number of minutes");
  return interval;
}

export function validateConfigValue(key: string, value: unknown): unknown {
  if (key === "automation.global_pause" || key === "automation.shadow_mode") {
    if (typeof value !== "boolean") throw new Error(`${key} must be boolean`);
    return value;
  }

  if (key === "cost.daily_budget_usd" || key === "confidence.minimum_auto_publish") {
    return assertFiniteNumber(value, key, 0, key.startsWith("confidence") ? 100 : undefined);
  }

  if (key === "confidence.thresholds") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("confidence.thresholds must be an object");
    const row = value as Record<string, unknown>;
    const manualReview = assertFiniteNumber(row.manualReview, "manualReview", 0, 100);
    const quickReview = assertFiniteNumber(row.quickReview, "quickReview", 0, 100);
    const autoEligible = assertFiniteNumber(row.autoEligible, "autoEligible", 0, 100);
    if (!(manualReview < quickReview && quickReview < autoEligible)) {
      throw new Error("Thresholds must satisfy manualReview < quickReview < autoEligible");
    }
    return { autoEligible, quickReview, manualReview };
  }

  if (key === "newsworthiness.weights") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("newsworthiness.weights must be an object");
    const row = value as Record<string, unknown>;
    const normalized: Record<string, number> = {};
    for (const weightKey of WEIGHT_KEYS) normalized[weightKey] = assertFiniteNumber(row[weightKey], weightKey, 0);
    const unexpected = Object.keys(row).filter((item) => !WEIGHT_KEYS.includes(item as (typeof WEIGHT_KEYS)[number]));
    if (unexpected.length) throw new Error(`Unexpected newsworthiness weights: ${unexpected.join(", ")}`);
    const total = Object.values(normalized).reduce((sum, item) => sum + item, 0);
    if (Math.abs(total - 100) > 0.0001) throw new Error("Newsworthiness weights must sum to 100");
    return normalized;
  }

  if (key === "autonomy.approved_categories" || key === "autonomy.approved_source_tiers") {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error(`${key} must be a non-empty array`);
    const values = value.map((item) => String(item).trim()).filter(Boolean);
    if (values.length !== value.length) throw new Error(`${key} contains an empty value`);
    return [...new Set(values)].slice(0, 100);
  }

  throw new Error(`Unsupported configuration key: ${key}`);
}
