import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = join(WEB_ROOT, "package.json");
const SRC_DIR = join(WEB_ROOT, "src");
const APP_DIR = join(WEB_ROOT, "app");

const FORBIDDEN_IMPORT = [
  /from\s+['"][^'"]*workspaces\/denali/,
  /from\s+['"]@app-tour\/workspace-denali/,
  /require\s*\(\s*['"][^'"]*denali/,
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
  it("has zero dependencies on packages/workspaces/denali", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      assert.ok(!name.includes("denali"), `forbidden dependency: ${name}`);
      assert.ok(!name.includes("workspaces/"), `forbidden workspaces dep: ${name}`);
    }
    assert.ok(!("@app-tour/workspace-denali" in (pkg.dependencies ?? {})));
  });

  it("source tree contains no denali workspace imports", () => {
    const hits: string[] = [];
    for (const file of [...listSourceFiles(SRC_DIR), ...listSourceFiles(APP_DIR)]) {
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT) {
        if (pattern.test(src)) hits.push(`${file}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
