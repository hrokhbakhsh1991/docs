import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SDK_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

const ALLOWLIST_PATHS = new Set([
  path.join(SDK_SRC, "plugin/workspace-manifest-bindings.generated.ts"),
]);

const PRODUCT_PATTERN = /\b(denali|urban)\b/i;

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) listTsFiles(p, out);
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("workspace-sdk product-neutral core (P5-T04)", () => {
  it("src has no denali/urban product literals outside generated bindings", () => {
    const violations: string[] = [];
    for (const file of listTsFiles(SDK_SRC)) {
      if (ALLOWLIST_PATHS.has(file)) continue;
      if (file.endsWith(".generated.ts")) continue;
      const src = fs.readFileSync(file, "utf8");
      if (PRODUCT_PATTERN.test(src)) {
        violations.push(path.relative(SDK_SRC, file));
      }
    }
    assert.deepEqual(violations, []);
  });
});
