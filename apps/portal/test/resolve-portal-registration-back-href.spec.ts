import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("resolve-portal-registration-back-href", () => {
  it("uses portal root when marketing is portal /health fallback", async () => {
    const previous = process.env.MARKETING_PUBLIC_BASE_URL;
    process.env.MARKETING_PUBLIC_BASE_URL = "http://127.0.0.1:3003/health";
    try {
      const { resolvePortalRegistrationBackHref } = await import(
        "../src/marketing/resolve-portal-registration-back-href.server.ts"
      );
      assert.equal(
        resolvePortalRegistrationBackHref("127.0.0.1:3003", "00000000-0000-4000-8000-000000000210"),
        "/"
      );
    } finally {
      if (previous === undefined) {
        delete process.env.MARKETING_PUBLIC_BASE_URL;
      } else {
        process.env.MARKETING_PUBLIC_BASE_URL = previous;
      }
    }
  });

  it("login back href uses marketing base when marketing app exists", async () => {
    const previous = process.env.MARKETING_PUBLIC_BASE_URL;
    delete process.env.MARKETING_PUBLIC_BASE_URL;
    try {
      const { resolvePortalLoginBackHref } = await import(
        "../src/marketing/resolve-portal-registration-back-href.server.ts"
      );
      assert.equal(
        resolvePortalLoginBackHref("denali.portal.localhost:3003"),
        "http://denali.localhost:3002"
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
