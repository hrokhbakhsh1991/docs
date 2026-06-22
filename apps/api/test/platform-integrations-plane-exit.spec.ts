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
    assert.match(mdoc, /assert-safe-outbound-url\.ts/);
    assert.match(mdoc, /Egress URL guard \(frozen — P5-D-N-002/);
    assert.match(mdoc, /Zibal payment adapter \(frozen — P5-D-N-004 PSP-01\)/);
    assert.match(mdoc, /integrations\/payments\/zibal/);
    assert.match(mdoc, /Stripe Connect Accounts v2 \(frozen — P5-D-N-005 PSP-02\)/);
    assert.match(mdoc, /integrations\/payments\/stripe-connect-v2/);
    assert.match(mdoc, /Payments webhook ingress \(frozen — P5-D-N-006 WH-01\)/);
    assert.match(mdoc, /integrations\/webhooks/);
    assert.match(mdoc, /Payments webhook replay cache \(frozen — P5-D-N-007 WH-02\)/);
    assert.match(mdoc, /payments-webhook-replay-cache\.ts/);
    assert.match(mdoc, /Super Admin PSP status \(frozen — P5-D-N-008 UI-03\)/);
    assert.match(mdoc, /club-psp-status\.tsx/);
  });

  it("EX-D-03 gate script wires INT-01 mock suite and P5-D API specs", () => {
    const gate = readFileSync(join(repoRoot, "scripts/p5-enterprise-evolution-gate.sh"), "utf8");
    assert.match(gate, /integrations-plane-mock\.spec\.ts/);
    assert.match(gate, /egress-url\.spec\.ts/);
    assert.match(gate, /zibal-adapter\.spec\.ts/);
    assert.match(gate, /stripe-v2-account\.spec\.ts/);
    assert.match(gate, /payments-webhook-signature\.spec\.ts/);
    assert.match(gate, /payments-webhook-replay\.spec\.ts/);
    assert.match(gate, /platform-club-psp-status\.spec\.ts/);
  });

  it("EX-D-04 GU-02 lift env documented in integrations mdoc", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-integrations-plane.mdoc"),
      "utf8"
    );
    const guard = readFileSync(
      join(
        repoRoot,
        "apps/api/src/workspace-metadata/assert-workspace-commerce-gateway-blocked.ts"
      ),
      "utf8"
    );
    assert.match(mdoc, /P5-D exit \+ GU-02 lift \(frozen — P5-D-N-010 EX-D\)/);
    assert.match(mdoc, /P5_D_GATEWAY_ACTIVATION_ENABLED=true/);
    assert.match(mdoc, /integrations-plane-mock\.spec\.ts/);
    assert.match(guard, /P5_D_GATEWAY_ACTIVATION_ENABLED/);
    assert.match(guard, /isWorkspaceCommerceGatewayActivationEnabled/);
  });
});
