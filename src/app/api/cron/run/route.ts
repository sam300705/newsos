import { NextResponse } from "next/server";
import { getOptionalIntegrationEnv } from "@/config/env";
import { runJobBatch, scheduleDueWork } from "@/lib/jobs/pipeline";
import { getOrCreateRequestId } from "@/lib/observability/request-id";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

async function run(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const started = Date.now();
  const expected = getOptionalIntegrationEnv().cronSecret;
  const auth = request.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    logger.warn({ requestId, operation: "cron_run", status: "UNAUTHORIZED", durationMs: Date.now() - started }, "cron_rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  }
  try {
    const scheduled = await scheduleDueWork();
    const result = await runJobBatch(10);
    logger.info({ requestId, operation: "cron_run", status: "SUCCEEDED", durationMs: Date.now() - started, scheduled, result }, "cron_completed");
    return NextResponse.json({ scheduled, ...result }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  } catch (error) {
    logger.error({ requestId, operation: "cron_run", status: "FAILED", durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) }, "cron_failed");
    return NextResponse.json({ error: "Worker execution failed", requestId }, { status: 500, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  }
}

export const POST = run;
export const GET = run;
