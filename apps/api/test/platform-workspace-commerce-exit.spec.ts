/**
 * P5-C-N-010 — optional commerce EPIC exit contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("platform-workspace-commerce-exit (P5-C optional)", () => {
  it("EX-C-01 epic spec declares optional + Denali frozen", () => {
    const spec = readFileSync(
      join(repoRoot, "TEMP/p5/p5-c-workspace-commerce-config.md"),
      "utf8"
    );
    assert.match(spec, /optional: true/);
    assert.match(spec, /denali_frozen: offline_receipt only/);
    assert.match(spec, /PC-07/);
  });

  it("EX-C-02 commerce mdoc links epic spec", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-workspace-commerce.mdoc"),
      "utf8"
    );
    assert.match(mdoc, /offline_receipt/);
    assert.match(mdoc, /p5-c-workspace-commerce-config.md/);
  });
});
