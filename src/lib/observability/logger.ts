import "server-only";

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "request.headers.authorization",
      "authorization",
      "*.apiKey",
      "*.token",
      "*.secret",
      "*.password",
      "SUPABASE_SECRET_KEY",
      "TAVILY_API_KEY",
      "AVEIRO_API_TOKEN",
      "LLM_API_KEY",
    ],
    censor: "[REDACTED]",
  },
});
