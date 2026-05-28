import assert from "node:assert/strict";
import test from "node:test";

/**
 * Ensures every public table with column tenant_id has RLS enabled,
 * FORCE ROW LEVEL SECURITY, and at least one policy (matches migration baseline).
 */
test("RLS guardrail: tenant_id tables must enforce RLS + policies", async (t) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("DATABASE_URL is required for RLS guardrail check");
    return;
  }

  const { Client } = require("pg") as { Client: new (_args: unknown) => any };
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        (
          SELECT COUNT(*)::int
          FROM pg_policies p
          WHERE p.schemaname = n.nspname
            AND p.tablename = c.relname
        ) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1
          FROM pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND a.attname = 'tenant_id'
        )
        AND (
             NOT c.relrowsecurity
          OR NOT c.relforcerowsecurity
          OR NOT EXISTS (
               SELECT 1
               FROM pg_policies p
               WHERE p.schemaname = n.nspname
                 AND p.tablename = c.relname
             )
        )
      ORDER BY n.nspname, c.relname;
    `);

    assert.equal(
      rows.length,
      0,
      `Tables with tenant_id missing RLS/FORCE or policies: ${JSON.stringify(rows)}`
    );
  } finally {
    await client.end();
  }
});
