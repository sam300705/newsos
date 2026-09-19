export type StaffRole = "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER";
export type AppRole = StaffRole | "USER";
export type SourceType =
  | "PRIMARY"
  | "REGULATOR"
  | "MAINSTREAM_NEWS"
  | "TRADE_PUBLICATION"
  | "COMPANY_BLOG"
  | "PRESS_RELEASE"
  | "COMMUNITY"
  | "UNKNOWN";

export type ClaimStatus =
  | "UNVERIFIED"
  | "SUPPORTED"
  | "MULTI_SOURCE_SUPPORTED"
  | "PRIMARY_SOURCE_VERIFIED"
  | "CONFLICTED"
  | "REJECTED";

export type ArticleStatus =
  | "DRAFT"
  | "REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "REJECTED"
  | "CORRECTED";

export type StoryStatus =
  | "CANDIDATE"
  | "CLUSTERED"
  | "RESEARCHING"
  | "VERIFIED"
  | "DRAFTED"
  | "PUBLISHED"
  | "REJECTED";

export interface SourceSnapshot {
  id: string;
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  sourceType: SourceType;
  authorityScore: number;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  contentHash?: string | null;
  isPrimary?: boolean;
}

export interface StorySignalInput {
  sourceCount: number;
  sourceAuthority: number;
  primarySourcePresence: number;
  recency: number;
  subjectImportance: number;
  eventMagnitude: number;
  geographicRelevance: number;
  novelty: number;
  readerInterest: number;
  socialSignal: number;
}

export interface ScoreComponent {
  signal: keyof StorySignalInput | string;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface ScoreResult {
  score: number;
  components: ScoreComponent[];
}

export interface AtomicClaim {
  id: string;
  storyId: string;
  text: string;
  type: string;
  status: ClaimStatus;
  confidence: number;
  supportingSourceIds: string[];
  contradictingSourceIds: string[];
  primarySourceIds: string[];
}

export interface ConfidenceInput {
  primarySourceEvidence: number;
  independentCorroboration: number;
  sourceAuthority: number;
  claimAgreement: number;
  extractionQuality: number;
  recency: number;
  contradictionPenalty: number;
  missingFieldPenalty: number;
}

export interface PublicationCandidate {
  title: string;
  body: string;
  numericalClaims: string[];
  namedEntities: string[];
  dates: string[];
  quotes: string[];
  supportedClaimTexts: string[];
  sourceUrls: string[];
  unresolvedContradictions: number;
  duplicateStory: boolean;
  seoComplete: boolean;
}

export interface PublicationGateResult {
  allowed: boolean;
  blockers: string[];
}

export interface AutonomyPolicyInput {
  confidence: number;
  category: string;
  sourceTier: string;
  unresolvedContradictions: number;
  provenanceComplete: boolean;
  qualityGatePassed: boolean;
  globalPause: boolean;
  autoPublishEnabled: boolean;
  shadowMode: boolean;
  highRisk: boolean;
  approvedCategories: string[];
  approvedSourceTiers: string[];
  minimumConfidence: number;
  budgetAvailable?: boolean;
}

export type AutonomyDecision =
  | "PAUSED"
  | "HUMAN_REVIEW"
  | "WOULD_AUTO_PUBLISH"
  | "AUTO_PUBLISH";

export interface JobEnvelope<T = unknown> {
  id: string;
  type: string;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  payload: T;
  createdAt: string;
}
