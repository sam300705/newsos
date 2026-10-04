import { ArticleDigestSchema } from './gemini';

describe('Gemini Transformation Engine Schemas', () => {
  it('should validate a correct article digest', () => {
    const validDigest = {
      title: "New Agent Framework",
      slug: "new-agent-framework",
      summary: "A brief summary of the framework.",
      architecturalBreakdown: "## Architecture\n- Built on Node.js\n- Uses WebSockets",
      keyTakeaways: ["Fast", "Reliable", "Scalable"],
      sourceUrl: "https://example.com/framework",
      tags: ["Agent", "Node.js"]
    };

    const result = ArticleDigestSchema.safeParse(validDigest);
    expect(result.success).toBe(true);
  });

  it('should fail validation if keyTakeaways are less than 3', () => {
    const invalidDigest = {
      title: "New Agent Framework",
      slug: "new-agent-framework",
      summary: "A brief summary of the framework.",
      architecturalBreakdown: "## Architecture",
      keyTakeaways: ["Fast", "Reliable"], // Only 2 items
      sourceUrl: "https://example.com/framework",
      tags: ["Agent"]
    };

    const result = ArticleDigestSchema.safeParse(invalidDigest);
    expect(result.success).toBe(false);
  });

  it('should fail validation if sourceUrl is not a valid URL', () => {
    const invalidDigest = {
      title: "New Agent Framework",
      slug: "new-agent-framework",
      summary: "A brief summary of the framework.",
      architecturalBreakdown: "## Architecture",
      keyTakeaways: ["Fast", "Reliable", "Scalable"],
      sourceUrl: "not-a-valid-url",
      tags: ["Agent"]
    };

    const result = ArticleDigestSchema.safeParse(invalidDigest);
    expect(result.success).toBe(false);
  });
});
