import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  AVEIRO_API_TOKEN: z.string().min(1, 'AVEIRO_API_TOKEN is required'),
  AVEIRO_SITE_ID: z.string().min(1, 'AVEIRO_SITE_ID is required'),
});

// For tests, skip process.exit and environment checking if running inside jest
const isTestEnv = process.env.NODE_ENV === 'test';

const _env = envSchema.safeParse(process.env);

if (!_env.success && !isTestEnv) {
  console.error('Invalid environment variables:\n', _env.error.format());
  process.exit(1);
}

// Fallback to empty object in test environment to avoid crashing modules that import this
export const env = _env.success ? _env.data : {
  TAVILY_API_KEY: 'test',
  GEMINI_API_KEY: 'test',
  AVEIRO_API_TOKEN: 'test',
  AVEIRO_SITE_ID: 'test',
};
