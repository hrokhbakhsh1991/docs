/**
 * Idempotent bulk seed: 100 distinct leader-equivalent users on the workspace where
 * `leader@test.com` has an owner/leader membership.
 *
 * Emails: leader+1@test.com … leader+100@test.com (unique rows).
 * Tenant role in DB: `owner` (product "leader" — UserRole.Owner).
 *
 * Uses raw SQL for `user_tenants` so the script runs whether or not `session_version`
 * migration has been applied yet.
 *
 * Refuses NODE_ENV=production unless ALLOW_BULK_TEST_USER_SEED=true.
 */
import * as argon2 from "argon2";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { tryParseWorkspaceUserRole, UserRole } from "../common/auth/user-role.enum";

const ANCHOR_LEADER_EMAIL = "leader@test.com";
const TEST_USER_COUNT = 100;
const TEST_PASSWORD = "Test123456!";
const EMAIL_LOCAL_DOMAIN = "test.com";

const MEMBERSHIP_ROLE = UserRole.Owner;

function bulkLeaderEmail(index1Based: number): string {
  return `leader+${index1Based}@${EMAIL_LOCAL_DOMAIN}`.toLowerCase();
}

function bulkLeaderPhone(index1Based: number): string {
  return `+1555${String(index1Based).padStart(7, "0")}`;
}

function isLeaderEquivalentRole(role: string): boolean {
  const p = tryParseWorkspaceUserRole(role);
  return p === UserRole.Owner || p === UserRole.Leader;
}

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

