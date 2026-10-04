import { z } from 'zod';

// We isolate the schema here for testing without triggering dotenv or process.exit
const envSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  AVEIRO_API_TOKEN: z.string().min(1, 'AVEIRO_API_TOKEN is required'),
  AVEIRO_SITE_ID: z.string().min(1, 'AVEIRO_SITE_ID is required'),
});

describe('Environment Configuration Schema', () => {
  it('should pass with valid environment variables', () => {
    const validEnv = {
      TAVILY_API_KEY: 'tavily_key',
      GEMINI_API_KEY: 'gemini_key',
      AVEIRO_API_TOKEN: 'aveiro_token',
      AVEIRO_SITE_ID: 'aveiro_site',
    };

    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('should fail when required variables are missing', () => {
    const invalidEnv = {
      TAVILY_API_KEY: 'tavily_key',
      // Missing GEMINI, AVEIRO
    };

    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
