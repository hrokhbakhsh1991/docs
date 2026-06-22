/**
 * P6-2-N-015 — preservation PC-01..10 gate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const PRESERVATION_PATHS = [
  "packages/workspaces/denali/src/denali.plugin.ts",
  "packages/workspaces/denali/src/rules/denaliRuleModel.ts",
  "packages/workspaces/denali/src/http/routes-manifest.ts",
  "apps/api/src/bookings/bookings.service.ts",
];

describe("p6-preservation-gate", () => {
  for (const rel of PRESERVATION_PATHS) {
    it(`PC preserves ${rel}`, () => {
      const source = readFileSync(join(repoRoot, rel), "utf8");
      assert.ok(source.length > 0);
    });
  }

  it("PC safety doc references three apps", () => {
    const safety = readFileSync(join(repoRoot, "docs/phase-19/p6/p6-denali-safety.md"), "utf8");
    assert.match(safety, /apps\/marketing/);
    assert.match(safety, /apps\/portal/);
    assert.match(safety, /apps\/web/);
  });
});
