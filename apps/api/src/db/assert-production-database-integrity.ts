import { Prisma, PrismaClient } from "@prisma/client";

import { assertProductionMigrationHead } from "./migration-head-preflight";
import { resolveStorageDriver } from "../storage/create-tour-storage";
import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { isProdlikeRuntimeProfile } from "../server/runtime-profile";

export const PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS = "PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS";
export const PRODUCTION_DATABASE_RLS_NOT_APPLIED = "PRODUCTION_DATABASE_RLS_NOT_APPLIED";

/**
 * Tenant-scoped tables that must have RLS enabled+forced before production ingress.
 * Keep in sync with ENABLE+FORCE migrations (TODO-003 / PREV-AUD-003).
 */
export const TENANT_RLS_TABLES = [
  "tours",
  "outbox_events",
  "audit_events",
  "http_idempotency_records",
  "processed_domain_events",
  "operator_registrations",
  "payments",
  "payment_receipts",
  "finance_schedules",
  "finance_recon_findings",
  "finance_recon_actions",
  "operator_pending_invites",
  "user_tenants",
  "urban_registrations",
  "tenant_routes",
  "tenant_subscriptions",
  "operator_user_role_audit",
  "outbox_replay_runs",
  "tenant_config",
  "workspace_equipment",
  "workspace_tour_themes",
  "workspace_guide_languages",
  "workspace_tour_presets",
  "workspace_regions",
  "workspace_destinations",
  "operator_settings_audit_events",
  "workspace_draft_snapshots",
  "workspace_draft_events",
  "workspace_telegram_bots",
  "integration_connections",
  "integration_delivery_jobs",
  "integration_event_policies",
  "integration_secrets",
  "exposure_intents",
  "exposure_profiles",
  "denali_exposure_reminder_activations",
  "users",
  "mobile_otp_challenges",
  "tenant_domains",
] as const;

export type TenantRlsTableRow = {
  readonly relname: string;
  readonly relrowsecurity: boolean;
  readonly relforcerowsecurity: boolean;
};

export function assertAppRoleDoesNotBypassRls(rolbypassrls: boolean | undefined): void {
  if (rolbypassrls === true) {
    throw new Error(PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS);
  }
}

export function assertTenantTablesHaveRls(rows: readonly TenantRlsTableRow[]): void {
  const byName = new Map(rows.map((row) => [row.relname, row]));
  for (const table of TENANT_RLS_TABLES) {
    const row = byName.get(table);
    // Table absent from this database (migration not present) — skip; presence is
    // enforced by migration head. When present, FORCE RLS is mandatory.
    if (row === undefined) {
      continue;
    }
    if (!row.relrowsecurity || !row.relforcerowsecurity) {
      throw new Error(`${PRODUCTION_DATABASE_RLS_NOT_APPLIED}:${table}`);
    }
  }
  const presentForced = [...byName.values()].filter((r) => r.relrowsecurity && r.relforcerowsecurity);
  if (presentForced.length === 0) {
    throw new Error(`${PRODUCTION_DATABASE_RLS_NOT_APPLIED}:none`);
  }
}

function shouldProbeDatabaseIntegrity(): boolean {
  return isProductionAuthMode() || isProdlikeRuntimeProfile();
}

/**
 * Live Postgres probe at production / prodlike boot (DM-CT-02 / DI-PRISMA-01 / TODO-003).
 */
export async function assertProductionDatabaseIntegrity(): Promise<void> {
  if (!shouldProbeDatabaseIntegrity()) {
    return;
  }
  if (resolveStorageDriver() !== "prisma") {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return;
  }

  const probe = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const roleRows = await probe.$queryRaw<Array<{ rolbypassrls: boolean }>>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    assertAppRoleDoesNotBypassRls(roleRows[0]?.rolbypassrls);

    const rlsRows = await probe.$queryRaw<TenantRlsTableRow[]>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (${Prisma.join(TENANT_RLS_TABLES)})
    `;
    assertTenantTablesHaveRls(rlsRows);
    await assertProductionMigrationHead(databaseUrl);
  } finally {
    await probe.$disconnect();
  }
}
