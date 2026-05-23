/**
 * Purges legacy Denali factory preset rows (`دنالی-%`, `دنالی —%`) without re-inserting mock defaults.
 *
 * Run from apps/api: `pnpm exec node --env-file=.env --import tsx src/scripts/seed-denali-tour-presets.ts`
 */
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

export async function purgeLegacyDenaliTourPresets(): Promise<void> {
  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();
  try {
    const tenants = await ds.query<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      ["denali"],
    );
    const tenant = tenants[0];
    if (!tenant) {
      console.error("No active tenant with subdomain `denali`. Create/fix subdomain first.");
      process.exitCode = 1;
      return;
    }

    const wsId = tenant.id as string;
    emitScriptInfo(`Resolved Denali workspace (tenant) id=${wsId} name=${tenant.name}`);

    const legacy = await ds.query<Array<{ count: string }>>(
      `WITH deleted AS (
         DELETE FROM workspace_tour_creation_presets
         WHERE workspace_id = $1
           AND (name LIKE 'دنالی-%' OR name LIKE 'دنالی —%')
         RETURNING 1
       )
       SELECT count(*)::text AS count FROM deleted`,
      [wsId],
    );
    const removed = Number(legacy[0]?.count ?? 0);
    emitScriptInfo(
      `Removed ${removed} legacy factory preset row(s). Re-run provision:denali for blank routing presets.`,
    );
  } finally {
    await ds.destroy();
  }
}

purgeLegacyDenaliTourPresets().catch((error: unknown) => {
  console.error(
    "seed-denali-tour-presets failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
