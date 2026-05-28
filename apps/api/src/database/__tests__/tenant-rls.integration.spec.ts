import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

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
