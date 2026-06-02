/**
 * Deletes all workspace_equipment_items for tenant subdomain `denali` (no re-seed).
 * Run: pnpm --filter @apps/api clear:denali-equipment
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

export async function clearDenaliEquipment(): Promise<number> {
  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();
  try {
    const tenants = await ds.query<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      ["denali"],
    );
    const tenant = tenants[0];
    if (!tenant) {
      throw new Error("No active tenant with subdomain `denali`.");
    }

    const del = await ds.query<{ id: string }[]>(
      `DELETE FROM workspace_equipment_items WHERE workspace_id = $1 RETURNING id`,
      [tenant.id],
    );
    const count = Array.isArray(del) ? del.length : 0;
    emitScriptInfo(`Cleared ${count} equipment item(s) for workspace ${tenant.name} (${tenant.id}).`);
    return count;
  } finally {
    await ds.destroy();
  }
}

const invokedAsScript = process.argv[1]?.includes("clear-denali-equipment") ?? false;
if (invokedAsScript) {
  clearDenaliEquipment()
    .then((count) => {
      process.exit(count >= 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
