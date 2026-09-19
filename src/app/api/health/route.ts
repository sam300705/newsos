import { NextResponse } from "next/server";
import { getOrCreateRequestId } from "@/lib/observability/request-id";
import { buildHealthPayload } from "./health";

const APP_VERSION = process.env.APP_VERSION ?? "0.1.0";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request.headers);

  return NextResponse.json(buildHealthPayload(APP_VERSION), {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}
