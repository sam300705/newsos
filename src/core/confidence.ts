import type { ConfidenceInput, ScoreResult } from "../domain/types.ts";

const POSITIVE: Array<[keyof ConfidenceInput, number]> = [
  ["primarySourceEvidence", 25],
  ["independentCorroboration", 20],
  ["sourceAuthority", 15],
  ["claimAgreement", 15],
  ["extractionQuality", 10],
  ["recency", 5],
];

const NEGATIVE: Array<[keyof ConfidenceInput, number]> = [
  ["contradictionPenalty", 5],
  ["missingFieldPenalty", 5],
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function scoreConfidence(input: ConfidenceInput): ScoreResult {
  const components = [
    ...POSITIVE.map(([signal, weight]) => ({
      signal,
      normalized: clamp01(input[signal]),
      weight,
      contribution: clamp01(input[signal]) * weight,
    })),
    ...NEGATIVE.map(([signal, weight]) => ({
      signal,
      normalized: clamp01(input[signal]),
      weight: -weight,
      contribution: -clamp01(input[signal]) * weight,
    })),
  ];
  const raw = components.reduce((sum, item) => sum + item.contribution, 0);
  return { score: Number(Math.max(0, Math.min(100, raw)).toFixed(2)), components };
}

export interface ConfidenceThresholds { autoEligible: number; quickReview: number; manualReview: number; }
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = { autoEligible: 90, quickReview: 75, manualReview: 50 };
export function confidenceBand(score: number, thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS): "AUTO_ELIGIBLE" | "QUICK_REVIEW" | "MANUAL_REVIEW" | "BLOCKED" {
  if (score >= thresholds.autoEligible) return "AUTO_ELIGIBLE";
  if (score >= thresholds.quickReview) return "QUICK_REVIEW";
  if (score >= thresholds.manualReview) return "MANUAL_REVIEW";
  return "BLOCKED";
}
