import assert from "node:assert/strict";
import test from "node:test";
import { TenantRuntimeGuardService } from "./tenant-runtime-guard.service";

test("enforceTenantRuntimePolicies applies rate-limit only action", async () => {
  let rateLimitCalls = 0;
  let usageCalls = 0;
  const service = new TenantRuntimeGuardService(
    {
      enforceHttpRateLimit: async () => {
        rateLimitCalls += 1;
      }
    } as never,
    {
      enforceHttpUsageMetering: async () => {
        usageCalls += 1;
      }
    } as never
  );

  await service.enforceTenantRuntimePolicies({} as never, "http_rate_limit");
  assert.equal(rateLimitCalls, 1);
  assert.equal(usageCalls, 0);
});

test("enforceTenantRuntimePolicies applies usage-metering only action", async () => {
  let rateLimitCalls = 0;
  let usageCalls = 0;
  const service = new TenantRuntimeGuardService(
    {
      enforceHttpRateLimit: async () => {
        rateLimitCalls += 1;
      }
    } as never,
    {
      enforceHttpUsageMetering: async () => {
        usageCalls += 1;
      }
    } as never
  );

  await service.enforceTenantRuntimePolicies({} as never, "http_usage_metering");
  assert.equal(rateLimitCalls, 0);
  assert.equal(usageCalls, 1);
});

test("enforceTenantRuntimePolicies applies both checks for http_all", async () => {
  let rateLimitCalls = 0;
  let usageCalls = 0;
  const service = new TenantRuntimeGuardService(
    {
      enforceHttpRateLimit: async () => {
        rateLimitCalls += 1;
      }
    } as never,
    {
      enforceHttpUsageMetering: async () => {
        usageCalls += 1;
      }
    } as never
  );

  await service.enforceTenantRuntimePolicies({} as never, "http_all");
  assert.equal(rateLimitCalls, 1);
  assert.equal(usageCalls, 1);
});


/* merged from tenant-runtime-guard.service.integration.spec.ts */

test("tenant-scoped tables reject cross-tenant reads via app.tenant_id", async (t) => {
  const { Client } = require("pg") as { Client: new (_args: unknown) => any };
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("DATABASE_URL is required for integration test");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const inviteId = randomUUID();
  const auditId = randomUUID();
  const inviteToken = `rls-${randomUUID().replace(/-/g, "")}`;

  try {
    await client.query(`INSERT INTO tenants (id, name) VALUES ($1::uuid, $2), ($3::uuid, $4)`, [
      tenantA,
      "RLS Tenant A",
      tenantB,
      "RLS Tenant B"
    ]);
    await client.query(
      `INSERT INTO users (id, email, hashed_password, full_name, is_email_verified)
       VALUES
        ($1::uuid, $2, $3, $4, true),
        ($5::uuid, $6, $7, $8, true)`,
      [
        userA,
        `rls-a-${randomUUID()}@example.com`,
        "x".repeat(60),
        "RLS User A",
        userB,
        `rls-b-${randomUUID()}@example.com`,
        "x".repeat(60),
        "RLS User B"
      ]
    );

    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    await client.query(
      `INSERT INTO workspace_invites (id, tenant_id, email, role, token, expires_at, created_by)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, now() + interval '1 day', $6::uuid)`,
      [inviteId, tenantA, "invitee@example.com", "member", inviteToken, userA]
    );
    await client.query(
      `INSERT INTO user_role_audit (id, tenant_id, actor_user_id, target_user_id, old_role, new_role)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6)`,
      [auditId, tenantA, userA, userB, "member", "admin"]
    );
    await client.query(
      `INSERT INTO tenant_usage_daily (tenant_id, date, api_requests, background_jobs, storage_bytes, login_attempts)
       VALUES ($1::uuid, CURRENT_DATE, 10, 1, 0, 2)
       ON CONFLICT (tenant_id, date) DO UPDATE SET api_requests = EXCLUDED.api_requests`,
      [tenantA]
    );

    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]);

    const inviteRows = await client.query(
      `SELECT COUNT(*)::int AS count FROM workspace_invites WHERE tenant_id = $1::uuid`,
      [tenantA]
    );
    const auditRows = await client.query(
      `SELECT COUNT(*)::int AS count FROM user_role_audit WHERE tenant_id = $1::uuid`,
      [tenantA]
    );
    const usageRows = await client.query(
      `SELECT COUNT(*)::int AS count FROM tenant_usage_daily WHERE tenant_id = $1::uuid`,
      [tenantA]
    );

    assert.equal(inviteRows.rows[0]?.count, 0);
    assert.equal(auditRows.rows[0]?.count, 0);
    assert.equal(usageRows.rows[0]?.count, 0);
  } finally {
    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    await client.query(`DELETE FROM workspace_invites WHERE id = $1::uuid`, [inviteId]);
    await client.query(`DELETE FROM user_role_audit WHERE id = $1::uuid`, [auditId]);
    await client.query(`DELETE FROM tenant_usage_daily WHERE tenant_id = $1::uuid`, [tenantA]);
    await client.query("RESET app.tenant_id");
    await client.query(`DELETE FROM users WHERE id = $1::uuid OR id = $2::uuid`, [userA, userB]);
    await client.query(`DELETE FROM tenants WHERE id = $1::uuid OR id = $2::uuid`, [tenantA, tenantB]);
    await client.end();
  }
});
