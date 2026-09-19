import type { PublicationCandidate, PublicationGateResult } from "../domain/types.ts";

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function runPublicationGate(candidate: PublicationCandidate): PublicationGateResult {
  const blockers: string[] = [];
  const evidence = normalized(candidate.supportedClaimTexts.join(" \n "));
  if (!candidate.title.trim()) blockers.push("TITLE_MISSING");
  if (!candidate.body.trim()) blockers.push("BODY_MISSING");
  for (const value of candidate.numericalClaims) {
    if (!evidence.includes(normalized(value))) blockers.push(`UNSUPPORTED_NUMBER:${value}`);
  }
  for (const value of candidate.namedEntities) {
    if (!evidence.includes(normalized(value))) blockers.push(`UNSUPPORTED_ENTITY:${value}`);
  }
  for (const value of candidate.dates) {
    if (!evidence.includes(normalized(value))) blockers.push(`UNSUPPORTED_DATE:${value}`);
  }
  for (const value of candidate.quotes) {
    if (!evidence.includes(normalized(value))) blockers.push(`UNSUPPORTED_QUOTE:${value}`);
  }
  if (!candidate.sourceUrls.length) blockers.push("CITATIONS_MISSING");
  if (candidate.unresolvedContradictions > 0) blockers.push("UNRESOLVED_CONTRADICTIONS");
  if (candidate.duplicateStory) blockers.push("DUPLICATE_STORY");
  if (!candidate.seoComplete) blockers.push("SEO_INCOMPLETE");
  return { allowed: blockers.length === 0, blockers };
}
