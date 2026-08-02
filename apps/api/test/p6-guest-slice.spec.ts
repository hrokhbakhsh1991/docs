/**
 * P6-1-N-013 — guest slice gate (behavioral + wiring)
 * @see docs/phase-19/p6/p6-1-guest-slice.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildDevPortalPublicBaseUrl } from "@app-tour/tenant-kernel";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("p6-guest-slice", () => {
  it("GS-01 portal registration E2E wired in p6:e2e-gate", () => {
    const gate = readFileSync(join(repoRoot, "scripts/p6-denali-e2e-gate.sh"), "utf8");
    assert.match(gate, /@apps\/portal run test:smoke/);
  });

  it("GS-02 operator marketing host resolves canonical portal base URL", () => {
    const base = buildDevPortalPublicBaseUrl({
      ingressHost: "operator.localhost:3002",
      rootDomain: "localhost",
      portalPort: "3003",
    });
    assert.match(base, /portal\.operator\.localhost:3003/);
  });
});
