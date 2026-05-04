import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../../src/database/database.config";

/**
 * Drops the database and reapplies migrations using a standalone DataSource so Nest's
 * injected TypeORM DataSource is never destroyed/reinitialized (that breaks DI).
 */
export async function resetTestDatabaseWithMigrations(): Promise<void> {
  const opts = {
    ...createDataSourceOptionsFromEnv(),
    migrations: ["src/database/migrations/*.ts"] as string[]
  };

  let ds = new DataSource(opts);
  await ds.initialize();
  await ds.dropDatabase();
  await ds.destroy();

  ds = new DataSource(opts);
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();
}
