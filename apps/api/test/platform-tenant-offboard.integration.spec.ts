import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { handlePlatformAuditExportGet } from "../src/routes/platform/audit-export-get.ts";
import { handlePlatformTenantsOffboardPost } from "../src/routes/platform/tenants-offboard-post.ts";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  PLATFORM_OPS_PHONES: env.PLATFORM_OPS_PHONES,
  PLATFORM_OPS_BEARER_TOKEN: env.PLATFORM_OPS_BEARER_TOKEN,
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

function makeMockReq(headers: Record<string, string | undefined>, url = "/platform/v1/audit/export") {
  return { headers, url, method: "GET" } as never;
}

function makeMockRes() {
  let status = 0;
  let body = "";
  return {
    writeHead: (s: number, _h?: Record<string, string>) => {
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

const ownerAuthRepository = {
  async findByPhone(phone: string) {
    if (phone === "+989121234567") {
      return { phone, role: "owner", createdAt: new Date() };
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

function platformOwnerHeaders() {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": "+989121234567" };
}

function platformSupportHeaders() {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": "+10000000099" };
}

describe("platform tenant offboard integration", () => {
  it("PE-01 POST offboard support returns 403 without owner role", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    delete env.PLATFORM_OPS_PHONES;
    const req = makeMockReq(platformSupportHeaders());
    const res = makeMockRes();
    await handlePlatformTenantsOffboardPost(req, res, "t1", {
      auth: { repository: supportAuthRepository },
    });
    const out = res._get();
    assert.equal(out.status, 403);
    assert.equal(out.body.code, "PLATFORM_FORBIDDEN");
  });

  it("PE-02 POST offboard owner returns 404 when tenant missing", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    delete env.PLATFORM_OPS_PHONES;
    const repository = new PlatformTenantRepository({
      tenant: { findUnique: async () => null },
    } as never);
    const req = makeMockReq(platformOwnerHeaders());
    const res = makeMockRes();
    await handlePlatformTenantsOffboardPost(req, res, "t1", {
      auth: { repository: ownerAuthRepository },
      offboard: { repository },
    });
    const out = res._get();
    assert.equal(out.status, 404);
    assert.equal(out.body.code, "NOT_FOUND");
  });

  it("PE-03 GET audit export support returns 403 without owner role", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    delete env.PLATFORM_OPS_PHONES;
    const req = makeMockReq(platformSupportHeaders());
    const res = makeMockRes();
    await handlePlatformAuditExportGet(req, res, {
      auth: { repository: supportAuthRepository },
    });
    const out = res._get();
    assert.equal(out.status, 403);
    assert.equal(out.body.code, "PLATFORM_FORBIDDEN");
  });
});
