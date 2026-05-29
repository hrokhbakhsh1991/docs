import { resetTestDatabaseWithMigrations as resetTestDatabaseWithMigrationsCore } from "@repo/testing-infra";

/**
 * Drops the database and reapplies migrations using a standalone DataSource so Nest's
 * injected TypeORM DataSource is never destroyed/reinitialized (that breaks DI).
 */
export async function resetTestDatabaseWithMigrations(): Promise<void> {
  await resetTestDatabaseWithMigrationsCore({
    migrations: ["src/database/migrations/*.ts"],
  });
}
