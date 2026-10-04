import { z } from 'zod';
import { env } from '../config/env';

// Tavily result schema
export const TavilyResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  content: z.string(),
  score: z.number().optional(),
  published_date: z.string().optional(),
});

export const TavilyResponseSchema = z.object({
  query: z.string(),
  results: z.array(TavilyResultSchema),
});

export type TavilyResult = z.infer<typeof TavilyResultSchema>;
export type TavilyResponse = z.infer<typeof TavilyResponseSchema>;

// Exponential backoff fetch wrapper
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // Retry on 429 Too Many Requests or 5xx Server Errors
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      console.warn(`[Tavily] Request failed with status ${response.status}. Retrying in ${backoff}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[Tavily] Network error: ${error}. Retrying in ${backoff}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export class TavilyService {
  private static API_URL = 'https://api.tavily.com/search';

  static async searchAIWeb(query: string): Promise<TavilyResponse> {
    const response = await fetchWithRetry(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_answer: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`[Tavily] Search failed with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate with Zod
    const parsedData = TavilyResponseSchema.safeParse(data);
    if (!parsedData.success) {
      console.error('[Tavily] Invalid response format:', parsedData.error.format());
      throw new Error('[Tavily] Failed to parse search response');
    }

    return parsedData.data;
  }
}
