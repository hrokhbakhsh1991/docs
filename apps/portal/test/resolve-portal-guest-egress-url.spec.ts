import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("resolve-portal-guest-egress-url", () => {
  it("redirects smoke /health fallback to catalog register", async () => {
    const previous = process.env.MARKETING_PUBLIC_BASE_URL;
    process.env.MARKETING_PUBLIC_BASE_URL = "http://127.0.0.1:3003/health";
    try {
      const { resolvePortalGuestEgressUrl } = await import(
        "../src/marketing/resolve-portal-guest-egress-url.server.ts"
      );
      assert.equal(
        resolvePortalGuestEgressUrl("127.0.0.1:3003"),
        "/catalog/00000000-0000-4000-8000-000000000210/register"
      );
      assert.equal(
        resolvePortalGuestEgressUrl("operator.portal.localhost:3003"),
        "/catalog/00000000-0000-4000-8000-000000000210/register"
      );
    } finally {
      if (previous === undefined) {
        delete process.env.MARKETING_PUBLIC_BASE_URL;
      } else {
        process.env.MARKETING_PUBLIC_BASE_URL = previous;
      }
    }
  });

  it("keeps external marketing egress URL", async () => {
    const previous = process.env.MARKETING_PUBLIC_BASE_URL;
    process.env.MARKETING_PUBLIC_BASE_URL = "http://operator.localhost:3002";
    try {
      const { resolvePortalGuestEgressUrl } = await import(
        "../src/marketing/resolve-portal-guest-egress-url.server.ts"
      );
      assert.equal(
        resolvePortalGuestEgressUrl("operator.portal.localhost:3003"),
        "http://operator.localhost:3002"
      );
    } finally {
      if (previous === undefined) {
        delete process.env.MARKETING_PUBLIC_BASE_URL;
      } else {
        process.env.MARKETING_PUBLIC_BASE_URL = previous;
      }
    }
  });
});
