import { randomUUID } from "node:crypto";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function getOrCreateRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id")?.trim();
  if (incoming && SAFE_REQUEST_ID.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}
