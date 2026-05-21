/**
 * Denali Wizard QA — Phase 1: Theme check & ghost-field simulation (read-only).
 *
 * Dry-run before replacing workspace tour themes. Does not mutate the database.
 * Appends a JSON report to `map.log` at the repository root.
 *
 * ```bash
 * pnpm --filter @apps/api qa:denali:theme-dry-run
 * ```
 */
import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { DENALI_SUBDOMAIN, DENALI_THEME_SEEDS } from "./denali-tenant.fixture";
import { DENALI_CONSOLIDATED_THEME_SEEDS } from "./denali-theme-migration.shared";
import { emitScriptInfo } from "./script-log";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MAP_LOG = path.join(REPO_ROOT, "map.log");

type ThemeRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  form_profile: string;
  is_active: boolean;
  sort_order: number;
};

type DependentFieldIssue = {
  layer: "preset_defaults" | "preset_match" | "tour_trip_details";
  field: string;
  count: number;
  sampleIds?: string[];
};

function resolveLogPathFromArgv(argv: readonly string[]): string {
  for (const arg of argv) {
    if (arg.startsWith("--log=")) {
      return path.resolve(REPO_ROOT, arg.slice("--log=".length));
    }
  }
  return MAP_LOG;
}

export async function denaliThemeDryRun(logPath = MAP_LOG): Promise<void> {
  emitScriptInfo("=== Denali Wizard QA Dry Run: Phase 1 (themes + dependent fields) ===");

  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();

  try {
    const tenants = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      [DENALI_SUBDOMAIN],
    );
    const tenant = tenants[0];
    if (!tenant) {
      throw new Error(`Tenant subdomain "${DENALI_SUBDOMAIN}" not found. Run provision:denali first.`);
    }

    const currentThemes = await ds.query<ThemeRow[]>(
      `SELECT id, slug, name, description, form_profile, is_active, sort_order
       FROM workspace_tour_themes
       WHERE workspace_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [tenant.id],
    );

    emitScriptInfo(`Current themes (${currentThemes.length}): ${currentThemes.map((t) => t.slug).join(", ")}`);

    const simulatedRemoval = currentThemes.map((theme) => ({ ...theme, action: "REMOVE" as const }));
    const simulatedAddition = DENALI_CONSOLIDATED_THEME_SEEDS.map((theme) => ({
      ...theme,
      action: "ADD" as const,
    }));

    const fieldIssues: DependentFieldIssue[] = [];

    const presetMainTheme = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM workspace_tour_creation_presets
       WHERE workspace_id = $1
         AND (
           (defaults->'programNature'->>'mainTourThemeId') IS NOT NULL
           OR match_main_tour_theme_id IS NOT NULL
         )`,
      [tenant.id],
    );
    if (presetMainTheme.length > 0) {
      fieldIssues.push({
        layer: "preset_defaults",
        field: "program.mainThemeId (programNature.mainTourThemeId / match_main_tour_theme_id)",
        count: presetMainTheme.length,
        sampleIds: presetMainTheme.slice(0, 5).map((r) => r.id),
      });
    }

    const presetDifficulty = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM workspace_tour_creation_presets
       WHERE workspace_id = $1
         AND (defaults->'programNature'->>'difficultyLevel') IS NOT NULL`,
      [tenant.id],
    );
    if (presetDifficulty.length > 0) {
      fieldIssues.push({
        layer: "preset_defaults",
        field: "program.difficultyLevel (programNature.difficultyLevel)",
        count: presetDifficulty.length,
        sampleIds: presetDifficulty.slice(0, 5).map((r) => r.id),
      });
    }

    const presetHiking = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM workspace_tour_creation_presets
       WHERE workspace_id = $1
         AND (defaults->'programNature'->>'hikingHoursApprox') IS NOT NULL`,
      [tenant.id],
    );
    if (presetHiking.length > 0) {
      fieldIssues.push({
        layer: "preset_defaults",
        field: "program.hikingHoursApprox (programNature.hikingHoursApprox)",
        count: presetHiking.length,
        sampleIds: presetHiking.slice(0, 5).map((r) => r.id),
      });
    }

    const themeIds = currentThemes.map((t) => t.id);
    if (themeIds.length > 0) {
      const orphanPresetMatch = await ds.query<Array<{ id: string; theme_id: string }>>(
        `SELECT id, match_main_tour_theme_id AS theme_id
         FROM workspace_tour_creation_presets
         WHERE workspace_id = $1 AND match_main_tour_theme_id = ANY($2::uuid[])`,
        [tenant.id, themeIds],
      );
      if (orphanPresetMatch.length > 0) {
        fieldIssues.push({
          layer: "preset_match",
          field: "match_main_tour_theme_id → existing theme UUID",
          count: orphanPresetMatch.length,
          sampleIds: orphanPresetMatch.slice(0, 5).map((r) => r.id),
        });
      }
    }

    const tourThemeRefs = await ds.query<Array<{ tour_id: string }>>(
      `SELECT t.id AS tour_id
       FROM tours t
       INNER JOIN tour_details td ON td.tour_id = t.id
       WHERE t.tenant_id = $1
         AND td.trip_details IS NOT NULL
         AND jsonb_array_length(COALESCE(td.trip_details->'overview'->'tourThemeIds', '[]'::jsonb)) > 0`,
      [tenant.id],
    );
    if (tourThemeRefs.length > 0) {
      fieldIssues.push({
        layer: "tour_trip_details",
        field: "overview.tourThemeIds (projection of program.mainThemeId)",
        count: tourThemeRefs.length,
        sampleIds: tourThemeRefs.slice(0, 5).map((r) => r.tour_id),
      });
    }

    const tourDifficulty = await ds.query<Array<{ tour_id: string }>>(
      `SELECT t.id AS tour_id
       FROM tours t
       INNER JOIN tour_details td ON td.tour_id = t.id
       WHERE t.tenant_id = $1
         AND (td.trip_details->'overview'->>'difficultyLevel') IS NOT NULL`,
      [tenant.id],
    );
    if (tourDifficulty.length > 0) {
      fieldIssues.push({
        layer: "tour_trip_details",
        field: "overview.difficultyLevel",
        count: tourDifficulty.length,
        sampleIds: tourDifficulty.slice(0, 5).map((r) => r.tour_id),
      });
    }

    const fixtureSlugs = new Set<string>(DENALI_THEME_SEEDS.map((s) => s.slug));
    const missingFixture = DENALI_THEME_SEEDS.filter(
      (spec) => !currentThemes.some((row) => row.slug === spec.slug && row.is_active),
    );
    const extraThemes = currentThemes.filter((row) => !fixtureSlugs.has(row.slug));

    const dryRunReport = {
      timestamp: new Date().toISOString(),
      workspaceId: tenant.id,
      subdomain: DENALI_SUBDOMAIN,
      currentThemes: currentThemes.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        formProfile: t.form_profile,
        isActive: t.is_active,
      })),
      fixtureExpectation: DENALI_THEME_SEEDS.map((s) => s.slug),
      fixtureMissing: missingFixture.map((s) => s.slug),
      themesNotInFixture: extraThemes.map((t) => t.slug),
      simulatedRemoval,
      simulatedAddition,
      dependentFieldIssues: fieldIssues,
      ghostClearingNote:
        "After theme removal, re-run wizard invariant tests (denaliGhostState.spec.ts) and remap preset/tour theme UUIDs before publish.",
    };

    const reportBlock = `[Denali Theme Dry Run Phase 1]\n${JSON.stringify(dryRunReport, null, 2)}\n`;
    fs.appendFileSync(logPath, reportBlock, "utf8");

    for (const issue of fieldIssues) {
      emitScriptInfo(
        `WARN ${issue.field}: ${issue.count} row(s) in ${issue.layer} — verify ghost clearing / remap before apply`,
      );
    }

    emitScriptInfo(`Dry run complete. Report appended to ${logPath}`);
    if (fieldIssues.length > 0) {
      process.exitCode = 2;
    }
  } finally {
    await ds.destroy();
  }
}

const logPath = resolveLogPathFromArgv(process.argv);
denaliThemeDryRun(logPath).catch((error: unknown) => {
  console.error(
    "denali-theme-dry-run failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
