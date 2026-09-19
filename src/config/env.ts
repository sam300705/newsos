export type EnvInput = Record<string, string | undefined>;

export interface PublicEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  siteUrl: string;
  brandName: string;
  publisherName?: string;
  contactEmail?: string;
}

export interface ServerEnv extends PublicEnv {
  supabaseSecretKey: string;
}

export class EnvValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "EnvValidationError";
    this.field = field;
  }
}

function requireNonEmpty(input: EnvInput, field: string): string {
  const value = input[field]?.trim();
  if (!value) throw new EnvValidationError(field, "is required");
  return value;
}

function optional(input: EnvInput, field: string): string | undefined {
  const value = input[field]?.trim();
  return value || undefined;
}


function optionalNumber(input: EnvInput, field: string): number | undefined {
  const raw = optional(input, field);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new EnvValidationError(field, "must be a non-negative number");
  return value;
}

function requireUrl(input: EnvInput, field: string): string {
  const value = requireNonEmpty(input, field);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new EnvValidationError(field, "must use HTTPS outside local development");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    if (error instanceof EnvValidationError) throw error;
    throw new EnvValidationError(field, "must be a valid URL");
  }
}

export function validatePublicEnv(input: EnvInput): PublicEnv {
  return {
    supabaseUrl: requireUrl(input, "NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: requireNonEmpty(input, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    siteUrl: input.NEXT_PUBLIC_SITE_URL ? requireUrl(input, "NEXT_PUBLIC_SITE_URL") : "http://localhost:3000",
    brandName: optional(input, "NEXT_PUBLIC_BRAND_NAME") ?? "NewsOS",
    publisherName: optional(input, "NEXT_PUBLIC_PUBLISHER_NAME"),
    contactEmail: optional(input, "NEXT_PUBLIC_CONTACT_EMAIL"),
  };
}

export function validateServerEnv(input: EnvInput): ServerEnv {
  return { ...validatePublicEnv(input), supabaseSecretKey: requireNonEmpty(input, "SUPABASE_SECRET_KEY") };
}

export function getPublicEnv(): PublicEnv { return validatePublicEnv(process.env); }
export function getServerEnv(): ServerEnv { return validateServerEnv(process.env); }

export function getOptionalIntegrationEnv(input: EnvInput = process.env) {
  return {
    tavilyApiKey: optional(input, "TAVILY_API_KEY"),
    llmBaseUrl: optional(input, "LLM_BASE_URL") ?? "https://api.openai.com/v1",
    llmApiKey: optional(input, "LLM_API_KEY"),
    llmModel: optional(input, "LLM_MODEL"),
    llmEmbeddingModel: optional(input, "LLM_EMBEDDING_MODEL"),
    aveiroApiBaseUrl: optional(input, "AVEIRO_API_BASE_URL") ?? "https://www.aveiro.app/api/v1",
    aveiroApiToken: optional(input, "AVEIRO_API_TOKEN"),
    aveiroSiteId: optional(input, "AVEIRO_SITE_ID"),
    cronSecret: optional(input, "CRON_SECRET"),
    llmInputCostPerMillionUsd: optionalNumber(input, "LLM_INPUT_COST_PER_1M_USD"),
    llmOutputCostPerMillionUsd: optionalNumber(input, "LLM_OUTPUT_COST_PER_1M_USD"),
    llmEmbeddingCostPerMillionUsd: optionalNumber(input, "LLM_EMBEDDING_COST_PER_1M_USD"),
    tavilySearchCostUsd: optionalNumber(input, "TAVILY_SEARCH_COST_USD"),
    tavilyExtractCostUsd: optionalNumber(input, "TAVILY_EXTRACT_COST_USD"),
    tavilyCrawlCostUsd: optionalNumber(input, "TAVILY_CRAWL_COST_USD"),
    tavilyResearchCostUsd: optionalNumber(input, "TAVILY_RESEARCH_COST_USD"),
  };
}
