import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("resolve-portal-guest-egress-url", () => {
  it("redirects smoke /health fallback to catalog register", async () => {
    const previous = process.env.MARKETING_PUBLIC_BASE_URL;
    process.env.MARKETING_PUBLIC_BASE_URL = "http://127.0.0.1:3003/health";
    try {
      const { resolvePortalGuestEgressUrl } =
        await import("../src/marketing/resolve-portal-guest-egress-url.server.ts");
      assert.equal(
        resolvePortalGuestEgressUrl("127.0.0.1:3003", "operator"),
        "/catalog/00000000-0000-4000-8000-000000000210/register"
      );
      assert.equal(
        resolvePortalGuestEgressUrl("operator.portal.localhost:3003", "operator"),
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
      const { resolvePortalGuestEgressUrl } =
        await import("../src/marketing/resolve-portal-guest-egress-url.server.ts");
      assert.equal(
        resolvePortalGuestEgressUrl("operator.portal.localhost:3003", "operator"),
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

  it("uses explicit env for portal-only smoke egress without a workspace tour mapping", async () => {
    const previousMarketingUrl = process.env.MARKETING_PUBLIC_BASE_URL;
    const previousGuestTourId = process.env.PORTAL_DEV_GUEST_TOUR_ID;
    const previousLoginTourId = process.env.PORTAL_MEMBER_LOGIN_TOUR_ID;
    process.env.MARKETING_PUBLIC_BASE_URL = "http://127.0.0.1:3003/health";
    process.env.PORTAL_DEV_GUEST_TOUR_ID = "00000000-0000-4000-8000-000000000999";
    delete process.env.PORTAL_MEMBER_LOGIN_TOUR_ID;
    try {
      const { resolvePortalGuestEgressUrl } =
        await import("../src/marketing/resolve-portal-guest-egress-url.server.ts");
      assert.equal(
        resolvePortalGuestEgressUrl("127.0.0.1:3003", "alpine"),
        "/catalog/00000000-0000-4000-8000-000000000999/register"
      );
    } finally {
      if (previousMarketingUrl === undefined) {
        delete process.env.MARKETING_PUBLIC_BASE_URL;
      } else {
        process.env.MARKETING_PUBLIC_BASE_URL = previousMarketingUrl;
      }
      if (previousGuestTourId === undefined) {
        delete process.env.PORTAL_DEV_GUEST_TOUR_ID;
      } else {
        process.env.PORTAL_DEV_GUEST_TOUR_ID = previousGuestTourId;
      }
      if (previousLoginTourId === undefined) {
        delete process.env.PORTAL_MEMBER_LOGIN_TOUR_ID;
      } else {
        process.env.PORTAL_MEMBER_LOGIN_TOUR_ID = previousLoginTourId;
      }
    }
  });

  it("does not keep a portal-local fixed guest tour fallback", () => {
    const source = readFileSync(
      new URL("../src/marketing/resolve-portal-guest-egress-url.server.ts", import.meta.url),
      "utf8"
    );
    assert.equal(source.includes("DEFAULT_DEV_GUEST_TOUR_ID"), false);
  });
});
