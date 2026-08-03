import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, describe, it } from "node:test";

import { toCreateTenantResponse } from "../src/platform/create-tenant-response.dto.ts";
import { handlePlatformTenantsCreate } from "../src/routes/platform/tenants-create.ts";
import { resetPlatformIdempotencyMemoryForTests } from "../src/routes/platform/tenants-create-idempotency.ts";
import { seedPlatformPlans } from "../scripts/seed-platform-plans.ts";
import { disconnectPrisma } from "../src/db/prisma.ts";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  PLATFORM_OPS_PHONES: env.PLATFORM_OPS_PHONES,
  PLATFORM_OPS_BEARER_TOKEN: env.PLATFORM_OPS_BEARER_TOKEN,
  PLATFORM_ROOT_DOMAIN: env.PLATFORM_ROOT_DOMAIN,
};

afterEach(() => {
  resetPlatformIdempotencyMemoryForTests();
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

function makeMockReqWithBody(
  headers: Record<string, string | undefined>,
  body: string,
  url = "/platform/v1/tenants"
) {
  // Node IncomingMessage lowercases header names; mocks must match.
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return {
    headers: normalized,
    url,
    method: "POST",
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(body);
    },
  } as never;
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

const supportAuthRepository = {
  async findByPhone(phone: string) {
    if (phone === "+10000000099") {
      return { phone, role: "support", createdAt: new Date() };
    }
    return null;
  },
  async listAll() {
    return [];
  },
  async upsert() {
    throw new Error("not used");
  },
};

describe("Platform provision endpoint", () => {
  it("201+subdomain+sites.admin+invite DTO mapper", () => {
    const response = toCreateTenantResponse({
      tenant: { id: "t1", subdomain: "test", workspaceType: "denali" },
      sites: {
        admin: "https://test.admin.example.com/auth/login",
        marketing: "https://test.example.com",
        portal: "https://test.portal.example.com",
      },
      invite: { inviteId: "inv1", inviteToken: "tok1" },
    });
    assert.equal(response.tenant.subdomain, "test");
    assert.match(response.sites.admin, /admin/);
    assert.equal(response.invite.inviteId, "inv1");
  });

  it("401 unauthorized without auth headers", async () => {
    const req = makeMockReqWithBody({}, JSON.stringify({ subdomain: "x", workspaceType: "denali" }));
    const res = makeMockRes();
    await handlePlatformTenantsCreate(req, res);
    const out = res._get();
    assert.equal(out.status, 401);
    assert.equal(out.body.code, "PLATFORM_UNAUTHORIZED");
  });

  it("403 forbidden for support role", async () => {
    delete env.PLATFORM_OPS_PHONES;
    const req = makeMockReqWithBody(
      {
        Authorization: "Bearer platform-ops",
        "X-Platform-Ops-Phone": "+10000000099",
        "Idempotency-Key": randomUUID(),
      },
      JSON.stringify({
        subdomain: "support-blocked",
        workspaceType: "denali",
        ownerPhone: "+15550001001",
      })
    );
    const res = makeMockRes();
    await handlePlatformTenantsCreate(req, res, {
      auth: { repository: supportAuthRepository },
    });
    const out = res._get();
    assert.equal(out.status, 403);
    assert.equal(out.body.code, "PLATFORM_FORBIDDEN");
  });

  it("400 when Idempotency-Key missing", async () => {
    delete env.PLATFORM_OPS_PHONES;
    const req = makeMockReqWithBody(
      {
        Authorization: "Bearer platform-ops",
        "X-Platform-Ops-Phone": "+989121234567",
      },
      JSON.stringify({
        subdomain: "no-key",
        workspaceType: "denali",
        ownerPhone: "+989121234567",
      })
    );
    const res = makeMockRes();
    await handlePlatformTenantsCreate(req, res);
    const out = res._get();
    assert.equal(out.status, 400);
    assert.equal(out.body.code, "IDEMPOTENCY_KEY_REQUIRED");
  });

  const hasDatabase =
    typeof env.DATABASE_URL === "string" &&
    env.DATABASE_URL.length > 0 &&
    typeof env.DATABASE_URL_ADMIN === "string" &&
    env.DATABASE_URL_ADMIN.length > 0;

  (hasDatabase ? it : it.skip)(
    "201 handler creates tenant when DATABASE_URL set",
    async () => {
      delete env.PLATFORM_OPS_PHONES;
      // Site URL builder requires PLATFORM_ROOT_DOMAIN (readPlatformRootDomain).
      env.PLATFORM_ROOT_DOMAIN = "example.test";
      // db:test-reset truncates platform_plans; provision FK requires standard plan.
      await seedPlatformPlans();
      const subdomain = `prov-${Date.now().toString(36)}`.slice(0, 40);
      const ownerPhone = "+15550008888";
      const req = makeMockReqWithBody(
        {
          Authorization: "Bearer platform-ops",
          "X-Platform-Ops-Phone": ownerPhone,
          "Idempotency-Key": randomUUID(),
        },
        JSON.stringify({
          subdomain,
          workspaceType: "denali",
          ownerPhone,
        })
      );
      const res = makeMockRes();
      await handlePlatformTenantsCreate(req, res);
      const out = res._get();
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.ok(typeof out.body.tenant?.id === "string" && out.body.tenant.id.length > 0);
      assert.equal(out.body.tenant.subdomain, subdomain);
      assert.ok(out.body.sites !== undefined && out.body.sites !== null);
      assert.ok(
        typeof out.body.invite?.inviteToken === "string" && out.body.invite.inviteToken.length > 0
      );
      await disconnectPrisma();
    }
  );
});
