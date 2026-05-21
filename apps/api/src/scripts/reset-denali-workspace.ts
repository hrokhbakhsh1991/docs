/**
 * Wipes **all** Denali workspace data (tours + catalog + bookings + drafts) while keeping:
 * - the `denali` tenant row
 * - the canonical Denali owner user + owner membership
 *
 * Requires `ALLOW_DENALI_RESET=1`. In production also set `ALLOW_DENALI_RESET=true`.
 *
 * ```bash
 * ALLOW_DENALI_RESET=1 pnpm --filter @apps/api reset:denali
 * ALLOW_DENALI_RESET=1 pnpm --filter @apps/api reset:denali -- --reprovision
 * ```
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import {
  DENALI_OWNER_USER_ID,
  DENALI_SUBDOMAIN,
} from "./denali-tenant.fixture";
import { emitScriptInfo } from "./script-log";
import { provisionDenaliTenant } from "./provision-denali-tenant";

type CountRow = { c: string };

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

function parseReprovisionFlag(): boolean {
  return process.argv.includes("--reprovision");
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

export type DenaliResetSummary = {
  tenantId: string;
  subdomain: string;
  ownerUserId: string;
  deleted: Record<string, number>;
  reprovisioned: boolean;
};

export async function resetDenaliWorkspace(options?: { reprovision?: boolean }): Promise<DenaliResetSummary> {
  if (process.env.ALLOW_DENALI_RESET?.trim() !== "1") {
    fail(
      "reset-denali-workspace: set ALLOW_DENALI_RESET=1 to run. This deletes tours, catalog, registrations, and non-owner members for tenant denali.",
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DENALI_RESET !== "true") {
    fail(
      "reset-denali-workspace: refusing production. Set ALLOW_DENALI_RESET=true after explicit review.",
    );
  }

  const ds = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [],
  });

  await ds.initialize();
  const deleted: Record<string, number> = {};
  let summary: DenaliResetSummary | undefined;

  try {
    const tenantRows = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE subdomain = $1 AND deleted_at IS NULL LIMIT 1`,
      [DENALI_SUBDOMAIN],
    );
    const tenantId = tenantRows[0]?.id;
    if (!tenantId) {
      fail(`reset-denali-workspace: tenant subdomain "${DENALI_SUBDOMAIN}" not found. Run provision:denali first.`);
    }
    const workspaceId = tenantId;

    emitScriptInfo(`=== Denali workspace reset (tenant_id=${tenantId}) ===`);

    await ds.query("BEGIN");

    try {
      const findings = await ds.query<CountRow[]>(
        `WITH d AS (
          DELETE FROM reconciliation_findings WHERE tenant_id = $1
          RETURNING id
        ) SELECT count(*)::text AS c FROM d`,
        [tenantId],
      );
      deleted.reconciliation_findings = Number(findings[0]?.c ?? 0);
      emitScriptInfo(`  reconciliation_findings: ${deleted.reconciliation_findings}`);

      const jobs = await ds.query<CountRow[]>(
        `WITH d AS (
          DELETE FROM reconciliation_jobs WHERE tenant_id = $1
          RETURNING id
        ) SELECT count(*)::text AS c FROM d`,
        [tenantId],
      );
      deleted.reconciliation_jobs = Number(jobs[0]?.c ?? 0);
      emitScriptInfo(`  reconciliation_jobs: ${deleted.reconciliation_jobs}`);

      deleted.payment_receipts = await deleteCount(
        ds,
        "payment_receipts",
        `DELETE FROM payment_receipts WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.payments = await deleteCount(
        ds,
        "payments",
        `DELETE FROM payments WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.booking_price_snapshots = await deleteCount(
        ds,
        "booking_price_snapshots",
        `DELETE FROM booking_price_snapshots WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.payment_gateway_idempotency = await deleteCount(
        ds,
        "payment_gateway_idempotency",
        `DELETE FROM payment_gateway_idempotency WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.waitlist_items = await deleteCount(
        ds,
        "waitlist_items",
        `DELETE FROM waitlist_items WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.registrations = await deleteCount(
        ds,
        "registrations",
        `DELETE FROM registrations WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.tour_details = await deleteCount(
        ds,
        "tour_details",
        `DELETE FROM tour_details WHERE tour_id IN (SELECT id FROM tours WHERE tenant_id = $1)`,
        [tenantId],
      );

      deleted.tours = await deleteCount(
        ds,
        "tours",
        `DELETE FROM tours WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.tour_departures = await deleteCount(
        ds,
        "tour_departures",
        `DELETE FROM tour_departures WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.tour_products = await deleteCount(
        ds,
        "tour_products",
        `DELETE FROM tour_products WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.tour_wizard_drafts = await deleteCount(
        ds,
        "tour_wizard_drafts",
        `DELETE FROM tour_wizard_drafts WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_tour_wizard_drafts = await deleteCount(
        ds,
        "workspace_tour_wizard_drafts",
        `DELETE FROM workspace_tour_wizard_drafts WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_tour_wizard_templates = await deleteCount(
        ds,
        "workspace_tour_wizard_templates",
        `DELETE FROM workspace_tour_wizard_templates WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_tour_creation_presets = await deleteCount(
        ds,
        "workspace_tour_creation_presets",
        `DELETE FROM workspace_tour_creation_presets WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_tour_themes = await deleteCount(
        ds,
        "workspace_tour_themes",
        `DELETE FROM workspace_tour_themes WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_equipment_items = await deleteCount(
        ds,
        "workspace_equipment_items",
        `DELETE FROM workspace_equipment_items WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_destinations = await deleteCount(
        ds,
        "workspace_destinations",
        `DELETE FROM workspace_destinations WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.workspace_regions = await deleteCount(
        ds,
        "workspace_regions",
        `DELETE FROM workspace_regions WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.workspace_guide_languages = await deleteCount(
        ds,
        "workspace_guide_languages",
        `DELETE FROM workspace_guide_languages WHERE workspace_id = $1`,
        [workspaceId],
      );

      deleted.workspace_invites = await deleteCount(
        ds,
        "workspace_invites",
        `DELETE FROM workspace_invites WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.idempotency_keys = await deleteCount(
        ds,
        "idempotency_keys",
        `DELETE FROM idempotency_keys WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.outbox_events = await deleteCount(
        ds,
        "outbox_events",
        `DELETE FROM outbox_events WHERE tenant_id = $1`,
        [tenantId],
      );

      emitScriptInfo("  tenant_audit_events: skipped (append-only table)");
      deleted.tenant_audit_events = 0;

      deleted.tenant_usage_daily = await deleteCount(
        ds,
        "tenant_usage_daily",
        `DELETE FROM tenant_usage_daily WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.emergency_contacts = await deleteCount(
        ds,
        "emergency_contacts",
        `DELETE FROM emergency_contacts WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.medical_profiles = await deleteCount(
        ds,
        "medical_profiles",
        `DELETE FROM medical_profiles WHERE tenant_id = $1`,
        [tenantId],
      );

      deleted.user_role_audit = await deleteCount(
        ds,
        "user_role_audit",
        `DELETE FROM user_role_audit WHERE tenant_id = $1`,
        [tenantId],
      );

      const memberRows = await ds.query<Array<{ user_id: string }>>(
        `DELETE FROM user_tenants
         WHERE tenant_id = $1 AND user_id <> $2
         RETURNING user_id`,
        [tenantId, DENALI_OWNER_USER_ID],
      );
      deleted.user_tenants = memberRows.length;
      emitScriptInfo(`  user_tenants (non-owner): ${deleted.user_tenants}`);

      const orphanUsers = await ds.query<Array<{ id: string }>>(
        `DELETE FROM users u
         WHERE u.id = ANY($1::uuid[])
           AND u.id <> $2
           AND u.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM user_tenants ut
             WHERE ut.user_id = u.id AND ut.deleted_at IS NULL
           )
         RETURNING u.id`,
        [memberRows.map((r) => r.user_id), DENALI_OWNER_USER_ID],
      );
      deleted.users_orphaned = orphanUsers.length;
      emitScriptInfo(`  users (orphaned, removed from denali only): ${deleted.users_orphaned}`);

      await ds.query("COMMIT");
    } catch (error) {
      await ds.query("ROLLBACK");
      throw error;
    }

    emitScriptInfo("=== Denali reset complete (owner preserved) ===");

    summary = {
      tenantId,
      subdomain: DENALI_SUBDOMAIN,
      ownerUserId: DENALI_OWNER_USER_ID,
      deleted,
      reprovisioned: false,
    };
  } finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }

  if (!summary) {
    fail("reset-denali-workspace: internal error — summary not built");
  }

  if (options?.reprovision) {
    emitScriptInfo("=== Re-provisioning Denali (themes, presets, template, minimal catalog) ===");
    await provisionDenaliTenant();
    summary.reprovisioned = true;
  }

  emitScriptInfo(JSON.stringify(summary, null, 2));
  return summary;
}

const isDirectRun =
  typeof process.argv[1] === "string" && process.argv[1].includes("reset-denali-workspace");

if (isDirectRun) {
  resetDenaliWorkspace({ reprovision: parseReprovisionFlag() }).catch((error: unknown) => {
    console.error(
      "reset-denali-workspace failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
