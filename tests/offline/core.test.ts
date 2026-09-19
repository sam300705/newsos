import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "../../src/core/url.ts";
import { shouldCluster, tokenSetSimilarity, entityOverlap } from "../../src/core/dedupe.ts";
import { scoreNewsworthiness } from "../../src/core/newsworthiness.ts";
import { scoreConfidence, confidenceBand } from "../../src/core/confidence.ts";
import { runPublicationGate } from "../../src/core/publication-gate.ts";
import { evaluateAutonomy } from "../../src/core/autonomy.ts";
import { aggregateEntities } from "../../src/core/entities.ts";
import { isOfficialDomain, scoreSourceReputation } from "../../src/core/source-reputation.ts";
import { verifiedClaimsForContext, validateAnswerCitations } from "../../src/core/ask-news.ts";
import { retryDelayMs, shouldDeadLetter } from "../../src/core/jobs.ts";

test("URL normalization strips tracking and rejects private hosts", () => {
  assert.equal(normalizeUrl("https://Example.com/news/?utm_source=x&b=2&a=1#x"), "https://example.com/news?a=1&b=2");
  assert.throws(() => normalizeUrl("http://127.0.0.1/admin"));
});

test("dedupe signals cluster paraphrased reports", () => {
  const titleSimilarity = tokenSetSimilarity("Acme raises $50M Series B", "Acme closes 50 million Series B funding round");
  const entities = entityOverlap(["Acme", "Investor Y"], ["Acme", "Investor Y", "Delhi"]);
  assert.equal(shouldCluster({sameCanonicalUrl:false,sameContentHash:false,titleSimilarity,entityOverlap:entities,embeddingSimilarity:0.9,hoursApart:2}), true);
});

test("newsworthiness score is explainable and bounded", () => {
  const result = scoreNewsworthiness({sourceCount:1,sourceAuthority:0.9,primarySourcePresence:1,recency:1,subjectImportance:0.8,eventMagnitude:0.7,geographicRelevance:0.8,novelty:0.8,readerInterest:0.6,socialSignal:0.4});
  assert.ok(result.score > 0 && result.score <= 100);
  assert.equal(result.components.length, 10);
});

test("confidence penalizes contradictions", () => {
  const good = scoreConfidence({primarySourceEvidence:1,independentCorroboration:1,sourceAuthority:1,claimAgreement:1,extractionQuality:1,recency:1,contradictionPenalty:0,missingFieldPenalty:0});
  const bad = scoreConfidence({primarySourceEvidence:1,independentCorroboration:1,sourceAuthority:1,claimAgreement:1,extractionQuality:1,recency:1,contradictionPenalty:1,missingFieldPenalty:1});
  assert.ok(good.score > bad.score);
  assert.equal(confidenceBand(49), "BLOCKED");
});

test("publication gate blocks unsupported numerical claims", () => {
  const result = runPublicationGate({title:"Funding",body:"Acme raised $80 million",numericalClaims:["$80 million"],namedEntities:["Acme"],dates:[],quotes:[],supportedClaimTexts:["Acme raised $50 million"],sourceUrls:["https://example.com"],unresolvedContradictions:0,duplicateStory:false,seoComplete:true});
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((x) => x.startsWith("UNSUPPORTED_NUMBER")));
});

test("autonomy stays human for high-risk categories", () => {
  assert.equal(evaluateAutonomy({confidence:99,category:"politics",sourceTier:"PRIMARY",unresolvedContradictions:0,provenanceComplete:true,qualityGatePassed:true,globalPause:false,autoPublishEnabled:true,shadowMode:false,highRisk:true,approvedCategories:["politics"],approvedSourceTiers:["PRIMARY"],minimumConfidence:90}), "HUMAN_REVIEW");
});

test("entity aggregation combines aliases without merging types", () => {
  const rows = aggregateEntities([
    {name:"Acme, Inc.",type:"COMPANY",confidence:.8,sourceId:"s1"},
    {name:"Acme Incorporated",type:"COMPANY",confidence:.9,sourceId:"s2"},
    {name:"Acme",type:"PRODUCT",confidence:.7,sourceId:"s3"},
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.type === "COMPANY")?.sourceIds.length, 2);
});

test("official-domain matching cannot be fooled by suffix domains", () => {
  assert.equal(isOfficialDomain("newsroom.nvidia.com", "nvidia.com"), true);
  assert.equal(isOfficialDomain("nvidia.com.evil.example", "nvidia.com"), false);
  assert.ok(scoreSourceReputation({sourceType:"PRIMARY", primarySourceCapability:true}) > scoreSourceReputation({sourceType:"UNKNOWN"}));
});

test("Ask the News excludes conflicted claims and constrains citations", () => {
  const claims = verifiedClaimsForContext([
    {id:"1",storyId:"s",text:"A",type:"FACT",status:"PRIMARY_SOURCE_VERIFIED",confidence:95,supportingSourceIds:["x"],contradictingSourceIds:[],primarySourceIds:["x"]},
    {id:"2",storyId:"s",text:"B",type:"FACT",status:"CONFLICTED",confidence:90,supportingSourceIds:["y"],contradictingSourceIds:["z"],primarySourceIds:[]},
  ]);
  assert.equal(claims.length, 1);
  assert.equal(validateAnswerCitations(["x"], ["x","y"]), true);
  assert.equal(validateAnswerCitations(["z"], ["x","y"]), false);
});

test("job retry policy is bounded", () => {
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(20), 60000);
  assert.equal(shouldDeadLetter({id:"j",type:"x",idempotencyKey:"k",attempt:3,maxAttempts:3,payload:{},createdAt:new Date().toISOString()}), true);
});
