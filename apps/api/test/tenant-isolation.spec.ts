import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

test("tenant A row not visible to tenant B; no tenant context rejects query", async (t) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("DATABASE_URL is required for tenant isolation integration test");
    return;
  }

  const { Client } = require("pg") as { Client: new (args: unknown) => any };
  const client = new Client({ connectionString });
  await client.connect();

  const tableName = `tenant_iso_${Date.now()}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const rowAId = randomUUID();

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
      [rowAId, tenantA, "secret-a"]
    );

    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]);
    const crossTenant = await client.query(
      `SELECT id FROM ${tableName} WHERE id = $1`,
      [rowAId]
    );
    assert.equal(crossTenant.rows.length, 0, "tenant B must not read tenant A row");

    await client.query("RESET app.tenant_id");
    await assert.rejects(
      () => client.query(`SELECT * FROM ${tableName}`),
      /app\.tenant_id|invalid input|current_setting|null value/i
    );
  } finally {
    await client.query(`DROP TABLE IF EXISTS ${tableName}`);
    await client.end();
  }
});
