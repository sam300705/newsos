import type { JobEnvelope } from "../domain/types.ts";

export function retryDelayMs(attempt: number, base = 1_000, cap = 60_000): number {
  if (attempt < 1) return 0;
  return Math.min(cap, base * 2 ** (attempt - 1));
}

export function shouldDeadLetter(job: JobEnvelope): boolean {
  return job.attempt >= job.maxAttempts;
}

export function makeIdempotencyKey(type: string, parts: Array<string | number>): string {
  return [type, ...parts].map(String).join(":");
}
