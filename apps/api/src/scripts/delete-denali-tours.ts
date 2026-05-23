/**
 * Hard-deletes all tours (and booking/payment rows tied to those tours) for the Denali workspace.
 * Preserves tenant, owner, equipment/themes/destinations presets, and wizard templates.
 *
 * ```bash
 * ALLOW_DENALI_TOUR_DELETE=1 pnpm --filter @apps/api delete:denali-tours
 * ```
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { DENALI_SUBDOMAIN } from "./denali-tenant.fixture";
import { emitScriptInfo } from "./script-log";

type CountRow = { c: string };

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

async function deleteCount(
  ds: DataSource,
  label: string,
  sql: string,
  params: unknown[],
): Promise<number> {
  const counted = await ds.query<CountRow[]>(
    `WITH d AS (${sql} RETURNING 1) SELECT count(*)::text AS c FROM d`,
    params,
  );
  const n = Number(counted[0]?.c ?? 0);
  emitScriptInfo(`  ${label}: ${n}`);
  return n;
}

export type DeleteDenaliToursSummary = {
  tenantId: string;
  subdomain: string;
  toursBefore: number;
  deleted: Record<string, number>;
};

export async function deleteDenaliTours(): Promise<DeleteDenaliToursSummary> {
  if (process.env.ALLOW_DENALI_TOUR_DELETE?.trim() !== "1") {
    fail(
      "delete-denali-tours: set ALLOW_DENALI_TOUR_DELETE=1 to run. This permanently removes all tours for the Denali workspace.",
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DENALI_TOUR_DELETE !== "true") {
    fail(
      "delete-denali-tours: refusing production. Set ALLOW_DENALI_TOUR_DELETE=true after explicit review.",
    );
  }

  const ds = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [],
  });

  await ds.initialize();
  const deleted: Record<string, number> = {};

  try {
    const tenantRows = await ds.query<Array<{ id: string; subdomain: string }>>(
      `SELECT id, subdomain FROM tenants WHERE subdomain = $1 AND deleted_at IS NULL LIMIT 1`,
      [DENALI_SUBDOMAIN],
    );
    const tenant = tenantRows[0];
    if (!tenant) {
      fail(`delete-denali-tours: tenant subdomain "${DENALI_SUBDOMAIN}" not found.`);
    }

    const beforeRows = await ds.query<CountRow[]>(
      `SELECT count(*)::text AS c FROM tours WHERE tenant_id = $1`,
      [tenant.id],
    );
    const toursBefore = Number(beforeRows[0]?.c ?? 0);

    emitScriptInfo(
      `=== Deleting Denali tours (tenant=${tenant.subdomain}, tours_before=${toursBefore}) ===`,
    );

    await ds.query("BEGIN");
    try {
      deleted.payment_receipts = await deleteCount(
        ds,
        "payment_receipts",
        `DELETE FROM payment_receipts WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.payments = await deleteCount(
        ds,
        "payments",
        `DELETE FROM payments WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.booking_price_snapshots = await deleteCount(
        ds,
        "booking_price_snapshots",
        `DELETE FROM booking_price_snapshots WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.waitlist_items = await deleteCount(
        ds,
        "waitlist_items",
        `DELETE FROM waitlist_items WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.registrations = await deleteCount(
        ds,
        "registrations",
        `DELETE FROM registrations WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.tour_details = await deleteCount(
        ds,
        "tour_details",
        `DELETE FROM tour_details WHERE tour_id IN (SELECT id FROM tours WHERE tenant_id = $1)`,
        [tenant.id],
      );

      deleted.tours = await deleteCount(
        ds,
        "tours",
        `DELETE FROM tours WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.tour_departures = await deleteCount(
        ds,
        "tour_departures",
        `DELETE FROM tour_departures WHERE tenant_id = $1`,
        [tenant.id],
      );

      deleted.tour_products = await deleteCount(
        ds,
        "tour_products",
        `DELETE FROM tour_products WHERE tenant_id = $1`,
        [tenant.id],
      );

      await ds.query("COMMIT");
    } catch (error) {
      await ds.query("ROLLBACK");
      throw error;
    }

    const summary: DeleteDenaliToursSummary = {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      toursBefore,
      deleted,
    };

    emitScriptInfo("=== Denali tours deleted ===");
    emitScriptInfo(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && process.argv[1].includes("delete-denali-tours");

if (isDirectRun) {
  deleteDenaliTours().catch((error: unknown) => {
    console.error(
      "delete-denali-tours failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
