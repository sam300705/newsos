import type { AtomicClaim } from "../domain/types.ts";

const VERIFIED = new Set(["SUPPORTED", "MULTI_SOURCE_SUPPORTED", "PRIMARY_SOURCE_VERIFIED"]);

export function verifiedClaimsForContext(claims: AtomicClaim[]): AtomicClaim[] {
  return claims.filter((claim) => VERIFIED.has(claim.status) && claim.confidence >= 70 && claim.contradictingSourceIds.length === 0);
}

export function validateAnswerCitations(citationSourceIds: string[], allowedSourceIds: string[]): boolean {
  const allowed = new Set(allowedSourceIds);
  return citationSourceIds.every((id) => allowed.has(id));
}
