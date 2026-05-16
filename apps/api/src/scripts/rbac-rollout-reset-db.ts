/**
 * Dev-only: drop database, re-run migrations (prompt.md reset step).
 *
 *   pnpm --filter @apps/api rbac-rollout:reset-db
 *
 * Take a backup first:
 *   pg_dump -Fc -f backup_$(date +%F).dump "$DATABASE_URL"
 */
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

async function run(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_RBAC_ROLLOUT_RESET !== "true") {
    throw new Error(
      "rbac-rollout-reset-db: refusing production. Set ALLOW_RBAC_ROLLOUT_RESET=true after backup.",
    );
  }

  const opts = {
    ...createDataSourceOptionsFromEnv(),
    migrations: ["src/database/migrations/*.ts"] as string[],
  };

  emitScriptInfo("Dropping database and re-applying migrations…");

  let ds = new DataSource(opts);
  await ds.initialize();
  await ds.dropDatabase();
  await ds.destroy();

  ds = new DataSource(opts);
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();

  emitScriptInfo("Database reset complete. Run: pnpm --filter @apps/api seed:rbac-rollout");
}

run().catch((error: unknown) => {
  console.error("rbac-rollout-reset-db failed:", error);
  process.exit(1);
});
