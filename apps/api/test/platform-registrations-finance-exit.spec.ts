/**
 * P5-E-N-006 — optional registrations/finance EPIC exit + path B
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("platform-registrations-finance-exit (P5-E optional)", () => {
  it("EX-E-01 epic spec preserves receipt flow", () => {
    const spec = readFileSync(
      join(repoRoot, "TEMP/p5/p5-e-registrations-finance.md"),
      "utf8"
    );
    assert.match(spec, /PC-06/);
    assert.match(spec, /PC-07/);
  });

  it("EX-E-02 exit checklist path B references P5-E-N-006", () => {
    const checklist = readFileSync(join(repoRoot, "TEMP/p5-exit-checklist.md"), "utf8");
    assert.match(checklist, /Path B — P5-full/);
    assert.match(checklist, /P5-E-N-006/);
  });

  it("EX-E-03 mdoc + gate wire P5-E specs", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-registrations-finance-tranche.mdoc"),
      "utf8"
    );
    const gate = readFileSync(join(repoRoot, "scripts/p5-enterprise-evolution-gate.sh"), "utf8");
    assert.match(mdoc, /registration-capacity\.service\.ts/);
    assert.match(mdoc, /public-registration-throttle\.ts/);
    assert.match(mdoc, /assert-paid-tour-open-gate\.ts/);
    assert.match(mdoc, /tour-created-finance-side-effect\.ts/);
    assert.match(gate, /registration-capacity\.spec\.ts/);
    assert.match(gate, /paid-tour-open-gate\.spec\.ts/);
    assert.match(gate, /tour-created-finance-side-effect\.spec\.ts/);
    assert.match(gate, /platform-registrations-finance-exit\.spec\.ts/);
  });

  it("EX-E-04 FIN-01 publish gate + REG throttle wired in API host", async () => {
    const { assertPaidTourOpenCommerceGateOnPublishTransition } = await import(
      "../src/registrations/index.ts"
    );
    assert.equal(typeof assertPaidTourOpenCommerceGateOnPublishTransition, "function");

    const canonical = readFileSync(
      join(repoRoot, "apps/api/src/canonical/canonical-tour.service.ts"),
      "utf8"
    );
    const tours = readFileSync(join(repoRoot, "apps/api/src/tours/tours.service.ts"), "utf8");
    const urbanRoutes = readFileSync(join(repoRoot, "apps/api/src/urban/urban.routes.ts"), "utf8");

    assert.match(canonical, /assertPaidTourOpenCommerceGateOnPublishTransition/);
    assert.match(tours, /commerce,/);
    assert.match(urbanRoutes, /assertPublicRegistrationThrottle/);
  });
});
