/**
 * P6-1-N-013 — guest slice integration gate (code markers — BFF behavioral tests in portal package)
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
});
