export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|of|to|in|for|on|with|from)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenSetSimilarity(a: string, b: string): number {
  const aa = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const bb = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (!aa.size && !bb.size) return 1;
  const intersection = [...aa].filter((token) => bb.has(token)).length;
  const union = new Set([...aa, ...bb]).size;
  return union ? intersection / union : 0;
}

export function entityOverlap(a: string[], b: string[]): number {
  const aa = new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const bb = new Set(b.map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  return [...aa].filter((x) => bb.has(x)).length / Math.min(aa.size, bb.size);
}

export interface DuplicateSignals {
  sameCanonicalUrl: boolean;
  sameContentHash: boolean;
  titleSimilarity: number;
  entityOverlap: number;
  embeddingSimilarity?: number;
  hoursApart: number;
}

export function duplicateConfidence(signals: DuplicateSignals): number {
  if (signals.sameCanonicalUrl || signals.sameContentHash) return 1;
  const timeScore = Math.max(0, 1 - signals.hoursApart / 168);
  const semantic = signals.embeddingSimilarity ?? 0;
  const score =
    signals.titleSimilarity * 0.35 +
    signals.entityOverlap * 0.25 +
    semantic * 0.25 +
    timeScore * 0.15;
  return Math.max(0, Math.min(1, score));
}

export function shouldCluster(signals: DuplicateSignals, threshold = 0.72): boolean {
  return duplicateConfidence(signals) >= threshold;
}
