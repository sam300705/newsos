import type { ScoreResult, StorySignalInput } from "../domain/types.ts";

export const DEFAULT_NEWSWORTHINESS_WEIGHTS: Record<keyof StorySignalInput, number> = {
  sourceCount: 15,
  sourceAuthority: 15,
  primarySourcePresence: 10,
  recency: 10,
  subjectImportance: 15,
  eventMagnitude: 10,
  geographicRelevance: 5,
  novelty: 10,
  readerInterest: 5,
  socialSignal: 5,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function scoreNewsworthiness(
  input: StorySignalInput,
  weights: Record<keyof StorySignalInput, number> = DEFAULT_NEWSWORTHINESS_WEIGHTS,
): ScoreResult {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) throw new Error("Newsworthiness weights must sum above zero");
  const components = (Object.keys(weights) as Array<keyof StorySignalInput>).map((signal) => {
    const normalized = clamp01(input[signal]);
    const weight = weights[signal];
    return { signal, normalized, weight, contribution: (normalized * weight * 100) / totalWeight };
  });
  return {
    score: Number(components.reduce((sum, item) => sum + item.contribution, 0).toFixed(2)),
    components,
  };
}
