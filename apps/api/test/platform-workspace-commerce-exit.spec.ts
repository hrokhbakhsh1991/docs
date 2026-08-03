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
      join(repoRoot, "docs/phase-18/agent-pack/p5-c-workspace-commerce-config.md"),
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
    assert.match(mdoc, /DOC-C-01/);
    assert.match(mdoc, /commerce-schema\.ts/);
  });

  it("EX-C-03 P5-C assert bands wired to specs", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-workspace-commerce.mdoc"),
      "utf8"
    );
    const gate = readFileSync(join(repoRoot, "scripts/p5-enterprise-evolution-gate.sh"), "utf8");
    assert.match(mdoc, /platform-club-commerce-badge\.spec\.ts/);
    assert.match(mdoc, /workspace-commerce-single-mode\.spec\.ts/);
    assert.match(mdoc, /denali-offline-receipt-unchanged\.spec\.ts/);
    assert.match(mdoc, /workspace-commerce-gateway-blocked\.spec\.ts/);
    assert.match(gate, /platform-workspace-commerce-exit\.spec\.ts/);
    assert.match(gate, /workspace-commerce-single-mode\.spec\.ts/);
    assert.match(gate, /denali-offline-receipt-unchanged\.spec\.ts/);
    assert.match(gate, /workspace-commerce-gateway-blocked\.spec\.ts/);
    assert.match(gate, /tour-create-commerce-gateway-blocked\.spec\.ts/);
    assert.match(gate, /platform-workspace-definition-publish\.spec\.ts/);
    assert.match(gate, /workspace-metadata-commerce-inherit\.spec\.ts/);
    assert.match(gate, /tour-create-payment-mode-default\.spec\.ts/);
    assert.match(gate, /platform-club-commerce-badge\.spec\.ts/);
  });
});
