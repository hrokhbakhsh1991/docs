/**
 * Rebuilds workspace regions + destinations for tenant subdomain `denali`.
 * Deletes all rows in `workspace_destinations` and `workspace_regions` for that tenant,
 * then inserts a large catalog (see `seed-denali-locations.catalog.ts`, generated from
 * `tools/build-denali-locations-catalog.py`). Tours with old `destination_id` become NULL
 * (FK ON DELETE SET NULL).
 *
 * Regenerate catalog: `python3 apps/api/src/scripts/tools/build-denali-locations-catalog.py`
 *
 * Run: `pnpm --filter @apps/api seed:denali-locations`
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import {
  DENALI_LOCATION_BUNDLES_INTL,
  DENALI_LOCATION_BUNDLES_IRAN,
  type DenaliLocationBundle,
} from "./seed-denali-locations.catalog";
import { emitScriptInfo } from "./script-log";

type ParsedDest = { name: string; type: string | null; altitudeM: number | null };

function parseDestTokens(line: string): ParsedDest[] {
  const tokens = line.split("؛").map((s) => s.trim()).filter(Boolean);
  const out: ParsedDest[] = [];
  for (const raw of tokens) {
    const seg = raw.split("|").map((s) => s.trim());
    const name = seg[0] ?? "";
    if (!name) {
      continue;
    }
    const typePart = seg[1];
    const altPart = seg[2];
    const type = typePart && typePart.length > 0 ? typePart.slice(0, 64) : "شهر";
    let altitudeM: number | null = null;
    if (altPart !== undefined && altPart.length > 0) {
      const n = Number.parseInt(altPart, 10);
      altitudeM = Number.isFinite(n) ? n : null;
    }
    out.push({ name: name.slice(0, 255), type, altitudeM });
  }
  return out;
}

async function insertBundle(
  ds: DataSource,
  tenantId: string,
  bundle: DenaliLocationBundle,
): Promise<number> {
  const regionRows = await ds.query<Array<{ id: string }>>(
    `INSERT INTO workspace_regions (tenant_id, name, country, sort_order, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [tenantId, bundle.regionName, bundle.country, bundle.sortOrderBase],
  );
  const regionId = regionRows[0]?.id;
  if (!regionId) {
    throw new Error("INSERT workspace_regions returned no id");
  }

  const dests = parseDestTokens(bundle.destTokens);
  let n = 0;
  for (let i = 0; i < dests.length; i += 1) {
    const d = dests[i]!;
    const sort = bundle.sortOrderBase + i + 1;
    await ds.query(
      `INSERT INTO workspace_destinations
        (tenant_id, region_id, name, type, altitude_m, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [tenantId, regionId, d.name, d.type, d.altitudeM, sort],
    );
    n += 1;
  }
  return n;
}

export async function seedDenaliLocations(): Promise<void> {
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

    const tenantId = tenant.id as string;
    emitScriptInfo(`Resolved Denali workspace id=${tenantId} name=${tenant.name}`);

    const delD = await ds.query(`DELETE FROM workspace_destinations WHERE tenant_id = $1 RETURNING id`, [tenantId]);
    const delR = await ds.query(`DELETE FROM workspace_regions WHERE tenant_id = $1 RETURNING id`, [tenantId]);
    emitScriptInfo(
      `Removed ${Array.isArray(delD) ? delD.length : 0} destination(s) and ${Array.isArray(delR) ? delR.length : 0} region(s).`,
    );

    let destTotal = 0;
    for (const b of DENALI_LOCATION_BUNDLES_IRAN) {
      destTotal += await insertBundle(ds, tenantId, b);
    }
    for (const b of DENALI_LOCATION_BUNDLES_INTL) {
      destTotal += await insertBundle(ds, tenantId, b);
    }

    emitScriptInfo(
      `Inserted ${DENALI_LOCATION_BUNDLES_IRAN.length + DENALI_LOCATION_BUNDLES_INTL.length} region(s) and ${destTotal} destination(s) for denali.`,
    );
  } finally {
    await ds.destroy();
  }
}

seedDenaliLocations().catch((error: unknown) => {
  console.error(
    "seed-denali-locations failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
