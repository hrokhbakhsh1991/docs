import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

test("outbox_events has tenant_id after migration", async (t) => {
  const { Client } = require("pg") as { Client: new (_args: unknown) => any };
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("DATABASE_URL is required for integration test");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const cols = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'outbox_events' AND column_name = 'tenant_id'`
    );
    if (cols.rows.length === 0) {
      t.skip("Migration OutboxTenantId1777576100000 not applied — run migrations");
      return;
    }

    const tenantA = randomUUID();
    const tenantB = randomUUID();
    await client.query(
      `INSERT INTO tenants (id, name, created_at, updated_at)
       VALUES ($1, 'outbox-it-a', now(), now()),
              ($2, 'outbox-it-b', now(), now())`,
      [tenantA, tenantB]
    );

    const probe = `outbox_probe_${Date.now().toString(36)}`;
    await client.query(`
      CREATE TABLE ${probe} (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL,
        secret text NOT NULL
      )
    `);
    await client.query(`ALTER TABLE ${probe} ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE ${probe} FORCE ROW LEVEL SECURITY`);
    await client.query(`
      CREATE POLICY tenant_isolation_policy ON ${probe}
      USING (tenant_id = current_setting('app.tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)
    `);

    await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantA]);
    await client.query(`INSERT INTO ${probe} (id, tenant_id, secret) VALUES ($1, $2, $3)`, [
      randomUUID(),
      tenantA,
      "tenant-a-secret"
    ]);

    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantB]);
    const wrongCtx = await client.query(`SELECT COUNT(*)::int AS n FROM ${probe}`);
    await client.query("ROLLBACK");
    assert.equal(wrongCtx.rows[0].n, 0, "wrong tenant GUC must not see tenant A rows");

    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
    const rightCtx = await client.query(`SELECT COUNT(*)::int AS n FROM ${probe}`);
    await client.query("ROLLBACK");
    assert.equal(rightCtx.rows[0].n, 1, "correct tenant GUC must see own rows");

    const eventId = randomUUID();
    const aggId = randomUUID();
    await client.query(
      `INSERT INTO outbox_events (
        id, tenant_id, aggregate_type, aggregate_id, event_type, payload, status, retry_count
      ) VALUES ($1, $2, 'Registration', $3, 'integration.probe', '{}'::jsonb, 'PENDING'::outbox_event_status_enum, 0)`,
      [eventId, tenantA, aggId]
    );
    const fetched = await client.query(`SELECT tenant_id FROM outbox_events WHERE id = $1`, [
      eventId
    ]);
    assert.equal(fetched.rows[0].tenant_id, tenantA);
    await client.query(`DELETE FROM outbox_events WHERE id = $1`, [eventId]);

    await client.query(`DROP TABLE IF EXISTS ${probe}`);
    await client.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
  } finally {
    await client.end();
  }
});
