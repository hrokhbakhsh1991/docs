import assert from "node:assert/strict";
import { test } from "node:test";

import { PrismaClient } from "@prisma/client";
import { PrismaIdentityRepository } from "../src/identity/prisma-identity.repository";

const databaseUrl = process.env.PASSWORD_CREDENTIAL_TEST_DATABASE_URL;

test(
  "Postgres atomically consumes OTP and invalidates only the owner's sessions",
  { skip: !databaseUrl },
  async () => {
    const url = new URL(databaseUrl!);
    if (
      !["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
      !url.pathname.startsWith("/codex_password_test_")
    ) {
      throw new Error(
        "PASSWORD_CREDENTIAL_TEST_DATABASE_URL must name an isolated local test database"
      );
    }
    process.env.DATABASE_URL_ADMIN = databaseUrl;
    const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const repo = new PrismaIdentityRepository();
    const user = "10000000-0000-4000-8000-000000000001";
    const other = "10000000-0000-4000-8000-000000000002";
    const tenant = "20000000-0000-4000-8000-000000000001";
    const secondTenant = "20000000-0000-4000-8000-000000000002";
    const mobile = "09120000000";
    try {
      await db.$executeRaw`INSERT INTO tenants (id, subdomain) VALUES (${tenant}::uuid, 'password-test-one'), (${secondTenant}::uuid, 'password-test-two') ON CONFLICT DO NOTHING`;
      await db.$executeRaw`INSERT INTO users (id, mobile) VALUES (${user}::uuid, ${mobile}), (${other}::uuid, ${"09120000001"})`;
      await db.$executeRaw`INSERT INTO user_tenants (user_id, tenant_id, role, status, session_version) VALUES (${user}::uuid, ${tenant}::uuid, 'owner', 'ACTIVE', 2), (${user}::uuid, ${secondTenant}::uuid, 'member', 'ACTIVE', 5), (${other}::uuid, ${tenant}::uuid, 'member', 'ACTIVE', 9)`;
      const { challengeId } = await repo.createOtpChallenge(mobile, "otp-hash", {
        purpose: "password_change",
        tenantId: tenant,
        userId: user,
      });
      const input = {
        userId: user,
        tenantId: tenant,
        mobile,
        challengeId,
        codeHash: "otp-hash",
        passwordHash: "credential-hash",
        expectedSessionVersion: 2,
      };
      assert.equal(await repo.commitPasswordCredential({ ...input, codeHash: "wrong" }), null);
      let membership = await db.userTenant.findUniqueOrThrow({
        where: { userId_tenantId: { userId: user, tenantId: tenant } },
      });
      assert.equal(membership.sessionVersion, 2);
      assert.equal(await repo.findPasswordHash(user), null);
      const results = await Promise.all([
        repo.commitPasswordCredential(input),
        repo.commitPasswordCredential(input),
      ]);
      assert.equal(results.filter((x) => x === 3).length, 1);
      assert.equal(results.filter((x) => x === null).length, 1);
      assert.equal(await repo.findPasswordHash(user), "credential-hash");
      membership = await db.userTenant.findUniqueOrThrow({
        where: { userId_tenantId: { userId: user, tenantId: secondTenant } },
      });
      assert.equal(membership.sessionVersion, 6);
      membership = await db.userTenant.findUniqueOrThrow({
        where: { userId_tenantId: { userId: other, tenantId: tenant } },
      });
      assert.equal(membership.sessionVersion, 9);
      if (process.env.PASSWORD_TEST_RLS_ROLE === "app_tour") {
        const role = await db.$queryRaw<Array<{ rolbypassrls: boolean; rolsuper: boolean }>>`
          SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_tour'
        `;
        assert.equal(role.length, 1);
        assert.equal(role[0]!.rolbypassrls || role[0]!.rolsuper, false);
        await db.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO app_tour");
        await db.$executeRawUnsafe("GRANT SELECT ON user_password_credentials TO app_tour");
        const visible = await db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL ROLE app_tour");
          return tx.$queryRaw<
            Array<{ count: bigint }>
          >`SELECT count(*)::bigint AS count FROM user_password_credentials`;
        });
        assert.equal(visible[0]?.count, 0n);
      }
    } finally {
      await db.$disconnect();
    }
  }
);
