import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { handlePlatformTenantsList } from "../src/routes/platform/tenants-list.ts";

function makeMockReq(headers: Record<string, string | undefined>, url = "/platform/v1/tenants") {
  return { headers, url } as never;
}

function makeMockRes() {
  let status = 0;
  let body = "";
  return {
    writeHead: (s: number, _h: Record<string, string>) => {
      status = s;
    },
    end: (b: string) => {
      body = b;
    },
    _get: () => ({ status, body: body ? JSON.parse(body) : {} }),
  } as never;
}

describe("platform tenants list handler", () => {
  it("401", async () => {
    const req = makeMockReq({});
    const res = makeMockRes();
    await handlePlatformTenantsList(req, res);
    const out = res._get();
    assert.equal(out.status, 401);
  });

  it("200 items", async () => {
    process.env.PLATFORM_OPS_PHONES = "+1";
    const req = makeMockReq(
      { Authorization: "Bearer platform-ops", "X-Platform-Ops-Phone": "+1" },
      "/platform/v1/tenants?limit=10&offset=0"
    );
    const res = makeMockRes();
    const repository = new PlatformTenantRepository({
      tenant: {
        findMany: async () => [
          {
            id: "00000000-0000-4000-8000-000000000099",
            subdomain: "listed-club",
            workspaceType: "denali",
            status: "active",
            createdAt: new Date("2026-06-21T10:00:00.000Z"),
          },
        ],
        count: async () => 1,
        findUnique: async () => null,
      },
    } as never);

    await handlePlatformTenantsList(req, res, { repository });
    const out = res._get();
    assert.equal(out.status, 200);
    assert.equal(Array.isArray(out.body.items), true);
    assert.equal(out.body.items[0]?.subdomain, "listed-club");
    assert.equal(out.body.total, 1);
  });
});
