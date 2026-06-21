/**
 * P5-D-N-010 — optional integrations EPIC exit contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("platform-integrations-plane-exit (P5-D optional)", () => {
  it("EX-D-01 epic spec declares egress-before-PSP order", () => {
    const spec = readFileSync(
      join(repoRoot, "TEMP/p5/p5-d-integrations-plane.md"),
      "utf8"
    );
    assert.match(spec, /EG-01 before PSP-01/);
    assert.match(spec, /Accounts v2/);
  });

  it("EX-D-02 integrations mdoc lists legacy anchors", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-integrations-plane.mdoc"),
      "utf8"
    );
    assert.match(mdoc, /egress-url/);
    assert.match(mdoc, /legacy-vs-denali-gap-analysis/);
  });
});
