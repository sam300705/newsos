import { createHash } from "node:crypto";
import { z } from "zod";

export const claimCandidatesSchema = z.object({
  claims: z.array(z.object({
    text: z.string().trim().min(1).max(4000),
    evidence: z.array(z.object({
      documentId: z.uuid(), sourceVersion: z.string().regex(/^[a-f0-9]{64}$/),
      start: z.number().int().nonnegative(), end: z.number().int().positive(),
      quote: z.string().min(1).max(12000), stance: z.enum(["SUPPORTS", "CONTRADICTS", "CONTEXT"]),
    }).strict()).min(1).max(20),
  }).strict()).min(1).max(100),
}).strict();
export const structuredDraftSchema = z.object({
  headlineClaimId: z.uuid(), summaryClaimId: z.uuid(),
  bodyClaimIds: z.array(z.uuid()).min(1).max(100), category: z.string().min(1).max(100),
}).strict();
export const sourceVersion = (text: string) => createHash("sha256").update(text).digest("hex");
export function validateClaimCandidates(value: unknown, documents: { id: string; content: string }[]) {
  const parsed = claimCandidatesSchema.parse(value);
  const lookup = new Map(documents.map(d => [d.id, d]));
  for (const claim of parsed.claims) for (const evidence of claim.evidence) {
    const document = lookup.get(evidence.documentId);
    // Unicode code-point offsets match PostgreSQL substring rather than JS UTF-16.
    if (!document || sourceVersion(document.content) !== evidence.sourceVersion || evidence.end <= evidence.start ||
      Array.from(document.content).slice(evidence.start, evidence.end).join("") !== evidence.quote) {
      throw new Error("Invalid evidence reference, source version or passage");
    }
  }
  return parsed;
}
export function composeStructuredDraft(value: unknown, claims: { id: string; claim_text: string }[]) {
  const parsed = structuredDraftSchema.parse(value);
  const lookup = new Map(claims.map(c => [c.id, c.claim_text]));
  const text = (id: string) => { const result = lookup.get(id); if (!result) throw new Error("Unknown claim ID"); return result; };
  return { headline: text(parsed.headlineClaimId), summary: text(parsed.summaryClaimId),
    body: parsed.bodyClaimIds.map(text).join("\n\n"), category: parsed.category };
}
