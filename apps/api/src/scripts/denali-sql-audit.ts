/**
 * Denali Wizard QA — Phase 3: SQL Integrity Audit.
 */
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { DENALI_SUBDOMAIN } from "./denali-tenant.fixture";
import { emitScriptInfo } from "./script-log";

async function denaliSqlAudit(): Promise<void> {
  emitScriptInfo("=== Denali Wizard QA Phase 3: SQL Integrity Audit ===");

  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();

  try {
    const tenants = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      [DENALI_SUBDOMAIN],
    );
    const tenant = tenants[0];
    if (!tenant) {
      throw new Error(`Tenant subdomain "${DENALI_SUBDOMAIN}" not found.`);
    }
    const workspaceId = tenant.id;
    const tenantId = tenant.id;

    const queries = [
      {
        id: "3.1",
        name: "ناهماهنگی preset: ستون match vs JSONB",
        sql: `SELECT id, name, match_main_tour_theme_id,
                     defaults->'programNature'->>'mainTourThemeId' AS json_main
              FROM workspace_tour_creation_presets
              WHERE workspace_id = $1
                AND match_main_tour_theme_id IS DISTINCT FROM
                    (defaults->'programNature'->>'mainTourThemeId')::uuid`,
        params: [workspaceId],
      },
      {
        id: "3.2",
        name: "orphan theme UUID در presets",
        sql: `SELECT p.id, p.match_main_tour_theme_id
              FROM workspace_tour_creation_presets p
              WHERE p.workspace_id = $1
                AND p.match_main_tour_theme_id IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM workspace_tour_themes t
                  WHERE t.id = p.match_main_tour_theme_id AND t.workspace_id = p.workspace_id
                )`,
        params: [workspaceId],
      },
      {
        id: "3.3",
        name: "orphan theme UUID در tours",
        sql: `SELECT t.id AS tour_id, e.theme_id
              FROM tours t
              JOIN tour_details td ON td.tour_id = t.id
              CROSS JOIN LATERAL jsonb_array_elements_text(
                COALESCE(td.trip_details->'overview'->'tourThemeIds', '[]'::jsonb)
              ) e(theme_id)
              WHERE t.tenant_id = $1
                AND NOT EXISTS (
                  SELECT 1 FROM workspace_tour_themes w
                  WHERE w.id::text = e.theme_id AND w.workspace_id = t.tenant_id
                )`,
        params: [tenantId],
      },
      {
        id: "3.4",
        name: "ghost: event + overview.difficultyLevel",
        sql: `SELECT t.id, td.trip_details->'overview'->>'denaliTourKind'
              FROM tours t
              JOIN tour_details td ON td.tour_id = t.id
              WHERE t.tenant_id = $1
                AND (td.trip_details->'overview'->>'denaliTourKind') LIKE 'event_%'
                AND (td.trip_details->'overview'->>'difficultyLevel') IS NOT NULL`,
        params: [tenantId],
      },
      {
        id: "3.5",
        name: "ghost: event preset + outdoor در programNature",
        sql: `SELECT id, name
              FROM workspace_tour_creation_presets
              WHERE workspace_id = $1
                AND (defaults->'basicInfo'->>'tourType') LIKE 'event_%'
                AND (
                  defaults->'programNature'->>'difficultyLevel' IS NOT NULL
                  OR defaults->'programNature'->>'hikingHoursApprox' IS NOT NULL
                )`,
        params: [workspaceId],
      },
      {
        id: "3.6",
        name: "توزیع تم‌ها روی tours",
        sql: `SELECT wt.slug, count(*)
              FROM tours t
              JOIN tour_details td ON td.tour_id = t.id
              CROSS JOIN LATERAL jsonb_array_elements_text(
                COALESCE(td.trip_details->'overview'->'tourThemeIds', '[]'::jsonb)
              ) e(theme_id)
              JOIN workspace_tour_themes wt ON wt.id::text = e.theme_id
              WHERE t.tenant_id = $1
              GROUP BY wt.slug`,
        params: [tenantId],
      },
      {
        id: "3.7",
        name: "single-day با returnDate باقی‌مانده (ghost logistics)",
        sql: `SELECT t.id, td.trip_details->'overview'->>'denaliTourKind',
                     td.trip_details->'logistics'->>'returnDate'
              FROM tours t
              JOIN tour_details td ON td.tour_id = t.id
              WHERE t.tenant_id = $1
                AND (td.trip_details->'overview'->>'denaliTourKind') LIKE '%_day'
                AND (td.trip_details->'logistics'->>'returnDate') IS NOT NULL`,
        params: [tenantId],
      },
    ];

    let overallSuccess = true;
    for (const q of queries) {
      const rows = await ds.query(q.sql, q.params);
      const rowCount = Array.isArray(rows) ? rows.length : 0;

      if (q.id === "3.6") {
        emitScriptInfo(`📊 ${q.id} ${q.name}:`);
        console.table(rows);
      } else {
        if (rowCount === 0) {
          emitScriptInfo(`✅ ${q.id} ${q.name}: 0 rows (PASS)`);
        } else {
          emitScriptInfo(`❌ ${q.id} ${q.name}: ${rowCount} rows (FAIL)`);
          console.table(rows.slice(0, 5));
          overallSuccess = false;
        }
      }
    }

    if (!overallSuccess) {
      process.exitCode = 2;
    }
  } finally {
    await ds.destroy();
  }
}

denaliSqlAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
