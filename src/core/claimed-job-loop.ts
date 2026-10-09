/**
 * Processes bounded work without acquiring speculative leases for later jobs.
 * This deliberately only limits claim ordering / count. Crash recovery and
 * fencing of canonical stage writes require the separate Phase 4 SQL contract.
 */
export interface ClaimedJobLoopOptions<Job> {
  maxJobs: number;
  maxDurationMs: number;
  now: () => number;
  claim: () => Promise<Job | null | undefined>;
  execute: (job: Job) => Promise<void>;
}

export async function processClaimedJobs<Job>({
  maxJobs, maxDurationMs, now, claim, execute,
}: ClaimedJobLoopOptions<Job>): Promise<number> {
  if (!Number.isSafeInteger(maxJobs) || maxJobs < 0 || maxJobs > 50) {
    throw new RangeError("maxJobs must be an integer between 0 and 50");
  }
  if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0 || maxDurationMs > 120_000) {
    throw new RangeError("maxDurationMs must be between 1 and 120000");
  }
  const deadline = now() + maxDurationMs;
  let processed = 0;
  while (processed < maxJobs && now() < deadline) {
    const job = await claim();
    if (job == null) break;
    await execute(job);
    processed += 1;
  }
  return processed;
}
