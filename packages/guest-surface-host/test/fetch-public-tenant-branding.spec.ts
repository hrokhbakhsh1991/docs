import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  fetchPublicTenantBrandingForHost,
  resetPublicTenantBrandingSnapshotCacheForTests,
} from "../src/fetch-public-tenant-branding";

describe("fetchPublicTenantBrandingForHost fail-soft cache (BUG-8)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetPublicTenantBrandingSnapshotCacheForTests();
  });

  it("GL-BRAND-FAILSOFT-01 keeps last successful displayName when a later fetch fails", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ displayName: "live-club" }), { status: 200 });
      }
      return new Response("", { status: 502 });
    }) as typeof fetch;

    const first = await fetchPublicTenantBrandingForHost("denali.localhost", {
      apiBaseUrl: "http://127.0.0.1:3001",
    });
    assert.equal(first.displayName, "live-club");

    const second = await fetchPublicTenantBrandingForHost("denali.localhost", {
      apiBaseUrl: "http://127.0.0.1:3001",
    });
    assert.equal(second.displayName, "live-club");
    assert.equal(calls, 2);
  });

  it("GL-BRAND-FAILSOFT-02 returns empty snapshot when nothing succeeded yet", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;

    const snapshot = await fetchPublicTenantBrandingForHost("denali.localhost", {
      apiBaseUrl: "http://127.0.0.1:3001",
    });
    assert.equal(snapshot.displayName, null);
  });
});
