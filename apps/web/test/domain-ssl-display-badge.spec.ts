import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { domainSslDisplayBadge } from "../src/platform/club-detail/domain-ssl-display-badge";

describe("domainSslDisplayBadge", () => {
  it("active with future expiry stays active", () => {
    const badge = domainSslDisplayBadge({
      sslStatus: "active",
      sslExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(badge.dataSslStatus, "active");
  });

  it("active with past expiry shows expired", () => {
    const badge = domainSslDisplayBadge({
      sslStatus: "active",
      sslExpiresAt: new Date(Date.now() - 86400000).toISOString(),
    });
    assert.equal(badge.dataSslStatus, "expired");
  });
});
