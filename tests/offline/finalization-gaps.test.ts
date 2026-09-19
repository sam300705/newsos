import test from "node:test";
import assert from "node:assert/strict";
import {
  validateConfigValue,
  validateFeatureFlagKey,
  normalizeFeedInterval,
} from "../../src/core/config-validation.ts";
import { sanitizeAnalyticsMetadata } from "../../src/core/analytics.ts";
import { normalizeSubscriptionInput } from "../../src/core/subscription.ts";
import { shouldEmitReadComplete } from "../../src/core/read-completion.ts";

test("known feature flags are accepted and arbitrary flags are rejected", () => {
  assert.equal(validateFeatureFlagKey("auto_publish"), "auto_publish");
  assert.throws(() => validateFeatureFlagKey("evil.flag"));
});

test("confidence thresholds must be ordered and valid", () => {
  const valid = validateConfigValue("confidence.thresholds", {
    autoEligible: 90,
    quickReview: 75,
    manualReview: 50,
  });
  assert.deepEqual(valid, { autoEligible: 90, quickReview: 75, manualReview: 50 });
  assert.throws(() => validateConfigValue("confidence.thresholds", {
    autoEligible: 70,
    quickReview: 80,
    manualReview: 50,
  }));
});

test("newsworthiness weights require all expected non-negative finite keys", () => {
  const weights = {
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
  assert.deepEqual(validateConfigValue("newsworthiness.weights", weights), weights);
  assert.throws(() => validateConfigValue("newsworthiness.weights", { ...weights, novelty: -1 }));
});

test("feed polling interval is clamped only after validating finite integer input", () => {
  assert.equal(normalizeFeedInterval("30"), 30);
  assert.throws(() => normalizeFeedInterval("4"));
  assert.throws(() => normalizeFeedInterval("10081"));
  assert.throws(() => normalizeFeedInterval("abc"));
});

test("analytics metadata remains valid JSON while bounding deep and large values", () => {
  const result = sanitizeAnalyticsMetadata({
    long: "x".repeat(10000),
    nested: { a: { b: { c: { d: { e: "deep" } } } } },
    array: Array.from({ length: 200 }, (_, i) => i),
    fn: () => "drop",
  });
  assert.equal(typeof result, "object");
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.ok(JSON.stringify(result).length <= 4000);
});

test("newsletter honeypot is preserved and normalized", () => {
  assert.deepEqual(normalizeSubscriptionInput({ email: " Test@Example.COM ", website: "" }), {
    email: "test@example.com",
    website: "",
  });
  assert.equal(normalizeSubscriptionInput({ email: "bot@example.com", website: "https://spam.test" }).website, "https://spam.test");
  assert.throws(() => normalizeSubscriptionInput({ email: "not-an-email", website: "" }));
});

test("read completion requires meaningful dwell time and visibility, and fires once", () => {
  assert.equal(shouldEmitReadComplete({ alreadySent: false, visible: true, dwellMs: 25000 }), true);
  assert.equal(shouldEmitReadComplete({ alreadySent: true, visible: true, dwellMs: 25000 }), false);
  assert.equal(shouldEmitReadComplete({ alreadySent: false, visible: false, dwellMs: 25000 }), false);
  assert.equal(shouldEmitReadComplete({ alreadySent: false, visible: true, dwellMs: 2000 }), false);
});
import { operationalFlagForJob, isJobAllowedByFlags } from "../../src/core/automation-flags.ts";
import { sanitizeSearchQuery } from "../../src/core/search.ts";
import { isHighRiskCategory } from "../../src/core/autonomy.ts";
import { assertSafePublicUrl } from "../../src/core/url.ts";

test("automation job flags are centralized and global pause wins", () => {
  assert.equal(operationalFlagForJob("FETCH_FEED"), "rss_ingestion");
  assert.equal(operationalFlagForJob("DISCOVER_TAVILY"), "tavily_discovery");
  assert.equal(isJobAllowedByFlags("FETCH_FEED", { rss_ingestion: true }, false), true);
  assert.equal(isJobAllowedByFlags("FETCH_FEED", { rss_ingestion: true }, true), false);
  assert.equal(isJobAllowedByFlags("FETCH_FEED", { rss_ingestion: false }, false), false);
});

test("search query sanitizer strips PostgREST control characters and bounds length", () => {
  assert.equal(sanitizeSearchQuery(`  Acme%_,()'\" Series B  `), "Acme Series B");
  assert.equal(sanitizeSearchQuery("भारत AI").includes("भारत"), true);
  assert.ok(sanitizeSearchQuery("x".repeat(1000)).length <= 120);
});

test("high-risk editorial categories include elections, medical, finance and cybersecurity incidents", () => {
  for (const category of ["politics","elections","policy","medical","health","legal","financial","cybersecurity","security-incident"]) {
    assert.equal(isHighRiskCategory(category), true, category);
  }
  assert.equal(isHighRiskCategory("ai"), false);
});

test("URL safety rejects reserved IPv4 ranges and IPv6 loopback", () => {
  for (const url of [
    "http://0.0.0.0/x",
    "http://100.64.0.1/x",
    "http://224.0.0.1/x",
    "http://[::1]/x",
    "file:///etc/passwd",
    "data:text/plain,hi",
    "javascript:alert(1)",
  ]) assert.throws(() => assertSafePublicUrl(url), url);
});

test("publication gate blocks unsupported entities, dates, quotes and unsafe state", async () => {
  const { runPublicationGate } = await import("../../src/core/publication-gate.ts");
  const result = runPublicationGate({
    title: "Acme update",
    body: "Acme CEO Jane said on 18 Sep 2026: \"Guaranteed\".",
    numericalClaims: [],
    namedEntities: ["Jane"],
    dates: ["18 Sep 2026"],
    quotes: ["Guaranteed"],
    supportedClaimTexts: ["Acme announced an update"],
    sourceUrls: [],
    unresolvedContradictions: 1,
    duplicateStory: true,
    seoComplete: false,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((x) => x.startsWith("UNSUPPORTED_ENTITY")));
  assert.ok(result.blockers.some((x) => x.startsWith("UNSUPPORTED_DATE")));
  assert.ok(result.blockers.some((x) => x.startsWith("UNSUPPORTED_QUOTE")));
  assert.ok(result.blockers.includes("CITATIONS_MISSING"));
  assert.ok(result.blockers.includes("UNRESOLVED_CONTRADICTIONS"));
  assert.ok(result.blockers.includes("DUPLICATE_STORY"));
  assert.ok(result.blockers.includes("SEO_INCOMPLETE"));
});
import { resolveSafeRedirect } from "../../src/lib/security/network-core.ts";

test("redirect targets are revalidated and private redirects are rejected", () => {
  assert.equal(resolveSafeRedirect("https://example.com/feed", "/next").toString(), "https://example.com/next");
  assert.throws(() => resolveSafeRedirect("https://example.com/feed", "http://127.0.0.1/admin"));
});
