import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PlatformDomainRepository } from "../src/platform/platform-domain.repository.ts";
import { provisionTenantDomainSsl } from "../src/platform/provision-tenant-domain-ssl.ts";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  PLATFORM_SSL_PROVIDER: env.PLATFORM_SSL_PROVIDER,
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

describe("provisionTenantDomainSsl", () => {
  it("returns active sslStatus with stub provider", async () => {
    process.env.PLATFORM_SSL_PROVIDER = "stub";
    const domainRow = {
      id: "d1",
      tenantId: "t1",
      hostname: "www.example.com",
      surface: "marketing",
      status: "verified",
      cnameTarget: "club.example.test",
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
      verifiedAt: new Date("2026-06-21T10:00:00.000Z"),
      sslStatus: "active",
      sslExpiresAt: new Date(Date.now() + 90 * 86400000),
      sslLastError: null,
      lastObservedCname: "club.example.test",
    };
    const repository = new PlatformDomainRepository({
      tenantDomain: {
        update: async () => domainRow,
        findFirst: async () => domainRow,
      },
      $transaction: async (fn: (tx: unknown) => Promise<void>) => {
        await fn({ platformAuditEvent: { create: async () => ({}) } });
      },
    } as never);

    const dto = await provisionTenantDomainSsl(
      {
        domainId: "d1",
        hostname: "www.example.com",
        surface: "marketing",
        actorId: "+989121234567",
      },
      { domainRepository: repository, appendAudit: async () => {} }
    );

    assert.equal(dto.sslStatus, "active");
  });
});
