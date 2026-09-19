import type { AutonomyDecision, AutonomyPolicyInput } from "../domain/types.ts";

export function evaluateAutonomy(input: AutonomyPolicyInput): AutonomyDecision {
  if (input.globalPause) return "PAUSED";
  const policyPass =
    input.autoPublishEnabled &&
    input.budgetAvailable !== false &&
    !input.highRisk &&
    input.confidence >= input.minimumConfidence &&
    input.unresolvedContradictions === 0 &&
    input.provenanceComplete &&
    input.qualityGatePassed &&
    input.approvedCategories.includes(input.category) &&
    input.approvedSourceTiers.includes(input.sourceTier);
  if (!policyPass) return "HUMAN_REVIEW";
  return input.shadowMode ? "WOULD_AUTO_PUBLISH" : "AUTO_PUBLISH";
}

export const HIGH_RISK_CATEGORIES = new Set(["politics", "election", "elections", "policy", "medical", "health", "legal", "financial", "cybersecurity", "security-incident"]);

export function isHighRiskCategory(category: string): boolean {
  return HIGH_RISK_CATEGORIES.has(category.trim().toLowerCase());
}
