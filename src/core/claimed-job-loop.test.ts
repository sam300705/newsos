import { describe, expect, it, vi } from "vitest";
import { processClaimedJobs } from "./claimed-job-loop";

describe("bounded non-speculative job claims", () => {
  it("claims exactly one job immediately before each execution", async () => {
    const events: string[] = [];
    let next = 0;
    const processed = await processClaimedJobs({
      maxJobs: 3, maxDurationMs: 1000, now: () => 0,
      claim: async () => { events.push("claim"); return ++next; },
      execute: async job => { events.push("execute " + job); },
    });
    expect(processed).toBe(3);
    expect(events).toEqual(["claim","execute 1","claim","execute 2","claim","execute 3"]);
  });

  it("does not claim more work after a handler exceeds the deadline", async () => {
    let clock = 0;
    const claim = vi.fn(async () => "job");
    const processed = await processClaimedJobs({
      maxJobs: 10, maxDurationMs: 45, now: () => clock,
      claim, execute: async () => { clock = 50; },
    });
    expect(processed).toBe(1);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("stops after an empty queue without executing nonexistent jobs", async () => {
    const execute = vi.fn(async (_job: string) => {});
    const claim = vi.fn(async () => null);
    expect(await processClaimedJobs({ maxJobs: 10, maxDurationMs: 100, now: () => 0, claim, execute })).toBe(0);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("propagates claim failures without invoking the handler", async () => {
    const execute = vi.fn(async (_job: string) => {});
    await expect(processClaimedJobs({
      maxJobs: 1, maxDurationMs: 100, now: () => 0,
      claim: async (): Promise<string> => { throw new Error("claim rejected"); }, execute,
    })).rejects.toThrow("claim rejected");
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails on invalid limits instead of accidentally starting unlimited work", async () => {
    const claim = vi.fn(async () => "job");
    await expect(processClaimedJobs({ maxJobs: Infinity, maxDurationMs: 100, now: () => 0, claim, execute: async () => {} })).rejects.toThrow(RangeError);
    expect(claim).not.toHaveBeenCalled();
  });
});
