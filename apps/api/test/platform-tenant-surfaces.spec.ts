/**
 * P4-C — platform tenant detail siteSurfaces payload
 * @see docs/phase-17/platform-club-surfaces-config.mdoc (SF-05…SF-06)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DEFAULT_TENANT_SITE_SURFACES,
  normalizeTenantSiteSurfaces,
} from "../src/platform/read-tenant-site-surfaces.ts";
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

describe("platform-tenant-surfaces (P4-C SF-05/06)", () => {
  const knownId = "00000000-0000-4000-8000-000000000099";

  it("SF-05 GET tenant detail includes siteSurfaces with three booleans", async () => {
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
                subdomain: "surfaces-club",
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
      tenantConfig: {
        findUnique: async () => ({
          payload: { admin: true, marketing: false, portal: true },
        }),
      },
      operatorPendingInvite: {
        findFirst: async () => null,
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
    assert.equal(out.body.siteSurfaces.admin, true);
    assert.equal(out.body.siteSurfaces.marketing, false);
    assert.equal(out.body.siteSurfaces.portal, true);
  });

  it("SF-06 missing config defaults all true", () => {
    assert.deepEqual(normalizeTenantSiteSurfaces(undefined), DEFAULT_TENANT_SITE_SURFACES);
    assert.deepEqual(normalizeTenantSiteSurfaces(null), DEFAULT_TENANT_SITE_SURFACES);
    assert.equal(normalizeTenantSiteSurfaces({ admin: false, marketing: false }).admin, true);
    assert.equal(normalizeTenantSiteSurfaces({ admin: false, marketing: false }).marketing, false);
  });
});
