import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test("mobile navigation keeps primary destinations available", () => {
  const header = read("src/components/site-header.tsx");
  const css = read("src/app/globals.css");
  assert.match(header, /mobile-menu/);
  for (const destination of ["Latest", "AI", "Startups", "Search", "About", "Following"]) assert.match(header, new RegExp(destination));
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.mobile-menu \{ display: block; \}/);
});

test("public and newsroom routes expose loading and recoverable error states", () => {
  for (const file of ["src/app/loading.tsx", "src/app/error.tsx", "src/app/admin/loading.tsx", "src/app/admin/error.tsx"]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
  assert.match(read("src/app/error.tsx"), /reset\(\)/);
  assert.match(read("src/app/admin/error.tsx"), /reset\(\)/);
});

test("motion respects reduced-motion preferences", () => {
  assert.match(read("src/app/globals.css"), /prefers-reduced-motion:\s*reduce/);
});

test("newsletter gives loading and network failure feedback", () => {
  const newsletter = read("src/components/newsletter-signup.tsx");
  assert.match(newsletter, /submitting/);
  assert.match(newsletter, /catch/);
  assert.match(newsletter, /aria-busy/);
});

test("analytics failures cannot become unhandled UI promises", () => {
  assert.match(read("src/components/analytics-beacon.tsx"), /\.catch\(\(\) => undefined\)/);
  assert.match(read("src/components/read-complete-beacon.tsx"), /\.catch\(\(\) => undefined\)/);
});
