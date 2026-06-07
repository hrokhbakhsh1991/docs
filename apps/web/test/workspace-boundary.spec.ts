import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = join(WEB_ROOT, "package.json");
const SRC_DIR = join(WEB_ROOT, "src");
const APP_DIR = join(WEB_ROOT, "app");

const WORKSPACE_LAZY_LOAD_ALLOWLIST = new Set([
  join(SRC_DIR, "bootstrap", "lazy-denali-plugin.ts"),
  join(SRC_DIR, "bootstrap", "lazy-urban-plugin.ts"),
]);

const FORBIDDEN_IMPORT = [
  /from\s+['"][^'"]*workspaces\/denali/,
  /from\s+['"]@app-tour\/workspace-denali/,
  /require\s*\(\s*['"][^'"]*denali/,
  /import\s*\(\s*['"]@app-tour\/workspace-denali['"]\s*\)/,
  /from\s+['"][^'"]*workspaces\/urban/,
  /from\s+['"]@app-tour\/workspace-urban/,
  /require\s*\(\s*['"][^'"]*urban/,
  /import\s*\(\s*['"]@app-tour\/workspace-urban['"]\s*\)/,
];

function listSourceFiles(dir: string, out: string[] = []): string[] {
  if (!readdirSync(dir, { withFileTypes: true })) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listSourceFiles(p, out);
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

describe("Phase 3.3 workspace boundary", () => {
  it("has zero production dependencies on workspace product packages", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      assert.ok(!name.includes("denali"), `forbidden dependency: ${name}`);
      assert.ok(!name.includes("urban"), `forbidden dependency: ${name}`);
      assert.ok(!name.includes("workspaces/"), `forbidden workspaces dep: ${name}`);
    }
    assert.ok(!("@app-tour/workspace-denali" in (pkg.dependencies ?? {})));
    assert.ok(!("@app-tour/workspace-urban" in (pkg.dependencies ?? {})));
  });

  it("source tree contains no product workspace imports outside lazy loaders", () => {
    const hits: string[] = [];
    for (const file of [...listSourceFiles(SRC_DIR), ...listSourceFiles(APP_DIR)]) {
      if (WORKSPACE_LAZY_LOAD_ALLOWLIST.has(file)) continue;
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT) {
        if (pattern.test(src)) hits.push(`${file}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
