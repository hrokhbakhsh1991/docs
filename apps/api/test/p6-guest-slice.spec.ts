/**
 * P6-1-N-013 — guest slice integration gate
 * @see docs/phase-19/p6/p6-1-guest-slice.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("p6-guest-slice", () => {
  it("GS-01 guest registration flow markers present", () => {
    const flow = readFileSync(
      join(repoRoot, "apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx"),
      "utf8"
    );
    assert.match(flow, /data-public-registration-phone/);
    assert.match(flow, /data-public-registration-otp/);
    assert.match(flow, /data-public-registration-success/);
  });

  it("GS-02 marketing registration URL uses portal canonical host", () => {
    const bridge = readFileSync(
      join(repoRoot, "apps/marketing/src/portal/resolve-web-registration-url.ts"),
      "utf8"
    );
    assert.match(bridge, /buildDevPortalPublicBaseUrl/);
  });

  it("GS-03 platform-portal-otp-flow mdoc exists", () => {
    const otpDoc = readFileSync(
      join(repoRoot, "docs/phase-19/platform-portal-otp-flow.mdoc"),
      "utf8"
    );
    assert.match(otpDoc, /operator\.portal\.localhost/);
  });

  it("GS-04 guest slice runbook references canonical hosts", () => {
    const runbook = readFileSync(
      join(repoRoot, "docs/phase-19/p6/runbooks/guest-slice-operator-minimal.md"),
      "utf8"
    );
    assert.match(runbook, /operator\.portal\.localhost:3003/);
  });
});