async function hasSessionVersionColumn(ds: DataSource): Promise<boolean> {
  const rows = await ds.query<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user_tenants'
         AND column_name = 'session_version'
     ) AS exists`
  );
  return Boolean(rows[0]?.exists);
}

async function run(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_BULK_TEST_USER_SEED !== "true") {
    fail(
      "seed-bulk-test-users: refusing to run with NODE_ENV=production. " +
        "Use a non-production database or set ALLOW_BULK_TEST_USER_SEED=true after explicit review."
    );
  }

  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity]
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(UserEntity);
  const hasSv = await hasSessionVersionColumn(dataSource);

  let targetTenantId = "";
  let tenantName = "";
  let usersCreated = 0;
  let usersReused = 0;
  let membershipsCreated = 0;
  let membershipsAlready = 0;
  let membershipsRoleUpdated = 0;

  try {
    const anchorUser = await userRepo
      .createQueryBuilder("u")
      .where("LOWER(TRIM(u.email)) = LOWER(TRIM(:email))", { email: ANCHOR_LEADER_EMAIL })
      .andWhere("u.deleted_at IS NULL")
      .getOne();
    if (!anchorUser) {
      fail(
        `seed-bulk-test-users: no active user found with email "${ANCHOR_LEADER_EMAIL}". ` +
          "Run `pnpm seed` (or equivalent) first."
      );
    }

    const anchorRows = await dataSource.query<
      Array<{ tenant_id: string; role: string; name: string | null; tdel: Date | null }>
    >(
      `SELECT ut.tenant_id::text AS tenant_id, ut.role::text AS role, t.name, t.deleted_at AS tdel
       FROM user_tenants ut
       INNER JOIN tenants t ON t.id = ut.tenant_id
       WHERE ut.user_id = $1::uuid
         AND ut.deleted_at IS NULL
       ORDER BY ut.created_at ASC`,
      [anchorUser.id]
    );

    const pick = anchorRows.find(
      (r) => r.tdel == null && isLeaderEquivalentRole(r.role)
    );
    if (!pick) {
      fail(
        `seed-bulk-test-users: "${ANCHOR_LEADER_EMAIL}" has no active owner/leader membership ` +
          "in a non-deleted tenant."
      );
    }

    targetTenantId = pick.tenant_id;
    tenantName = pick.name ?? "(unknown)";

    emitScriptInfo(`Target workspace tenant_id=${targetTenantId} name=${tenantName}`);
    emitScriptInfo(
      `Seeding ${TEST_USER_COUNT} users as role=${MEMBERSHIP_ROLE} (leader-equivalent); session_version column: ${hasSv}`
    );

    const hashedPassword = await argon2.hash(TEST_PASSWORD);

    for (let i = 1; i <= TEST_USER_COUNT; i += 1) {
      const email = bulkLeaderEmail(i);
      const phone = bulkLeaderPhone(i);
      const fullName = `Leader Test ${i}`;

      let user = await userRepo
        .createQueryBuilder("u")
        .where("LOWER(TRIM(u.email)) = LOWER(TRIM(:email))", { email })
        .andWhere("u.deleted_at IS NULL")
        .getOne();
      if (!user) {
        user = await userRepo.save(
          userRepo.create({
            email,
            phone,
            hashedPassword,
            fullName,
            isEmailVerified: true,
            isPhoneVerified: true,
            telegramUserId: null
          })
        );
        usersCreated += 1;
      } else {
        usersReused += 1;
        await userRepo.update(
          { id: user.id },
          {
            phone,
            fullName,
            hashedPassword,
            isEmailVerified: true,
            isPhoneVerified: true
          }
        );
      }

      const mRows = await dataSource.query<Array<{ id: string; role: string }>>(
        `SELECT id::text AS id, role::text AS role FROM user_tenants
         WHERE user_id = $1::uuid AND tenant_id = $2::uuid AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, targetTenantId]
      );
      const existing = mRows[0];

      if (existing) {
        if (existing.role !== MEMBERSHIP_ROLE) {
          if (hasSv) {
            await dataSource.query(
              `UPDATE user_tenants SET role = $1, session_version = session_version + 1, updated_at = now()
               WHERE id = $2::uuid AND deleted_at IS NULL`,
              [MEMBERSHIP_ROLE, existing.id]
            );
          } else {
            await dataSource.query(
              `UPDATE user_tenants SET role = $1, updated_at = now()
               WHERE id = $2::uuid AND deleted_at IS NULL`,
              [MEMBERSHIP_ROLE, existing.id]
            );
          }
          membershipsRoleUpdated += 1;
        } else {
          membershipsAlready += 1;
        }
      } else {
        const newId = randomUUID();
        if (hasSv) {
          await dataSource.query(
            `INSERT INTO user_tenants (id, tenant_id, created_at, updated_at, deleted_at, user_id, role, session_version)
             VALUES ($1::uuid, $2::uuid, now(), now(), NULL, $3::uuid, $4, 1)`,
            [newId, targetTenantId, user.id, MEMBERSHIP_ROLE]
          );
        } else {
          await dataSource.query(
            `INSERT INTO user_tenants (id, tenant_id, created_at, updated_at, deleted_at, user_id, role)
             VALUES ($1::uuid, $2::uuid, now(), now(), NULL, $3::uuid, $4)`,
            [newId, targetTenantId, user.id, MEMBERSHIP_ROLE]
          );
        }
        membershipsCreated += 1;
      }
    }

    const emailPattern = `^leader\\+[0-9]+@${EMAIL_LOCAL_DOMAIN.replace(".", "\\.")}$`;

    const countRows = await dataSource.query<{ c: string }[]>(
      `SELECT COUNT(*)::text AS c FROM users u
       WHERE u.deleted_at IS NULL AND u.email ~ $1`,
      [emailPattern]
    );
    const bulkEmailCount = Number(countRows[0]?.c ?? "0");

    const memberRows = await dataSource.query<{ c: string }[]>(
      `SELECT COUNT(*)::text AS c
       FROM user_tenants ut
       INNER JOIN users u ON u.id = ut.user_id AND u.deleted_at IS NULL
       WHERE ut.tenant_id = $1::uuid
         AND ut.deleted_at IS NULL
         AND ut.role = $2
         AND u.email ~ $3`,
      [targetTenantId, MEMBERSHIP_ROLE, emailPattern]
    );
    const bulkOwnerMembershipCount = Number(memberRows[0]?.c ?? "0");

    emitScriptInfo("");
    emitScriptInfo("=== seed-bulk-test-users summary ===");
    emitScriptInfo(`target_workspace_tenant_id: ${targetTenantId}`);
    emitScriptInfo(`target_workspace_name: ${tenantName}`);
    emitScriptInfo(`users_created: ${usersCreated}`);
    emitScriptInfo(`users_reused: ${usersReused}`);
    emitScriptInfo(`memberships_created: ${membershipsCreated}`);
    emitScriptInfo(`memberships_already_existing: ${membershipsAlready}`);
    emitScriptInfo(`memberships_role_corrected: ${membershipsRoleUpdated}`);
    emitScriptInfo(`db_verification_users_leader_plus_pattern: ${bulkEmailCount}`);
    emitScriptInfo(
      `db_verification_owner_memberships_leader_plus_in_target_tenant: ${bulkOwnerMembershipCount}`
    );
    emitScriptInfo(`shared_test_password: ${TEST_PASSWORD}`);
    emitScriptInfo("sample_emails:");
    emitScriptInfo(`  ${bulkLeaderEmail(1)}`);
    emitScriptInfo(`  ${bulkLeaderEmail(2)}`);
    emitScriptInfo(`  ${bulkLeaderEmail(50)}`);
    emitScriptInfo(`  ${bulkLeaderEmail(100)}`);
    emitScriptInfo("=== done ===");

    if (bulkEmailCount < TEST_USER_COUNT || bulkOwnerMembershipCount < TEST_USER_COUNT) {
      fail(
        `seed-bulk-test-users: post-seed verification expected ${TEST_USER_COUNT} users and memberships; ` +
          `got users=${bulkEmailCount}, memberships=${bulkOwnerMembershipCount}`
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("seed-bulk-test-users failed:", message);
  if (!process.exitCode) {
    process.exitCode = 1;
  }
});
