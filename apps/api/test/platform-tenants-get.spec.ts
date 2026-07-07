import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { handlePlatformTenantsGet } from "../src/routes/platform/tenants-get.ts";

function makeMockReq(headers: Record<string, string | undefined>) {
  return { headers } as never;
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

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  PLATFORM_OPS_PHONES: env.PLATFORM_OPS_PHONES,
  PLATFORM_ROOT_DOMAIN: env.PLATFORM_ROOT_DOMAIN,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

const mockAuthRepository = {
  async findByPhone() {
    return null;
  },
  async listAll() {
    return [];
  },
  async upsert() {
    throw new Error("not used");
  },
};

describe("platform tenants get handler", () => {
  const knownId = "00000000-0000-4000-8000-000000000099";
  const unknownId = "00000000-0000-4000-8000-000000000000";

  it("200 subdomain", async () => {
    delete env.PLATFORM_OPS_PHONES;
    env.PLATFORM_ROOT_DOMAIN = "example.test";
    const req = makeMockReq({
      Authorization: "Bearer platform-ops",
      "X-Platform-Ops-Phone": "+15550009999",
    });
    const res = makeMockRes();
    const repository = new PlatformTenantRepository({
      tenant: {
        findMany: async () => [],
        count: async () => 0,
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === knownId
            ? {
                id: knownId,
                subdomain: "get-club",
                workspaceType: "denali",
                status: "active",
                createdAt: new Date("2026-06-21T10:00:00.000Z"),
                offboardingStartedAt: null,
                scheduledDeletionAt: null,
                workspaceDefinitionId: null,
                workspaceDefinitionVersion: null,
              }
            : null,
      },
      operatorPendingInvite: {
        findFirst: async () => null,
      },
      tenantConfig: {
        findUnique: async () => null,
      },
    } as never);

    await handlePlatformTenantsGet(req, res, knownId, {
      repository,
      subscriptionRepository: {
        getByTenantId: async () => null,
      } as never,
      auth: { repository: mockAuthRepository },
    });
    const out = res._get();
    assert.equal(out.status, 200);
    assert.equal(out.body.tenant.subdomain, "get-club");
    assert.match(out.body.sites.marketing, /get-club/);
    assert.equal(out.body.workspaceDefinition, null);
    assert.equal(out.body.workspaceCommerce.paymentMode, "offline_receipt");
    assert.equal(out.body.workspaceCommerce.gatewayProvider, null);
  });

  it("404 uuid", async () => {
    delete env.PLATFORM_OPS_PHONES;
    const req = makeMockReq({
      Authorization: "Bearer platform-ops",
      "X-Platform-Ops-Phone": "+15550009999",
    });
    const res = makeMockRes();
    const repository = new PlatformTenantRepository({
      tenant: {
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => null,
      },
    } as never);

    await handlePlatformTenantsGet(req, res, unknownId, {
      repository,
      auth: { repository: mockAuthRepository },
    });
    const out = res._get();
    assert.equal(out.status, 404);
    assert.equal(out.body.code, "NOT_FOUND");
  });
});
