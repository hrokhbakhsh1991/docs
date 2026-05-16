import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserRole } from "../common/auth/user-role.enum";

const TARGET_TENANT_ID = "db87dfa8-477d-4c98-8695-f06b105a1405";
const EMAIL = "leader@test.com";
/** Phone used for local OTP login (`POST /api/v2/auth/web/session/otp`, dev OTP `1234`). */
const PHONE = "+15551234567";

async function run(): Promise<void> {
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();
  try {
    const tenantRows = await dataSource.query(
      "select id from tenants where id = $1 and deleted_at is null",
      [TARGET_TENANT_ID]
    );

    if (tenantRows.length === 0) {
      await dataSource.query(
        "insert into tenants (id, name, description, subdomain) values ($1, $2, $3, $4)",
        [TARGET_TENANT_ID, "demo-tenant", "Aligned fixed tenant id for local auth", "demo"]
      );
      console.log("created tenant", TARGET_TENANT_ID);
    } else {
      await dataSource.query(
        `update tenants set subdomain = $2 where id = $1 and (subdomain is null or btrim(subdomain) = '')`,
        [TARGET_TENANT_ID, "demo"]
      );
    }

    const userRows = await dataSource.query(
      "select id from users where email = $1 and deleted_at is null limit 1",
      [EMAIL]
    );

    const placeholderHash = await argon2.hash(`fixture-${randomUUID()}`);

    let userId: string;
    if (userRows.length === 0) {
      const inserted = await dataSource.query(
        `insert into users (email, hashed_password, full_name, is_email_verified, phone, is_phone_verified)
         values ($1, $2, $3, $4, $5, true) returning id`,
        [EMAIL, placeholderHash, "Local Demo Leader", true, PHONE]
      );
      userId = inserted[0].id;
      console.log("created user", userId);
    } else {
      userId = userRows[0].id as string;
      await dataSource.query(
        "update users set phone = $2, is_phone_verified = true where id = $1",
        [userId, PHONE]
      );
      console.log("updated user phone for OTP login");
    }

    const memberships = await dataSource.query(
      "select id, role from user_tenants where user_id = $1 and tenant_id = $2 and deleted_at is null limit 1",
      [userId, TARGET_TENANT_ID]
    );

    if (memberships.length === 0) {
      await dataSource.query(
        `insert into user_tenants (tenant_id, user_id, role, session_version)
         values ($1, $2, $3, 1)`,
        [TARGET_TENANT_ID, userId, UserRole.Owner]
      );
      console.log("created membership owner");
    } else if ((memberships[0].role as string) !== UserRole.Owner) {
      await dataSource.query(
        `update user_tenants set role = $1, session_version = session_version + 1, updated_at = now()
         where id = $2`,
        [UserRole.Owner, memberships[0].id as string]
      );
      console.log("updated membership role owner (session_version bumped)");
    }

    console.log("alignment ok", { userId, tenantId: TARGET_TENANT_ID });
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(
    "ensure-auth-alignment failed:",
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exitCode = 1;
});
