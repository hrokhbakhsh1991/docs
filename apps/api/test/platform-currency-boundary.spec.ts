import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "../../..");

const PRODUCTION_ROOTS = [
  "apps/api/src",
  "apps/web/app",
  "apps/web/src",
  "apps/marketing/app",
  "apps/marketing/src",
  "apps/portal/app",
  "apps/portal/src",
  "packages/booking-http-contracts/src",
  "packages/finance-core/src",
  "packages/finance-http-contracts/src",
  "packages/guest-workspace-runtime/src",
  "packages/platform-core/src",
  "packages/session-client/src",
  "packages/tenant-kernel/src",
  "packages/workspace-sdk/src",
] as const;

const SOURCE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const GENERATED_SEGMENT_RE = /(?:^|[/\\])[^/\\]+\.generated\.[^/\\]+$/;
const SKIP_DIRS = new Set([".next", "coverage", "dist", "node_modules"]);

const CURRENCY_FALLBACK_PATTERNS: ReadonlyArray<RegExp> = [
  /\bcurrency\b[^;\n]*(?:\?\?|\|\|)\s*["'](?:IRR|USD)["']/i,
  /\b[A-Za-z]*Currency\b[^;\n]*(?:\?\?|\|\|)\s*["'](?:IRR|USD)["']/,
  /\bsetCurrency\(\s*["'](?:IRR|USD)["']\s*\)/,
  /\bformatMinorAmount\([^)\n]*,\s*["']IRR["'][^)\n]*\)/,
];

function walkSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(join(dir, entry.name));
        }
        continue;
      }
      if (!SOURCE_FILE_RE.test(entry.name)) {
        continue;
      }
      const abs = join(dir, entry.name);
      if (!GENERATED_SEGMENT_RE.test(abs)) {
        out.push(abs);
      }
    }
  }
  walk(root);
  return out;
}

describe("platform currency boundary", () => {
  it("host/shared production code does not invent IRR/USD currency fallbacks", () => {
    const hits: string[] = [];
    const files = PRODUCTION_ROOTS.flatMap((root) => walkSourceFiles(join(REPO_ROOT, root)));
    assert.ok(files.length > 100, "expected a non-trivial production source inventory");

    for (const abs of files) {
      const source = readFileSync(abs, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        if (CURRENCY_FALLBACK_PATTERNS.some((pattern) => pattern.test(line))) {
          hits.push(`${relative(REPO_ROOT, abs)}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    assert.deepEqual(hits, []);
  });
});
