/**
 * PCMS-SEC-03 — entitlements 401 must not SDK-fallback; 502 still may.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { evaluateMemberPortalEntitlements } from "@app-tour/workspace-sdk";

const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const PLUGIN_ID = "denali";
const HOST = "portal.denali.localhost:3003";

async function resolveWithFetch(status: number, body: unknown) {
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
  );
  try {
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    const { resolveMemberEntitlementsPayload } = await import(
      "../src/me/member-entitlements-bff.server.ts"
    );
    return await resolveMemberEntitlementsPayload({
      host: HOST,
      tenantId: TENANT_ID,
      pluginId: PLUGIN_ID,
      apiHeaders: { Authorization: "Bearer test" },
    });
  } finally {
    fetchMock.mock.restore();
  }
}

describe("resolveMemberEntitlementsPayload — PCMS-SEC-03", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("PS5-ENT-SEC-01 401 AUTH_TOKEN_REVOKED yields empty granted, not cacheable", async () => {
    const result = await resolveWithFetch(401, {
      error: { code: "AUTH_TOKEN_REVOKED" },
      code: "AUTH_TOKEN_REVOKED",
    });
    const sdk = evaluateMemberPortalEntitlements(PLUGIN_ID);
    assert.equal(result.auth, "unauthenticated");
    assert.equal(result.cacheable, false);
    assert.deepEqual([...result.payload.granted], []);
    assert.ok(sdk.granted.length > 0);
    assert.notDeepEqual([...result.payload.granted], [...sdk.granted]);
  });

  it("PS5-ENT-SEC-02 403 UNAUTHORIZED_INVALID_BEARER_TOKEN does not SDK-fallback", async () => {
    const result = await resolveWithFetch(403, {
      error: "UNAUTHORIZED_INVALID_BEARER_TOKEN",
      code: "UNAUTHORIZED_INVALID_BEARER_TOKEN",
    });
    assert.equal(result.auth, "unauthenticated");
    assert.equal(result.cacheable, false);
    assert.equal(result.payload.granted.length, 0);
  });

  it("PS5-ENT-SEC-03 502 still uses local SDK shim and is not cacheable", async () => {
    const result = await resolveWithFetch(502, { error: { code: "BACKEND_UNREACHABLE" } });
    const sdk = evaluateMemberPortalEntitlements(PLUGIN_ID);
    assert.equal(result.auth, "unavailable");
    assert.equal(result.cacheable, false);
    assert.deepEqual([...result.payload.granted], [...sdk.granted]);
    assert.ok(result.payload.granted.length > 0);
  });

  it("PS5-ENT-SEC-04 ok upstream is cacheable", async () => {
    const result = await resolveWithFetch(200, {
      ok: true,
      tenantId: TENANT_ID,
      workspaceId: PLUGIN_ID,
      evaluatedAt: "2026-08-18T00:00:00.000Z",
      granted: ["member.module.home"],
      denied: [],
    });
    assert.equal(result.auth, "ok");
    assert.equal(result.cacheable, true);
    assert.deepEqual([...result.payload.granted], ["member.module.home"]);
  });

  it("PS5-ENT-SEC-05 network failure uses SDK shim", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    try {
      process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
      const { resolveMemberEntitlementsPayload } = await import(
        "../src/me/member-entitlements-bff.server.ts"
      );
      const result = await resolveMemberEntitlementsPayload({
        host: HOST,
        tenantId: TENANT_ID,
        pluginId: PLUGIN_ID,
        apiHeaders: { Authorization: "Bearer test" },
      });
      assert.equal(result.auth, "unavailable");
      assert.equal(result.cacheable, false);
      assert.ok(result.payload.granted.length > 0);
    } finally {
      fetchMock.mock.restore();
    }
  });
});
