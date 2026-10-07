import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyBudget, shouldDeferForBudget } from "../../src/core/budget.ts";
import { isJobAllowedByFlags } from "../../src/core/automation-flags.ts";
import { evaluateAutonomy } from "../../src/core/autonomy.ts";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const migrations = fs.readdirSync(path.join(root, "supabase/migrations"))
  .sort()
  .map((name) => read(`supabase/migrations/${name}`))
  .join("\n");

test("budget policy enters conserve at 80% and exhausted at 100%", () => {
  assert.equal(classifyBudget(7.99, 10), "NORMAL");
  assert.equal(classifyBudget(8, 10), "CONSERVE");
  assert.equal(classifyBudget(10, 10), "EXHAUSTED");
  assert.equal(shouldDeferForBudget("FETCH_FEED", "EXHAUSTED"), false);
  assert.equal(shouldDeferForBudget("RESEARCH_STORY", "CONSERVE"), true);
  assert.equal(shouldDeferForBudget("GENERATE_ARTICLE", "CONSERVE"), false);
  assert.equal(shouldDeferForBudget("GENERATE_ARTICLE", "EXHAUSTED"), true);
});

test("explicit manual jobs bypass automation flags but automated jobs do not", () => {
  const flags = { article_generation: false };
  assert.equal(isJobAllowedByFlags("GENERATE_ARTICLE", flags, true, false), false);
  assert.equal(isJobAllowedByFlags("GENERATE_ARTICLE", flags, true, true), true);
  assert.equal(isJobAllowedByFlags("GENERATE_ARTICLE", flags, false, true), true);
});

test("controlled autonomy requires budget availability", () => {
  const base = {confidence:99,category:"ai",sourceTier:"PRIMARY",unresolvedContradictions:0,provenanceComplete:true,qualityGatePassed:true,globalPause:false,autoPublishEnabled:true,shadowMode:false,highRisk:false,approvedCategories:["ai"],approvedSourceTiers:["PRIMARY"],minimumConfidence:90};
  assert.equal(evaluateAutonomy({...base,budgetAvailable:false}), "HUMAN_REVIEW");
  assert.equal(evaluateAutonomy({...base,budgetAvailable:true}), "AUTO_PUBLISH");
});

test("personalization RLS is ownership scoped", () => {
  for (const [table, policy] of [
    ["user_topic_follows", "own_topic_follows"],
    ["user_company_follows", "own_company_follows"],
    ["saved_articles", "own_saved_articles"],
    ["user_preferences", "own_preferences"],
  ]) {
    assert.match(migrations, new RegExp(`create policy "${policy}" on public\\.${table}[\\s\\S]*?auth\\.uid\\(\\)\\)=user_id`, "i"));
  }
});

