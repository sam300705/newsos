import { createHash } from "node:crypto";
import { isIP } from "node:net";

const TRACKING_PREFIXES = ["utm_", "fbclid", "gclid", "mc_cid", "mc_eid", "ref"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1", "[::1]", "::", "[::]"]);

function ipv4Parts(hostname: string): number[] | null {
  const parts = hostname.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isReservedIp(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(normalized) === 4) {
    const parts = ipv4Parts(normalized)!;
    const a = parts[0]!;
    const b = parts[1]!;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || a >= 224;
  }
  if (isIP(normalized) === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isReservedIp(mapped[1]!) : false;
  }
  return false;
}

export function assertSafePublicUrl(raw: string): URL {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) URLs are allowed");
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || isReservedIp(host) || host.endsWith(".local")) {
    throw new Error("Private or reserved addresses are not allowed");
  }
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
  return url;
}

export function normalizeUrl(raw: string): string {
  const url = assertSafePublicUrl(raw);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.protocol = url.protocol.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (TRACKING_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix))) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function stableHash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function domainOf(raw: string): string { return assertSafePublicUrl(raw).hostname.toLowerCase().replace(/^www\./, ""); }
