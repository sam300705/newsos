import "server-only";
import { getOptionalIntegrationEnv } from "@/config/env";
import { estimateEmbeddingCost, estimateLlmCost } from "@/core/costs";

export interface ModelUsage { inputTokens?: number; outputTokens?: number; }
export interface ModelResult<T> { value: T; usage: ModelUsage; provider: string; model: string; latencyMs: number; estimatedCostUsd: number | null; }
export interface ModelProvider {
  generateJson<T>(args: { system: string; prompt: string; schemaName: string }): Promise<ModelResult<T>>;
  embed(texts: string[]): Promise<ModelResult<number[][]>>;
}

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private readonly config = getOptionalIntegrationEnv()) {}

  async generateJson<T>({ system, prompt, schemaName }: { system: string; prompt: string; schemaName: string }): Promise<ModelResult<T>> {
    if (!this.config.llmApiKey || !this.config.llmModel) throw new Error("LLM_API_KEY / LLM_MODEL are not configured");
    const started = Date.now();
    const response = await fetch(`${this.config.llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.llmApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.llmModel,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Model request failed (${schemaName}) HTTP ${response.status}`);
    const json = await response.json() as any;
    const raw = json.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("Model returned no JSON content");
    const usage = { inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens };
    const estimatedCostUsd = estimateLlmCost(usage.inputTokens, usage.outputTokens, { inputPerMillion: this.config.llmInputCostPerMillionUsd, outputPerMillion: this.config.llmOutputCostPerMillionUsd });
    return { value: JSON.parse(raw) as T, usage, provider: "openai-compatible", model: this.config.llmModel, latencyMs: Date.now() - started, estimatedCostUsd };
  }

  async embed(texts: string[]): Promise<ModelResult<number[][]>> {
    if (!this.config.llmApiKey || !this.config.llmEmbeddingModel) throw new Error("Embedding model is not configured");
    const started = Date.now();
    const response = await fetch(`${this.config.llmBaseUrl}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.llmApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.llmEmbeddingModel, input: texts }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Embedding request failed with HTTP ${response.status}`);
    const json = await response.json() as any;
    const usage = { inputTokens: json.usage?.prompt_tokens };
    const estimatedCostUsd = estimateEmbeddingCost(usage.inputTokens, { embeddingPerMillion: this.config.llmEmbeddingCostPerMillionUsd });
    return { value: (json.data ?? []).map((row: any) => row.embedding), usage, provider: "openai-compatible", model: this.config.llmEmbeddingModel, latencyMs: Date.now() - started, estimatedCostUsd };
  }
}
