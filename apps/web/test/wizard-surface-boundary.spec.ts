/**
 * Phase 14.0 — wizard surface registry boundary
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_WIZARD = join(dirname(fileURLToPath(import.meta.url)), "../src/wizard");

function readWebSource(rel: string): string {
  return readFileSync(join(WEB_WIZARD, rel), "utf8");
}

describe("wizard-surface-boundary.spec.ts (P14-0-T07)", () => {
  it("P14-0-07a composite registry has no product package imports", () => {
    const source = readWebSource("wizard-composite-surface-registry.tsx");
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(source, /\.\/denali\//);
  });

  it("P14-0-07b review registry has no static denali review import", () => {
    const source = readWebSource("wizard-review-surface-registry.tsx");
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(source, /denali-wizard-review-surface/);
  });
});
