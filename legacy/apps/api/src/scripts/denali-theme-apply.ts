/**
 * Denali Wizard QA — Phase 2: Apply theme consolidation + UUID remap.
 *
 * 1. Upsert consolidated themes (`nature`, `mountain`)
 * 2. Remap preset defaults + match_main_tour_theme_id
 * 3. Remap tour trip_details.overview.tourThemeIds
 * 4. Ghost-field sanitize (event presets / tours)
 * 5. Hard-delete legacy workspace themes
 *
 * ```bash
 * ALLOW_DENALI_THEME_APPLY=1 pnpm --filter @apps/api qa:denali:theme-apply
 * ALLOW_DENALI_THEME_APPLY=1 pnpm --filter @apps/api qa:denali:theme-apply --log=./denali-theme-apply.log
 * ALLOW_DENALI_THEME_APPLY=1 pnpm --filter @apps/api qa:denali:theme-apply -- --dry-run
 * ```
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { DENALI_SUBDOMAIN } from "./denali-tenant.fixture";
import {
  DENALI_CONSOLIDATED_THEME_SEEDS,
  resolveConsolidatedThemeSlug,
  sanitizePresetDefaultsGhost,
  sanitizeTripDetailsGhost,
  type ConsolidatedThemeSlug,
} from "./denali-theme-migration.shared";
import { emitScriptInfo } from "./script-log";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MAP_LOG = path.join(REPO_ROOT, "map.log");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ThemeRow = { id: string; slug: string; name: string };
type PresetRow = {
  id: string;
  name: string;
  match_tour_type: string | null;
  match_main_tour_theme_id: string | null;
  defaults: Record<string, unknown>;
};
type TourRow = { tour_id: string; trip_details: Record<string, unknown> | null };

function fail(message: string): never {
  console.error(message);
  throw new Error(message);
}

function resolveLogPathFromArgv(argv: readonly string[]): string {
  for (const arg of argv) {
    if (arg.startsWith("--log=")) {
      return path.resolve(REPO_ROOT, arg.slice("--log=".length));
    }
  }
  return MAP_LOG;
}

function parseDryRun(argv: readonly string[]): boolean {
  return argv.includes("--dry-run");
}

function assertApplyAllowed(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DENALI_THEME_APPLY !== "true") {
    fail(
      "denali-theme-apply: refusing production. Set ALLOW_DENALI_THEME_APPLY=true after explicit review.",
    );
  }
  if (process.env.ALLOW_DENALI_THEME_APPLY !== "1" && process.env.ALLOW_DENALI_THEME_APPLY !== "true") {
    fail("denali-theme-apply: set ALLOW_DENALI_THEME_APPLY=1 to execute.");
  }
}

function remapThemeId(
  oldId: string,
  oldSlugById: Map<string, string>,
  presetMatchTourType: string | null | undefined,
  newIdsBySlug: Map<ConsolidatedThemeSlug, string>,
): string | null {
  const oldSlug = oldSlugById.get(oldId);
  if (!oldSlug) {
    return null;
  }
  const target = resolveConsolidatedThemeSlug(oldSlug, presetMatchTourType);
  return newIdsBySlug.get(target) ?? null;
}

function remapThemeIdArray(
  ids: unknown,
  oldSlugById: Map<string, string>,
  matchTourType: string | null | undefined,
  newIdsBySlug: Map<ConsolidatedThemeSlug, string>,
): { ids: string[]; unmapped: string[] } {
  if (!Array.isArray(ids)) {
    return { ids: [], unmapped: [] };
  }
  const out: string[] = [];
  const unmapped: string[] = [];
  const seen = new Set<string>();
  const validNew = new Set(newIdsBySlug.values());
  for (const raw of ids) {
    if (typeof raw !== "string" || !UUID_RE.test(raw)) {
      continue;
    }
    const mapped = remapThemeId(raw, oldSlugById, matchTourType, newIdsBySlug);
    if (!mapped || !validNew.has(mapped)) {
      unmapped.push(raw);
      continue;
    }
    if (!seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return { ids: out, unmapped };
}

export type DenaliThemeApplyReport = {
  timestamp: string;
  dryRun: boolean;
  workspaceId: string;
  removedThemes: Array<{ id: string; slug: string; action: "REMOVE" }>;
  addedThemes: Array<{ id: string; slug: string; name: string; action: "ADD" }>;
  remappedPresets: Array<{ id: string; name: string; fromThemeId: string | null; toThemeId: string }>;
  remappedTours: Array<{ tourId: string; fromThemeIds: string[]; toThemeIds: string[] }>;
  ghostValidation: {
    presetsSanitized: number;
    toursSanitized: number;
    warnings: string[];
  };
  manualReview: {
    unmappedPresetThemeIds: string[];
    unmappedTourThemeIds: string[];
    orphanThemeRefsAfterApply: number;
  };
};

export async function denaliThemeApply(options?: {
  logPath?: string;
  dryRun?: boolean;
}): Promise<number> {
  const logPath = options?.logPath ?? MAP_LOG;
  const dryRun = options?.dryRun ?? false;

  emitScriptInfo(`=== Denali Theme Apply Phase 2${dryRun ? " (DRY RUN)" : ""} ===`);
  if (!dryRun) {
    assertApplyAllowed();
  }

  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();

  const ghostWarnings: string[] = [];
  const remappedPresets: DenaliThemeApplyReport["remappedPresets"] = [];
  const remappedTours: DenaliThemeApplyReport["remappedTours"] = [];
  const unmappedPresetThemeIds = new Set<string>();
  const unmappedTourThemeIds = new Set<string>();

  try {
    const tenants = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      [DENALI_SUBDOMAIN],
    );
    const tenant = tenants[0];
    if (!tenant) {
      fail(`Tenant subdomain "${DENALI_SUBDOMAIN}" not found.`);
    }

    const legacyThemes = await ds.query<ThemeRow[]>(
      `SELECT id, slug, name FROM workspace_tour_themes WHERE workspace_id = $1 ORDER BY sort_order ASC`,
      [tenant.id],
    );
    const oldSlugById = new Map(legacyThemes.map((t) => [t.id, t.slug]));

    emitScriptInfo(`Legacy themes (${legacyThemes.length}): ${legacyThemes.map((t) => t.slug).join(", ")}`);

    const newIdsBySlug = new Map<ConsolidatedThemeSlug, string>();
    const addedThemes: DenaliThemeApplyReport["addedThemes"] = [];

    for (const spec of DENALI_CONSOLIDATED_THEME_SEEDS) {
      const existing = legacyThemes.find((t) => t.slug === spec.slug);
      const id = existing?.id ?? randomUUID();
      newIdsBySlug.set(spec.slug, id);
      addedThemes.push({ id, slug: spec.slug, name: spec.name, action: "ADD" });

      if (dryRun) {
        emitScriptInfo(`[dry-run] would upsert theme ${spec.slug} id=${id}`);
        continue;
      }

      await ds.query(
        `INSERT INTO workspace_tour_themes
          (id, workspace_id, slug, name, description, is_active, sort_order, form_profile)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7)
         ON CONFLICT (workspace_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = true,
           sort_order = EXCLUDED.sort_order,
           form_profile = EXCLUDED.form_profile,
           updated_at = now()`,
        [id, tenant.id, spec.slug, spec.name, spec.description, spec.sortOrder, spec.formProfile],
      );
    }

    let presetsSanitized = 0;

    const presets = await ds.query<PresetRow[]>(
      `SELECT id, name, match_tour_type, match_main_tour_theme_id, defaults
       FROM workspace_tour_creation_presets
       WHERE workspace_id = $1`,
      [tenant.id],
    );

    for (const preset of presets) {
      const defaults = (preset.defaults ?? {}) as Record<string, unknown>;
      const programNature = (defaults.programNature ?? {}) as Record<string, unknown>;
      const oldMain =
        (typeof programNature.mainTourThemeId === "string" ? programNature.mainTourThemeId : null) ??
        preset.match_main_tour_theme_id;

      let newMain: string | null = null;
      if (oldMain && UUID_RE.test(oldMain)) {
        newMain = remapThemeId(oldMain, oldSlugById, preset.match_tour_type, newIdsBySlug);
        if (!newMain) {
          unmappedPresetThemeIds.add(oldMain);
        }
      }

      const secondaryRaw = programNature.secondaryTourThemeIds;
      const { ids: newSecondary, unmapped: secUnmapped } = remapThemeIdArray(
        secondaryRaw,
        oldSlugById,
        preset.match_tour_type,
        newIdsBySlug,
      );
      for (const u of secUnmapped) {
        unmappedPresetThemeIds.add(u);
      }

      if (!newMain && preset.match_tour_type) {
        const fallback = resolveConsolidatedThemeSlug("", preset.match_tour_type);
        newMain = newIdsBySlug.get(fallback) ?? null;
      }

      const nextDefaults = structuredClone(defaults) as Record<string, unknown>;
      if (newMain) {
        nextDefaults.programNature = {
          ...(nextDefaults.programNature as Record<string, unknown>),
          mainTourThemeId: newMain,
          ...(secondaryRaw != null ? { secondaryTourThemeIds: newSecondary } : {}),
        };
        remappedPresets.push({
          id: preset.id,
          name: preset.name,
          fromThemeId: oldMain,
          toThemeId: newMain,
        });
      }

      const ghost = sanitizePresetDefaultsGhost(nextDefaults);
      ghost.warnings.forEach((w) => ghostWarnings.push(`preset:${preset.name}: ${w}`));
      if (ghost.changed) {
        presetsSanitized += 1;
      }

      const finalDefaults = ghost.sanitized;
      const matchId = newMain ?? preset.match_main_tour_theme_id;
      const presetChanged = Boolean(newMain) || ghost.changed;

      if (dryRun) {
        if (newMain) {
          emitScriptInfo(`[dry-run] preset ${preset.name}: main ${oldMain} → ${newMain}`);
        }
        continue;
      }

      if (!presetChanged) {
        continue;
      }

      await ds.query(
        `UPDATE workspace_tour_creation_presets
         SET defaults = $1::jsonb,
             match_main_tour_theme_id = $2
         WHERE id = $3`,
        [JSON.stringify(finalDefaults), matchId, preset.id],
      );
    }

    const tours = await ds.query<TourRow[]>(
      `SELECT t.id AS tour_id, td.trip_details
       FROM tours t
       INNER JOIN tour_details td ON td.tour_id = t.id
       WHERE t.tenant_id = $1 AND td.trip_details IS NOT NULL`,
      [tenant.id],
    );

    let toursSanitized = 0;
    for (const row of tours) {
      const tripDetails = (row.trip_details ?? {}) as Record<string, unknown>;
      const overview = (tripDetails.overview ?? {}) as Record<string, unknown>;
      const denaliKind =
        typeof overview.denaliTourKind === "string" ? overview.denaliTourKind : null;
      const matchType =
        denaliKind?.startsWith("mountain") === true
          ? "mountain"
          : denaliKind?.startsWith("nature") === true || denaliKind?.startsWith("desert") === true
            ? "nature"
            : denaliKind?.startsWith("event") === true
              ? null
              : null;

      const { ids: newThemeIds, unmapped } = remapThemeIdArray(
        overview.tourThemeIds,
        oldSlugById,
        matchType,
        newIdsBySlug,
      );
      for (const u of unmapped) {
        unmappedTourThemeIds.add(u);
      }

      const nextTrip = structuredClone(tripDetails) as Record<string, unknown>;
      if (newThemeIds.length > 0) {
        nextTrip.overview = { ...((nextTrip.overview ?? {}) as Record<string, unknown>), tourThemeIds: newThemeIds };
        const fromIds = Array.isArray(overview.tourThemeIds)
          ? (overview.tourThemeIds as string[]).filter((x) => typeof x === "string")
          : [];
        if (fromIds.join(",") !== newThemeIds.join(",")) {
          remappedTours.push({ tourId: row.tour_id, fromThemeIds: fromIds, toThemeIds: newThemeIds });
        }
      }

      const ghost = sanitizeTripDetailsGhost(nextTrip);
      ghost.warnings.forEach((w) => ghostWarnings.push(`tour:${row.tour_id}: ${w}`));
      if (ghost.changed) {
        toursSanitized += 1;
      }

      if (dryRun) {
        continue;
      }

      await ds.query(`UPDATE tour_details SET trip_details = $1::jsonb WHERE tour_id = $2`, [
        JSON.stringify(ghost.sanitized),
        row.tour_id,
      ]);
    }

    const removedThemes = legacyThemes
      .filter((t) => !DENALI_CONSOLIDATED_THEME_SEEDS.some((s) => s.slug === t.slug))
      .map((t) => ({ id: t.id, slug: t.slug, action: "REMOVE" as const }));

    if (!dryRun && removedThemes.length > 0) {
      await ds.query(
        `DELETE FROM workspace_tour_themes
         WHERE workspace_id = $1 AND slug <> ALL($2::text[])`,
        [tenant.id, DENALI_CONSOLIDATED_THEME_SEEDS.map((s) => s.slug)],
      );
      emitScriptInfo(`Removed ${removedThemes.length} legacy theme row(s).`);
    } else if (dryRun) {
      emitScriptInfo(`[dry-run] would remove ${removedThemes.length} legacy theme(s).`);
    }

    const orphanAfter = dryRun
      ? 0
      : Number(
          (
            await ds.query<Array<{ c: string }>>(
              `SELECT count(*)::text AS c
               FROM tours t
               INNER JOIN tour_details td ON td.tour_id = t.id
               CROSS JOIN LATERAL jsonb_array_elements_text(
                 COALESCE(td.trip_details->'overview'->'tourThemeIds', '[]'::jsonb)
               ) AS theme_id
               WHERE t.tenant_id = $1
                 AND theme_id NOT IN (SELECT id::text FROM workspace_tour_themes WHERE workspace_id = $2)`,
              [tenant.id, tenant.id],
            )
          )[0]?.c ?? 0,
        );

    const report: DenaliThemeApplyReport = {
      timestamp: new Date().toISOString(),
      dryRun,
      workspaceId: tenant.id,
      removedThemes,
      addedThemes,
      remappedPresets,
      remappedTours,
      ghostValidation: {
        presetsSanitized,
        toursSanitized,
        warnings: ghostWarnings,
      },
      manualReview: {
        unmappedPresetThemeIds: [...unmappedPresetThemeIds],
        unmappedTourThemeIds: [...unmappedTourThemeIds],
        orphanThemeRefsAfterApply: orphanAfter,
      },
    };

    const block = `[Denali Theme Apply Phase 2]\n${JSON.stringify(report, null, 2)}\n`;
    fs.appendFileSync(logPath, block, "utf8");

    emitScriptInfo(`Report written to ${logPath}`);
    emitScriptInfo(
      `Remapped presets=${remappedPresets.length} tours=${remappedTours.length} ghostWarnings=${ghostWarnings.length} orphans=${orphanAfter}`,
    );

    const needsManual =
      unmappedPresetThemeIds.size > 0 ||
      unmappedTourThemeIds.size > 0 ||
      orphanAfter > 0;
    if (needsManual) {
      return 2;
    }
    if (ghostWarnings.length > 0) {
      return 1;
    }
    return 0;
  } finally {
    await ds.destroy();
  }
}

const logPath = resolveLogPathFromArgv(process.argv);
const dryRun = parseDryRun(process.argv);

denaliThemeApply({ logPath, dryRun })
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error: unknown) => {
    console.error(
      "denali-theme-apply failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exitCode = 1;
  });
