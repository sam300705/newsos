import { describe, expect, it } from "vitest";
import { buildHealthPayload } from "./health";
import { GET } from "./route";
import { getOrCreateRequestId } from "@/lib/observability/request-id";

describe("health contract", () => {
  it("builds a deterministic, non-secret health payload", () => {
    expect(buildHealthPayload("test-version")).toEqual({
      status: "ok",
      service: "newsos",
      version: "test-version",
    });
  });

  it("preserves a safe incoming request id", () => {
    const headers = new Headers({ "x-request-id": "req-123_abc" });
    expect(getOrCreateRequestId(headers)).toBe("req-123_abc");
  });

  it("returns the health contract and request id header", async () => {
    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { "x-request-id": "req-health-test" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-health-test");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "newsos",
      version: "0.1.0",
    });
  });

  it("replaces an unsafe incoming request id", () => {
    const headers = new Headers({ "x-request-id": "bad request id with spaces" });
    expect(getOrCreateRequestId(headers)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
