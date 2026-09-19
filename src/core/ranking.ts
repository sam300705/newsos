export interface FeedCandidate {
  id: string;
  topicIds: string[];
  companyIds: string[];
  publishedAt: string;
  newsworthiness: number;
  confidence: number;
}

export const FEED_FOCUS_VALUES = ["balanced", "latest", "topics", "companies"] as const;
export type FeedFocus = (typeof FEED_FOCUS_VALUES)[number];

export function validateFeedFocus(value: unknown): FeedFocus {
  const normalized = String(value ?? "balanced").trim().toLowerCase();
  if (!FEED_FOCUS_VALUES.includes(normalized as FeedFocus)) {
    throw new Error("Invalid feed focus");
  }
  return normalized as FeedFocus;
}

const WEIGHTS: Record<FeedFocus, { topic: number; company: number; newsworthiness: number; confidence: number; recency: number }> = {
  balanced: { topic: 25, company: 30, newsworthiness: 0.2, confidence: 0.15, recency: 10 },
  latest: { topic: 8, company: 10, newsworthiness: 0.12, confidence: 0.1, recency: 42 },
  topics: { topic: 46, company: 12, newsworthiness: 0.16, confidence: 0.12, recency: 8 },
  companies: { topic: 10, company: 50, newsworthiness: 0.15, confidence: 0.12, recency: 8 },
};

export function rankForUser(
  candidate: FeedCandidate,
  followedTopics: Set<string>,
  followedCompanies: Set<string>,
  now = Date.now(),
  focus: FeedFocus = "balanced",
): number {
  const weights = WEIGHTS[focus];
  const ageHours = Math.max(0, (now - Date.parse(candidate.publishedAt)) / 3_600_000);
  const recency = Math.max(0, 1 - ageHours / 168);
  const topic = candidate.topicIds.some((id) => followedTopics.has(id)) ? 1 : 0;
  const company = candidate.companyIds.some((id) => followedCompanies.has(id)) ? 1 : 0;
  return Number((
    topic * weights.topic
    + company * weights.company
    + candidate.newsworthiness * weights.newsworthiness
    + candidate.confidence * weights.confidence
    + recency * weights.recency
  ).toFixed(2));
}
