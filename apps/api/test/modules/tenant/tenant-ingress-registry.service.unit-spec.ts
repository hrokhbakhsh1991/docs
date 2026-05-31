import assert from "node:assert/strict";
import test from "node:test";

import { TenantIngressRegistryRepository } from "../../../src/modules/tenant/repositories/tenant-ingress-registry.repository";

function buildService(input: {
  redisGet?: (key: string) => Promise<string | null>;
  redisSet?: (key: string, value: string) => Promise<string>;
  customDomainCount?: number;
  tenantById?: { id: string; subdomain: string } | null;
}) {
  const redisOps: Array<{ op: "get" | "set"; key: string; value?: string }> = [];
  const redis = {
    get: async (key: string) => {
      redisOps.push({ op: "get", key });
      return input.redisGet ? input.redisGet(key) : null;
    },
    set: async (key: string, value: string) => {
      redisOps.push({ op: "set", key, value });
      return input.redisSet ? input.redisSet(key, value) : "OK";
    },
  };

  let customDomainQueryCount = 0;
  const customDomainRepository = {
    createQueryBuilder: (_alias: string) => {
      const qb = {
        innerJoinAndSelect: () => qb,
        innerJoin: () => qb,
        where: () => qb,
        andWhere: () => qb,
        getOne: async () => {
          customDomainQueryCount += 1;
          if (!input.tenantById) {
            return null;
          }
          return {
            tenant: input.tenantById,
          };
        },
        getCount: async () => {
          customDomainQueryCount += 1;
          return input.customDomainCount ?? 0;
        },
      };
      return qb;
    },
  };

  const tenantRepository = {
    createQueryBuilder: (_alias: string) => {
      const qb = {
        where: () => qb,
        andWhere: () => qb,
        getOne: async () => input.tenantById ?? null,
      };
      return qb;
    },
  };

  const service = new TenantIngressRegistryRepository(
    customDomainRepository as never,
    tenantRepository as never,
    redis as never,
  );

  return { service, redisOps, getCustomDomainQueryCount: () => customDomainQueryCount };
}

test("resolveTenantEntityByCustomHostname: cache miss queries registry and stores tenant id", async () => {
  const tenant = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", subdomain: "acme" };
  const { service, redisOps, getCustomDomainQueryCount } = buildService({ tenantById: tenant });

  const row = await service.resolveTenantEntityByCustomHostname("bookings.customer.com");
  assert.equal(row?.id, tenant.id);
  assert.equal(getCustomDomainQueryCount(), 1);
  assert.equal(
    redisOps.some(
      (op) =>
        op.op === "set" &&
        op.key === "tenant_custom_domain:bookings.customer.com" &&
        op.value === tenant.id,
    ),
    true,
  );
});

test("resolveTenantEntityByCustomHostname: cached __none__ avoids DB lookup", async () => {
  const { service, getCustomDomainQueryCount } = buildService({
    redisGet: async (key) => (key === "tenant_custom_domain:unknown.example" ? "__none__" : null),
  });

  const row = await service.resolveTenantEntityByCustomHostname("unknown.example");
  assert.equal(row, null);
  assert.equal(getCustomDomainQueryCount(), 0);
});

test("isRegisteredWebOrigin: memory cache avoids repeated redis/db lookups", async () => {
  const { service, getCustomDomainQueryCount } = buildService({ customDomainCount: 1 });

  assert.equal(await service.isRegisteredWebOrigin("https://bookings.customer.com"), true);
  assert.equal(await service.isRegisteredWebOrigin("https://bookings.customer.com"), true);
  assert.equal(getCustomDomainQueryCount(), 1);
});

test("isRegisteredWebOrigin: redis hit memoizes denial", async () => {
  const { service, getCustomDomainQueryCount } = buildService({
    redisGet: async (key) =>
      key === "tenant_cors_origin:https://evil.example" ? "0" : null,
  });

  assert.equal(await service.isRegisteredWebOrigin("https://evil.example"), false);
  assert.equal(getCustomDomainQueryCount(), 0);
});