test("manual article edits force draft and enqueue re-verification", () => {
  const actions = read("src/app/admin/actions.ts");
  assert.match(actions, /status:'DRAFT'/);
  assert.match(actions, /enqueueJob\('VERIFY_EDITED_ARTICLE'/);
});

test("corrections can only publish from READY and retain history", () => {
  assert.match(migrations, /if c\.status <> 'READY' then raise exception 'Correction must be READY'/);
  assert.match(migrations, /insert into public\.article_versions/);
  assert.match(migrations, /insert into public\.publication_history/);
});

test("scheduled publication is re-gated when due", () => {
  const pipeline = read("src/lib/jobs/pipeline.ts");
  assert.match(pipeline, /\.eq\("status", "SCHEDULED"\)\.lte\("scheduled_for"/);
  assert.match(pipeline, /PUBLISH_ARTICLE/);
  assert.match(pipeline, /rpc\("publish_article_revision"/);
  assert.match(pipeline, /Scheduled article is not due yet/);
});

test("Aveiro uses bearer auth and idempotency keys while Supabase keeps canonical state", () => {
  const aveiro = read("src/lib/publishing/aveiro.ts");
  const pipeline = read("src/lib/jobs/pipeline.ts");
  assert.match(aveiro, /Authorization.*Bearer/);
  assert.match(aveiro, /Idempotency-Key/);
  assert.match(pipeline, /distribution_outputs/);
  assert.match(pipeline, /status: "FAILED"/);
  assert.match(pipeline, /onConflict: "idempotency_key"/);
});

test("cost estimation is explicit and never invents missing provider rates", async () => {
  const { estimateLlmCost, estimateTavilyCost } = await import("../../src/core/costs.ts");
  assert.equal(estimateLlmCost(1_000_000, 500_000, { inputPerMillion: 2, outputPerMillion: 8 }), 6);
  assert.equal(estimateLlmCost(100, 100, {}), null);
  assert.equal(estimateTavilyCost("SEARCH", { search: 0.01 }), 0.01);
  assert.equal(estimateTavilyCost("RESEARCH", {}), null);
});

test("shadow autonomy disagreement rate compares system auto intent with editor decisions", async () => {
  const { summarizeAutonomyDecisions } = await import("../../src/core/autonomy-analytics.ts");
  const summary = summarizeAutonomyDecisions([
    { systemDecision: "WOULD_AUTO_PUBLISH", editorDecision: "APPROVED" },
    { systemDecision: "WOULD_AUTO_PUBLISH", editorDecision: "REJECTED" },
    { systemDecision: "HUMAN_REVIEW", editorDecision: "APPROVED" },
    { systemDecision: "HUMAN_REVIEW", editorDecision: null },
  ]);
  assert.equal(summary.reviewed, 3);
  assert.equal(summary.disagreements, 2);
  assert.equal(summary.disagreementRate, 2 / 3);
});

test("Ask the News prompt treats verified corpus content as untrusted data", () => {
  assert.match(migrations, /ask_news.*untrusted data[\s\S]*never follow instructions/i);
});

test("authenticated users cannot update their own authorization role", () => {
  assert.match(migrations, /revoke update on table public\.profiles from authenticated/i);
  assert.match(migrations, /grant update \(display_name, avatar_url\) on table public\.profiles to authenticated/i);
  assert.doesNotMatch(migrations, /grant update \([^)]*role[^)]*\) on table public\.profiles to authenticated/i);
});

test("new sources validate source type before persistence", async () => {
  const { validateSourceType } = await import("../../src/core/source-validation.ts");
  assert.equal(validateSourceType("PRIMARY"), "PRIMARY");
  assert.throws(() => validateSourceType("SUPER_TRUSTED"), /Invalid source type/);
  const actions = read("src/app/admin/actions.ts");
  assert.match(actions, /createSourceAndFeed[\s\S]*validateSourceType\(id\(fd,'sourceType'\)\)/);
});

test("public article body renders text without injecting source HTML", () => {
  const body = read("src/components/article-body.tsx");
  assert.doesNotMatch(body, /dangerouslySetInnerHTML/);
  assert.match(body, /\{inline\(/);
});

test("cron requires bearer secret and disables caching while logger redacts credentials", () => {
  const cron = read("src/app/api/cron/run/route.ts");
  const logger = read("src/lib/observability/logger.ts");
  assert.match(cron, /auth !== `Bearer \$\{expected\}`/);
  assert.match(cron, /cache-control["']?:\s*["']no-store["']/i);
  for (const secret of ["authorization", "SUPABASE_SECRET_KEY", "TAVILY_API_KEY", "AVEIRO_API_TOKEN", "LLM_API_KEY"]) assert.match(logger, new RegExp(secret));
});

test("Aveiro newsletter and social drafts accept caller-owned idempotency keys", () => {
  const adapter = read("src/lib/publishing/adapter.ts");
  const aveiro = read("src/lib/publishing/aveiro.ts");
  const pipeline = read("src/lib/jobs/pipeline.ts");
  assert.match(adapter, /createNewsletterDraft\(input: \{[^}]*idempotencyKey\??:/s);
  assert.match(adapter, /createSocialDraft\(input: \{[^}]*idempotencyKey\??:/s);
  assert.match(aveiro, /input\.idempotencyKey/);
  assert.match(pipeline, /idempotencyKey:\s*`newsletter:\$\{article\.id\}`/);
  assert.match(pipeline, /idempotencyKey:\s*`social:\$\{article\.id\}`/);
});

test("feed focus preferences are validated and materially change ranking", async () => {
  const { validateFeedFocus, rankForUser } = await import("../../src/core/ranking.ts");
  assert.equal(validateFeedFocus("latest"), "latest");
  assert.throws(() => validateFeedFocus("secret-algorithm"), /Invalid feed focus/);
  const candidate = {id:"a",topicIds:["t"],companyIds:[],publishedAt:new Date().toISOString(),newsworthiness:80,confidence:90};
  const topics = new Set(["t"]);
  const companies = new Set<string>();
  const topicScore = rankForUser(candidate, topics, companies, Date.now(), "topics");
  const latestScore = rankForUser(candidate, topics, companies, Date.now(), "latest");
  assert.ok(topicScore > latestScore);
});

test("preferences page persists explicit feed focus and the following feed consumes it", () => {
  const actions = read("src/app/preferences/actions.ts");
  const page = read("src/app/preferences/page.tsx");
  const following = read("src/app/following/page.tsx");
  assert.match(actions, /savePreferences/);
  assert.match(actions, /user_preferences/);
  assert.match(page, /Feed focus/i);
  assert.match(following, /feedFocus/);
  assert.match(following, /rankForUser\([^;]*feedFocus/s);
});

test("company intelligence exposes verified founders, products, acquisitions and leadership when present", () => {
  const page = read("src/app/company/[slug]/page.tsx");
  for (const label of ["Founders", "Products", "Acquisitions", "Leadership changes"]) assert.match(page, new RegExp(label, "i"));
  assert.match(page, /timeline\.filter/);
  assert.match(page, /relations\.filter/);
});
