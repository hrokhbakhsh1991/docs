import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "./create-data-source-options-from-env";
import type { ResetTestDatabaseOptions } from "./types";

/**
 * Drops the database and reapplies migrations using a standalone DataSource so Nest's
 * injected TypeORM DataSource is never destroyed/reinitialized (that breaks DI).
 */
export async function resetTestDatabaseWithMigrations(
  options: ResetTestDatabaseOptions,
): Promise<void> {
  const opts = createDataSourceOptionsFromEnv(options.migrations);

  let ds = new DataSource(opts);
  await ds.initialize();
  await ds.dropDatabase();
  await ds.destroy();

  ds = new DataSource(opts);
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();
}
