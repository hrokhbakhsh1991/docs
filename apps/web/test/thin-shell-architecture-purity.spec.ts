/**
 * Thin Shell Phase 4q — architecture purity locks for DoD checklist §8 signals.
 * @see docs/dev/thin-shell-post-binder-closure.mdoc
 * @see docs/dev/thin-shell-remaining-checklist.md
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");
const SRC = join(WEB_ROOT, "src");
const APP = join(WEB_ROOT, "app");
const BOOTSTRAP = join(SRC, "bootstrap");

function walkSourceFiles(root: string): string[] {
  /** @type {string[]} */
  const out: string[] = [];
  if (!existsSync(root)) return out;
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) continue;
      out.push(abs);
    }
  }
  walk(root);
  return out;
}

describe("thin-shell-architecture-purity — Phase 4q DoD locks", () => {
  it("hand-written apps/web has no pluginId === denali branches", () => {
    const files = [...walkSourceFiles(SRC), ...walkSourceFiles(APP)].filter(
      (p) => !p.includes(".generated.")
    );
    assert.ok(files.length > 50, "expected a non-trivial hand-written tree");
    const hits: string[] = [];
    const re = /pluginId\s*===\s*["']denali["']/;
    for (const abs of files) {
      const text = readFileSync(abs, "utf8");
      if (re.test(text)) hits.push(relative(WEB_ROOT, abs));
    }
    assert.deepEqual(hits, []);
  });

  it("hand-written apps/web has no DEFAULT_* product plugin/workspace fallbacks", () => {
    const files = [...walkSourceFiles(SRC), ...walkSourceFiles(APP)].filter(
      (p) => !p.includes(".generated.")
    );
    const hits: string[] = [];
    const patterns = [
      /DEFAULT_[A-Z0-9_]*(PLUGIN|WORKSPACE)[A-Z0-9_]*\s*=\s*["'](denali|starter|urban)["']/,
      /\b(pluginId|workspaceType)\b\s*(?:\?\?|\|\|)\s*["'](denali|starter|urban)["']/,
      /\b(pluginId|workspaceType)\b\s*=\s*[\s\S]{0,180}\?\s*[\s\S]{0,180}:\s*["'](denali|starter|urban)["']/,
    ];
    for (const abs of files) {
      const text = readFileSync(abs, "utf8");
      if (patterns.some((re) => re.test(text))) hits.push(relative(WEB_ROOT, abs));
    }
    assert.deepEqual(hits, []);
  });

  it("generated binders have no ensureDenali* / getDenali*", () => {
    const generated = walkSourceFiles(BOOTSTRAP).filter((p) => p.includes(".generated."));
    // Exact inventory: 7 *.generated.ts registries + 3 tooling (.mjs / .d.ts) — see
    // docs/dev/thin-shell-generated-bootstrap-inventory.mdoc (no product binders).
    assert.equal(generated.length, 10, "expected exact generated bootstrap inventory count");
    const hits: string[] = [];
    for (const abs of generated) {
      const text = readFileSync(abs, "utf8");
      if (/ensureDenali|getDenali/.test(text)) hits.push(relative(WEB_ROOT, abs));
    }
    assert.deepEqual(hits, []);
  });

  it("generated binders have no static product package imports", () => {
    const generated = walkSourceFiles(BOOTSTRAP).filter((p) => p.includes(".generated."));
    const hits: string[] = [];
    // Static value imports of product packages (type-only imports from workspace-sdk are OK).
    const re =
      /(?:^|\n)\s*import\s+(?!type\b)[^;]*\s+from\s+["']@app-cloud\/workspace-(?!sdk)[^"']+["']/m;
    for (const abs of generated) {
      const text = readFileSync(abs, "utf8");
      if (re.test(text)) hits.push(relative(WEB_ROOT, abs));
    }
    assert.deepEqual(hits, []);
  });
});
