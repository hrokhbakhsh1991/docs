import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveGuestSurfaceBootstrapForHost } from "../src/resolve-guest-surface-bootstrap";

const B_TENANT_ID = "f0ed9e65-2638-4351-847d-724f87ebbfce";
const A_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const previousMap = process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
const previousFetch = globalThis.fetch;

function setTenantSurfaceMap(): void {
  process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify({
    version: 1,
    tenants: [
      {
        tenantId: A_TENANT_ID,
        origins: {
          marketing: "https://staging-denali.shenski.com",
          admin: "https://staging-admin-denali.shenski.com",
          portal: "https://staging-portal-denali.shenski.com",
        },
        cookieDomain: "shenski.com",
      },
      {
        tenantId: B_TENANT_ID,
        origins: {
          marketing: "https://qa2.staging.test",
          admin: "https://admin.qa2.staging.test",
          portal: "https://portal.qa2.staging.test",
        },
        cookieDomain: "qa2.staging.test",
      },
    ],
  });
}

function setApiTenantContext(tenantId: string): void {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: { tenantId, pluginId: "workspace-denali", workspaceType: "denali" },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
}

afterEach(() => {
  if (previousMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
  else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = previousMap;
  globalThis.fetch = previousFetch;
});

describe("mapped guest surface bootstrap", () => {
  it("requires the API tenant context to match the allowlisted ingress binding", async () => {
    setTenantSurfaceMap();
    setApiTenantContext(B_TENANT_ID);

    const result = await resolveGuestSurfaceBootstrapForHost({
      surface: "portal",
      host: "portal.qa2.staging.test",
      resolveFetch: () => ({ apiBaseUrl: "https://api.staging.test" }),
      unresolvedError: "PORTAL_TENANT_UNRESOLVED",
    });

    assert.deepEqual(result, { tenantId: B_TENANT_ID, pluginId: "workspace-denali" });
  });

  it("rejects a host whose API context resolves to a different tenant", async () => {
    setTenantSurfaceMap();
    setApiTenantContext(A_TENANT_ID);

    await assert.rejects(
      resolveGuestSurfaceBootstrapForHost({
        surface: "portal",
        host: "portal.qa2.staging.test",
        resolveFetch: () => ({ apiBaseUrl: "https://api.staging.test" }),
        unresolvedError: "PORTAL_TENANT_UNRESOLVED",
      }),
      /PORTAL_TENANT_UNRESOLVED/
    );
  });

  it("rejects an allowlisted tenant host presented to the wrong surface", async () => {
    setTenantSurfaceMap();
    globalThis.fetch = async () => {
      throw new Error("API fetch must not run for a surface mismatch");
    };

    await assert.rejects(
      resolveGuestSurfaceBootstrapForHost({
        surface: "portal",
        host: "admin.qa2.staging.test",
        resolveFetch: () => ({ apiBaseUrl: "https://api.staging.test" }),
        unresolvedError: "PORTAL_TENANT_UNRESOLVED",
      }),
      /expected surface portal/
    );
  });

  it("rejects an unknown host without using the development tenant fallback", async () => {
    setTenantSurfaceMap();
    globalThis.fetch = async () => {
      throw new Error("API fetch must not run for an unknown host");
    };

    await assert.rejects(
      resolveGuestSurfaceBootstrapForHost({
        surface: "portal",
        host: "unknown.example",
        resolveFetch: () => ({ apiBaseUrl: "https://api.staging.test" }),
        unresolvedError: "PORTAL_TENANT_UNRESOLVED",
        devFallbackTenantId: () => A_TENANT_ID,
      }),
      /not allowlisted/
    );
  });
});
