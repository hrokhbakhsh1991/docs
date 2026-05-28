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


/* merged from tenant-db-context.service.integration.spec.ts */

test("RLS enforces tenant isolation with fail-closed behavior", async (t) => {
  const { Client } = require("pg") as { Client: new (_args: unknown) => any };
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("DATABASE_URL is required for integration test");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  const tableName = `rls_test_${Date.now()}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  try {
    await client.query(
      `CREATE TABLE ${tableName} (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL,
        payload text NOT NULL
      )`
    );

    await client.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`);
    await client.query(
      `CREATE POLICY tenant_isolation_policy ON ${tableName}
       USING (tenant_id = current_setting('app.tenant_id')::uuid)
       WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)`
    );

    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    await client.query(
      `INSERT INTO ${tableName} (id, tenant_id, payload) VALUES ($1, $2, $3)`,
      [randomUUID(), tenantA, "tenant-a"]
    );

    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]);
    await client.query(
      `INSERT INTO ${tableName} (id, tenant_id, payload) VALUES ($1, $2, $3)`,
      [randomUUID(), tenantB, "tenant-b"]
    );

    await client.query("RESET app.tenant_id");
    await assert.rejects(
      () => client.query(`SELECT * FROM ${tableName}`),
      /app\.tenant_id|current_setting/
    );

    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const tenantAResult = await client.query(`SELECT payload FROM ${tableName}`);
    assert.equal(tenantAResult.rows.length, 1);
    assert.equal(tenantAResult.rows[0].payload, "tenant-a");
  } finally {
    await client.query(`DROP TABLE IF EXISTS ${tableName}`);
    await client.end();
  }
});
