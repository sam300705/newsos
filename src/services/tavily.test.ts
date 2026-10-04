import { TavilyResponseSchema } from './tavily';

describe('Tavily Service Schemas', () => {
  it('should successfully parse a valid Tavily response', () => {
    const mockResponse = {
      query: "AI developer tools",
      results: [
        {
          title: "New AI Tool",
          url: "https://example.com/ai-tool",
          content: "This is a new AI tool.",
          score: 0.99,
          published_date: "2023-10-27T00:00:00Z"
        }
      ]
    };

    const result = TavilyResponseSchema.safeParse(mockResponse);
    expect(result.success).toBe(true);
  });

  it('should fail when parsing invalid Tavily response (invalid URL)', () => {
    const mockResponse = {
      query: "AI developer tools",
      results: [
        {
          title: "New AI Tool",
          url: "not-a-url",
          content: "This is a new AI tool."
        }
      ]
    };

    const result = TavilyResponseSchema.safeParse(mockResponse);
    expect(result.success).toBe(false);
  });
});
