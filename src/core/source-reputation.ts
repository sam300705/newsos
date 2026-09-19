import type { SourceType } from "../domain/types.ts";

const TYPE_BASE: Record<SourceType, number> = {
  PRIMARY: 0.95,
  REGULATOR: 0.95,
  MAINSTREAM_NEWS: 0.8,
  TRADE_PUBLICATION: 0.72,
  COMPANY_BLOG: 0.78,
  PRESS_RELEASE: 0.72,
  COMMUNITY: 0.45,
  UNKNOWN: 0.5,
};

export interface ReputationInput {
  sourceType: SourceType;
  authorityOverride?: number | null;
  historicalAccuracy?: number | null;
  correctionRate?: number | null;
  failureRate?: number | null;
  primarySourceCapability?: boolean;
}

export function scoreSourceReputation(input: ReputationInput): number {
  const neutral = 0.5;
  const authority = input.authorityOverride ?? TYPE_BASE[input.sourceType];
  const accuracy = input.historicalAccuracy ?? neutral;
  const correctionReliability = input.correctionRate == null ? neutral : 1 - input.correctionRate;
  const fetchReliability = input.failureRate == null ? neutral : 1 - input.failureRate;
  const primary = input.primarySourceCapability ? 1 : 0.5;
  return Number((authority * 0.4 + accuracy * 0.25 + correctionReliability * 0.1 + fetchReliability * 0.1 + primary * 0.15).toFixed(4));
}

export function isOfficialDomain(candidate: string, officialDomain: string): boolean {
  const c = candidate.toLowerCase().replace(/^www\./, "");
  const o = officialDomain.toLowerCase().replace(/^www\./, "");
  return c === o || c.endsWith(`.${o}`);
}
