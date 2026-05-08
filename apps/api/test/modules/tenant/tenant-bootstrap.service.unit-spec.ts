import assert from "node:assert/strict";
import test from "node:test";
import { TenantBootstrapService } from "../../../src/modules/tenant/tenant-bootstrap.service";

test("resolveTenantFromTourId returns uuid when DB returns a row", async () => {
  const tid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const dataSource = {
    async query() {
      return [{ tenant_id: tid }];
    }
  };
  let reasonSeen = "";
  const requestContextService = {
    runWithoutTenantBinding: async <T>(reason: string, fn: () => Promise<T>) => {
      reasonSeen = reason;
      return fn();
    }
  };

  const service = new TenantBootstrapService(dataSource as never, requestContextService as never);
  const result = await service.resolveTenantFromTourId(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  );
  assert.equal(result, tid);
  assert.equal(reasonSeen, "public_tour_bootstrap_lookup");
});

test("resolveTenantFromTourId returns null when function yields SQL NULL", async () => {
  const dataSource = {
    async query() {
      return [{ tenant_id: null }];
    }
  };

  const service = new TenantBootstrapService(
    dataSource as never,
    {
      runWithoutTenantBinding: async <T>(_reason: string, fn: () => Promise<T>) => fn()
    } as never
  );
  const result = await service.resolveTenantFromTourId(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  );
  assert.equal(result, null);
});

test("resolveTenantFromTourId returns null when no rows", async () => {
  const dataSource = {
    async query() {
      return [];
    }
  };

  const service = new TenantBootstrapService(
    dataSource as never,
    {
      runWithoutTenantBinding: async <T>(_reason: string, fn: () => Promise<T>) => fn()
    } as never
  );
  const result = await service.resolveTenantFromTourId(
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  );
  assert.equal(result, null);
});
