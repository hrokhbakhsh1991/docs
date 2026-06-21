import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toTenantDomainDto } from "../src/platform/platform-domain.dto.ts";
import { PlatformDomainRepository } from "../src/platform/platform-domain.repository.ts";

describe("platform domain repository", () => {
  it("create list", async () => {
    const rows: unknown[] = [];
    const repository = new PlatformDomainRepository({
      tenantDomain: {
        findMany: async () => rows,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: "d1",
            tenantId: data.tenantId,
            hostname: data.hostname,
            surface: data.surface,
            status: data.status,
            cnameTarget: data.cnameTarget,
            createdAt: new Date("2026-06-21T10:00:00.000Z"),
            verifiedAt: null,
            sslStatus: "pending",
            sslExpiresAt: null,
            sslLastError: null,
            lastObservedCname: null,
          };
          rows.push(row);
          return row;
        },
        findFirst: async () => null,
        deleteMany: async () => ({ count: 0 }),
        update: async () => null,
      },
    } as never);

    const created = await repository.create({
      tenantId: "t1",
      hostname: "www.example.com",
      surface: "marketing",
      cnameTarget: "club.example.test",
    });
    assert.equal(created.hostname, "www.example.com");
    assert.equal(toTenantDomainDto(created).sslStatus, "pending");
    const list = await repository.listByTenantId("t1");
    assert.equal(list.length, 1);
  });
});
