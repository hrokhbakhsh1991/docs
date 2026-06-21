import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI_ROOT = join(PACKAGE_ROOT, "src/ui");

const FORBIDDEN_PATTERNS = [/\bapps\/web\b/, /from ["']@\//];

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      listSourceFiles(path, out);
      continue;
    }
    if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

describe("ui-package-boundary (P0 PR-2)", () => {
  it("src/ui has zero apps/web or shell @/ imports", () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(UI_ROOT)) {
      const rel = relative(PACKAGE_ROOT, file);
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          hits.push(`${rel}: ${pattern}`);
        }
      }
    }
    assert.deepEqual(hits, []);
  });
});
