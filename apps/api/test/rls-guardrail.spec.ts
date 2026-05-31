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

/**
 * Ensures every public table with `workspace_id` (and no `tenant_id`) has RLS enabled,
 * FORCE ROW LEVEL SECURITY, and at least one policy (WorkspaceScopedRlsPolicy migration).
 */
test("RLS guardrail: workspace_id-only tables must enforce RLS + policies", async (t) => {
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
            AND a.attname = 'workspace_id'
        )
        AND NOT EXISTS (
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
      `Tables with workspace_id (no tenant_id) missing RLS/FORCE or policies: ${JSON.stringify(rows)}`
    );
  } finally {
    await client.end();
  }
});

const ORPHAN_CHILD_RLS_TABLES = ["tour_details", "tour_prices"] as const;

/**
 * Explicit regression guard for Gate 1 P0 tables — must remain under tenant_isolation_policy
 * even if future migrations reorder generic RLS sweeps.
 */
test("RLS guardrail: tour_details and tour_prices enforce tenant_isolation_policy", async (t) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("DATABASE_URL is required for RLS guardrail check");
    return;
  }

  const { Client } = require("pg") as { Client: new (_args: unknown) => any };
  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const tableName of ORPHAN_CHILD_RLS_TABLES) {
      const { rows } = await client.query(
        `
        SELECT
          c.relrowsecurity AS rls_enabled,
          c.relforcerowsecurity AS rls_forced,
          EXISTS (
            SELECT 1
            FROM pg_attribute a
            WHERE a.attrelid = c.oid
              AND a.attnum > 0
              AND NOT a.attisdropped
              AND a.attname = 'tenant_id'
          ) AS has_tenant_id,
          EXISTS (
            SELECT 1
            FROM pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename = c.relname
              AND p.policyname = 'tenant_isolation_policy'
          ) AS has_tenant_isolation_policy
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = $1
        `,
        [tableName]
      );

      assert.equal(rows.length, 1, `expected public.${tableName} to exist`);
      const row = rows[0] as {
        rls_enabled: boolean;
        rls_forced: boolean;
        has_tenant_id: boolean;
        has_tenant_isolation_policy: boolean;
      };
      assert.equal(row.has_tenant_id, true, `${tableName} must have tenant_id column`);
      assert.equal(row.rls_enabled, true, `${tableName} must have RLS enabled`);
      assert.equal(row.rls_forced, true, `${tableName} must have FORCE ROW LEVEL SECURITY`);
      assert.equal(
        row.has_tenant_isolation_policy,
        true,
        `${tableName} must have tenant_isolation_policy`
      );
    }
  } finally {
    await client.end();
  }
});
