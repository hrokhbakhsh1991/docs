import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePublicFallbackTenantId,
  shouldUsePublicTenantFallback,
} from "../src/tenant/resolve-public-host-fallback";

describe("resolve-public-host-fallback.spec.ts", () => {
  it("WEB-PUBLIC-HOST-01 allowlists VPS IP when configured", () => {
    const env = {
      TOUR_OPS_DEFAULT_TENANT_ID: "00000000-0000-4000-8000-000000000003",
      TOUR_OPS_PUBLIC_FALLBACK_HOSTS: "89.45.89.206",
    };
    assert.equal(shouldUsePublicTenantFallback("89.45.89.206:13000", env), true);
    assert.equal(
      resolvePublicFallbackTenantId("89.45.89.206:13000", env),
      "00000000-0000-4000-8000-000000000003"
    );
  });

  it("WEB-PUBLIC-HOST-02 rejects unknown host without allowlist match", () => {
    const env = {
      TOUR_OPS_DEFAULT_TENANT_ID: "00000000-0000-4000-8000-000000000003",
      TOUR_OPS_PUBLIC_FALLBACK_HOSTS: "89.45.89.206",
    };
    assert.equal(shouldUsePublicTenantFallback("203.0.113.1", env), false);
  });
});
