export interface LlmCostRates {
  inputPerMillion?: number;
  outputPerMillion?: number;
  embeddingPerMillion?: number;
}

export interface TavilyCostRates {
  search?: number;
  extract?: number;
  crawl?: number;
  research?: number;
}

function usableRate(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function estimateLlmCost(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  rates: LlmCostRates,
): number | null {
  if (!usableRate(rates.inputPerMillion) || !usableRate(rates.outputPerMillion)) return null;
  const input = Number.isFinite(inputTokens) && Number(inputTokens) > 0 ? Number(inputTokens) : 0;
  const output = Number.isFinite(outputTokens) && Number(outputTokens) > 0 ? Number(outputTokens) : 0;
  return (input / 1_000_000) * rates.inputPerMillion + (output / 1_000_000) * rates.outputPerMillion;
}

export function estimateEmbeddingCost(inputTokens: number | undefined, rates: LlmCostRates): number | null {
  if (!usableRate(rates.embeddingPerMillion)) return null;
  const input = Number.isFinite(inputTokens) && Number(inputTokens) > 0 ? Number(inputTokens) : 0;
  return (input / 1_000_000) * rates.embeddingPerMillion;
}

export function estimateTavilyCost(operation: string, rates: TavilyCostRates): number | null {
  const op = operation.toUpperCase();
  const rate = op.includes("RESEARCH") ? rates.research
    : op.includes("CRAWL") ? rates.crawl
    : op.includes("EXTRACT") ? rates.extract
    : op.includes("SEARCH") ? rates.search
    : undefined;
  return usableRate(rate) ? rate : null;
}
