import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort().map((name) => readFileSync(join(dir, name), "utf8")).join("\n");

function createdPublicTables(): string[] {
  return [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map((match) => match[1]!.toLowerCase());
}

test("every public table created by migrations enables RLS", () => {
  const missing = createdPublicTables().filter((table) => !new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i").test(sql));
  assert.deepEqual(missing, []);
});

test("security definer functions pin search_path", () => {
  const functionBlocks = [...sql.matchAll(/create\s+or\s+replace\s+function[\s\S]*?\$\$;/gi)].map((match) => match[0]);
  const offenders = functionBlocks.filter((block) => /security\s+definer/i.test(block) && !/set\s+search_path\s*=\s*''/i.test(block));
  assert.equal(offenders.length, 0);
});

test("privileged RPCs are not executable by anon or authenticated", () => {
  for (const name of ["claim_job_batch", "publish_article", "merge_stories", "split_story_source", "publish_correction"]) {
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\([^;]+from\\s+public,\\s*anon,\\s*authenticated`, "i"), name);
  }
});

test("job claiming is atomic with skip locked", () => {
  assert.match(sql, /for\s+update\s+skip\s+locked/i);
});

test("no migration grants anon write access to public tables", () => {
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[^;]*\s+to\s+anon\b/i);
});

test("ordinary API roles have no broad write privilege on canonical tables", () => {
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger[\s\S]*on all tables in schema public[\s\S]*from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on public\.user_preferences to authenticated/i);
  assert.match(sql, /grant update \(display_name, avatar_url\) on public\.profiles to authenticated/i);
});
