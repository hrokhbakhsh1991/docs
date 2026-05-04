import * as argon2 from "argon2";
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";

const TARGET_TENANT_ID = "db87dfa8-477d-4c98-8695-f06b105a1405";
const EMAIL = "leader@test.com";
const PASSWORD = "demo123";

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
        "insert into tenants (id, name, description) values ($1, $2, $3)",
        [TARGET_TENANT_ID, "demo-tenant", "Aligned fixed tenant id for local auth"]
      );
      console.log("created tenant", TARGET_TENANT_ID);
    }

    const userRows = await dataSource.query(
      "select id, hashed_password from users where email = $1 and deleted_at is null limit 1",
      [EMAIL]
    );

    let userId: string;
    if (userRows.length === 0) {
      const hash = await argon2.hash(PASSWORD);
      const inserted = await dataSource.query(
        "insert into users (email, hashed_password, full_name, is_email_verified) values ($1, $2, $3, $4) returning id",
        [EMAIL, hash, "Local Demo Leader", true]
      );
      userId = inserted[0].id;
      console.log("created user", userId);
    } else {
      userId = userRows[0].id as string;
      const ok = await argon2.verify(userRows[0].hashed_password as string, PASSWORD).catch(() => false);
      if (!ok) {
        const hash = await argon2.hash(PASSWORD);
        await dataSource.query("update users set hashed_password = $1 where id = $2", [hash, userId]);
        console.log("updated password hash");
      }
    }

    const memberships = await dataSource.query(
      "select id, role from user_tenants where user_id = $1 and tenant_id = $2 and deleted_at is null limit 1",
      [userId, TARGET_TENANT_ID]
    );

    if (memberships.length === 0) {
      await dataSource.query(
        "insert into user_tenants (tenant_id, user_id, role) values ($1, $2, $3)",
        [TARGET_TENANT_ID, userId, "owner"]
      );
      console.log("created membership owner");
    } else if ((memberships[0].role as string) !== "owner") {
      await dataSource.query("update user_tenants set role = $1 where id = $2", [
        "owner",
        memberships[0].id as string
      ]);
      console.log("updated membership role owner");
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
