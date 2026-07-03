import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  PORTAL_INTERNAL_URL: process.env.PORTAL_INTERNAL_URL,
  PORTAL_DEV_PORT: process.env.PORTAL_DEV_PORT,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.PORTAL_INTERNAL_URL = ENV_SNAPSHOT.PORTAL_INTERNAL_URL;
  process.env.PORTAL_DEV_PORT = ENV_SNAPSHOT.PORTAL_DEV_PORT;
});

describe("resolvePortalSelfFetchOrigin", () => {
  it("uses loopback + ingress host in development for custom apex SSR", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.PORTAL_INTERNAL_URL;
    process.env.PORTAL_DEV_PORT = "3003";

    const { resolvePortalSelfFetchOrigin } = await import("../src/me/resolve-portal-self-fetch-origin.js");
    const target = resolvePortalSelfFetchOrigin("portal.denali.club:3003");
    assert.equal(target.origin, "http://127.0.0.1:3003");
    assert.equal(target.ingressHost, "portal.denali.club:3003");
  });

  it("prefers PORTAL_INTERNAL_URL when set", async () => {
    process.env.NODE_ENV = "production";
    process.env.PORTAL_INTERNAL_URL = "http://127.0.0.1:3010";

    const { resolvePortalSelfFetchOrigin } = await import("../src/me/resolve-portal-self-fetch-origin.js");
    const target = resolvePortalSelfFetchOrigin("portal.denali.club");
    assert.equal(target.origin, "http://127.0.0.1:3010");
  });
});
