import assert from "node:assert/strict";
import test from "node:test";
import { TenantDbContextService } from "../tenant-db-context.service";

test("runInTenantScope sets LOCAL app.tenant_id before user fn", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const manager = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return [];
    }
  };
  const dataSource = {
    transaction: async <T>(fn: (_m: typeof manager) => Promise<T>) => fn(manager)
  };
  const tenantSessionBindingService = {
    runInTenantContext: async <T>(_tenantId: string, fn: () => Promise<T>) => fn()
  };
  const service = new TenantDbContextService(
    dataSource as never,
    tenantSessionBindingService as never
  );

  const result = await service.runInTenantScope(
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    async () => "ok"
  );

  assert.equal(result, "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, "SELECT set_config('app.tenant_id', $1, true)");
  assert.deepEqual(calls[0].params, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
});

test("runInTenantScope rejects empty tenant id", async () => {
  const tenantSessionBindingService = {
    runInTenantContext: async <T>(_tenantId: string, fn: () => Promise<T>) => fn()
  };
  const service = new TenantDbContextService(
    {} as never,
    tenantSessionBindingService as never
  );
  await assert.rejects(
    async () => service.runInTenantScope("   ", async () => "nope"),
    /TENANT_CONTEXT_MISSING/
  );
});

test("runInTenantScope isolates tenant ids across sequential jobs on shared pool", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const manager = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return [];
    }
  };
  const dataSource = {
    transaction: async <T>(fn: (_m: typeof manager) => Promise<T>) => fn(manager)
  };
  const tenantSessionBindingService = {
    runInTenantContext: async <T>(_tenantId: string, fn: () => Promise<T>) => fn()
  };
  const service = new TenantDbContextService(
    dataSource as never,
    tenantSessionBindingService as never
  );

  await service.runInTenantScope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", async () => "job-a");
  await service.runInTenantScope("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", async () => "job-b");

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    sql: "SELECT set_config('app.tenant_id', $1, true)",
    params: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
  });
  assert.deepEqual(calls[1], {
    sql: "SELECT set_config('app.tenant_id', $1, true)",
    params: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]
  });
});
