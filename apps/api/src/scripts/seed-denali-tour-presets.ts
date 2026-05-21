/**
 * Inserts 10 diverse workspace tour-creation presets for tenant subdomain `denali`.
 * Idempotent for names prefixed with `دنالی-`: deletes prior seeded rows then re-inserts.
 *
 * Run from apps/api: `pnpm exec node --env-file=.env --import tsx src/scripts/seed-denali-tour-presets.ts`
 */
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

export async function seedDenaliTourPresets(): Promise<void> {
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

    await ds.query(`DELETE FROM workspace_tour_creation_presets WHERE workspace_id = $1 AND name LIKE 'دنالی-%'`, [wsId]);

    type Row = {
      sort_order: number;
      name: string;
      description: string | null;
      is_active: boolean;
      defaults: Record<string, unknown>;
    };

    const rows: Row[] = [
      {
        sort_order: 10,
        name: "دنالی-۱ کوهستانی",
        description: "قالب کوهستانی پیش‌فرض دنالی",
        is_active: true,
        defaults: {
          basicInfo: { tourType: "mountain_day" },
          programNature: { shortDescription: "برنامه پیشنهادی کوهنوردی." },
          transport: { primaryTransportMode: "bus" },
          pricingPayment: { requiresPayment: true, basePricePerPerson: 1000000 },
          participantRequirements: { minimumAge: 18 },
          policies: { cancellationPolicy: "طبق قوانین دنالی" },
        },
      },
      {
        sort_order: 20,
        name: "دنالی-۲ شهری",
        description: "قالب شهری پیش‌فرض دنالی",
        is_active: true,
        defaults: {
          basicInfo: { tourType: "nature_day" },
          programNature: { shortDescription: "برنامه پیشنهادی شهری." },
          transport: { primaryTransportMode: "private_car" },
          pricingPayment: { requiresPayment: false },
          participantRequirements: { minimumAge: 0 },
          policies: { cancellationPolicy: "توافقی" },
        },
      },
    ];

    for (const row of rows) {
      await ds.query(
        `INSERT INTO workspace_tour_creation_presets
          (workspace_id, name, description, is_active, sort_order, form_profile, defaults)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [wsId, row.name, row.description, row.is_active, row.sort_order, "denali_pilot", JSON.stringify(row.defaults)],
      );
    }

    emitScriptInfo(`Inserted ${rows.length} Denali-structure presets for workspace_id=${wsId}.`);
  } finally {
    await ds.destroy();
  }
}

seedDenaliTourPresets().catch((error: unknown) => {
  console.error(
    "seed-denali-tour-presets failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
