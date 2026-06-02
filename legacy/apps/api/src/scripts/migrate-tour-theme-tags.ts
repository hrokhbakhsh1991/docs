/**
 * One-off migration: legacy `tripDetails.overview.tourTheme` string tags →
 * `workspace_tour_themes` rows and `overview.tourThemeIds`.
 *
 * Usage:
 *   pnpm --filter @apps/api migrate:tour-theme-tags
 *   pnpm --filter @apps/api migrate:tour-theme-tags -- --dry-run
 */
import { createHash } from "node:crypto";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeThemeKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function isNonEmptyStringTag(s: unknown): s is string {
  return typeof s === "string" && normalizeThemeKey(s).length > 0;
}

/** Trim + cap length for `workspace_tour_themes.name` (varchar 120). */
function canonicalDisplayName(firstTrimmed: string): string {
  const t = firstTrimmed.trim();
  if (t.length <= 120) {
    return t;
  }
  return `${t.slice(0, 117)}...`;
}

/**
 * ASCII-ish kebab slug from display name. Falls back to `legacy-<hex>` when empty
 * (e.g. non-Latin-only labels).
 */
function baseSlugFromName(displayName: string, normKey: string): string {
  const lower = displayName.trim().toLowerCase();
  const slug = lower
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  if (slug.length > 0) {
    return slug;
  }
  const h = createHash("sha256").update(normKey).digest("hex").slice(0, 14);
  return `legacy-${h}`;
}

function uniqueSlug(
  base: string,
  workspaceTaken: Set<string>,
  usedInBatch: Set<string>,
): string {
  const root = base.slice(0, 120);
  let candidate = root;
  let n = 2;
  while (workspaceTaken.has(candidate) || usedInBatch.has(candidate)) {
    const suffix = `-${n}`;
    n += 1;
    candidate = `${root.slice(0, Math.max(0, 120 - suffix.length))}${suffix}`;
  }
  usedInBatch.add(candidate);
  return candidate;
}

function filterValidUuid(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (!UUID_RE.test(t) || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

function dedupeIdsPreserveOrder(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

type TourDetailsRow = {
  tourDetailsId: string;
  tourId: string;
  tenantId: string;
  tripDetails: Record<string, unknown>;
};

function rowHasStringTourThemes(row: TourDetailsRow): boolean {
  const overview = row.tripDetails?.overview;
  if (!overview || typeof overview !== "object" || Array.isArray(overview)) {
    return false;
  }
  const tourTheme = (overview as { tourTheme?: unknown }).tourTheme;
  if (!Array.isArray(tourTheme)) {
    return false;
  }
  return tourTheme.some((t) => isNonEmptyStringTag(t));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();
  try {
    const rows = await dataSource.query<TourDetailsRow[]>(`
      SELECT td.id AS "tourDetailsId",
             td.tour_id AS "tourId",
             t.tenant_id AS "tenantId",
             td.trip_details AS "tripDetails"
      FROM tour_details td
      INNER JOIN tours t ON t.id = td.tour_id
      WHERE t.deleted_at IS NULL
        AND td.trip_details IS NOT NULL
        AND jsonb_typeof(td.trip_details->'overview'->'tourTheme') = 'array'
        AND jsonb_array_length(COALESCE(td.trip_details->'overview'->'tourTheme', '[]'::jsonb)) > 0
    `);

    const globalNormKeys = new Set<string>();
    for (const row of rows) {
      const overview = row.tripDetails?.overview;
      if (!overview || typeof overview !== "object" || Array.isArray(overview)) {
        continue;
      }
      const tourTheme = (overview as { tourTheme?: unknown }).tourTheme;
      if (!Array.isArray(tourTheme)) {
        continue;
      }
      for (const tag of tourTheme) {
        if (!isNonEmptyStringTag(tag)) {
          continue;
        }
        globalNormKeys.add(normalizeThemeKey(tag));
      }
    }

    const byWorkspace = new Map<string, TourDetailsRow[]>();
    for (const row of rows) {
      const list = byWorkspace.get(row.tenantId) ?? [];
      list.push(row);
      byWorkspace.set(row.tenantId, list);
    }

    let themesInserted = 0;
    let themesMatchedExistingCatalog = 0;
    let toursMigrated = 0;

    for (const [workspaceId, wsRows] of byWorkspace) {
      const firstLabel = new Map<string, string>();
      for (const row of wsRows) {
        const overview = row.tripDetails?.overview;
        if (!overview || typeof overview !== "object" || Array.isArray(overview)) {
          continue;
        }
        const tourTheme = (overview as { tourTheme?: unknown }).tourTheme;
        if (!Array.isArray(tourTheme)) {
          continue;
        }
        for (const tag of tourTheme) {
          if (!isNonEmptyStringTag(tag)) {
            continue;
          }
          const nk = normalizeThemeKey(tag);
          const trimmed = tag.trim();
          if (!firstLabel.has(nk)) {
            firstLabel.set(nk, trimmed);
          }
        }
      }

      const slugRows = (await dataSource.query(
        `SELECT id, slug FROM workspace_tour_themes WHERE workspace_id = $1`,
        [workspaceId],
      )) as { id: string; slug: string }[];
      const existingSlugToId = new Map(slugRows.map((r) => [r.slug, r.id]));
      const workspaceTaken = new Set<string>(slugRows.map((r) => r.slug));
      const batchSlugUsed = new Set<string>();
      /** Prevents two normKeys that share the same kebab `base` from mapping to the same theme id. */
      const baseSlugSlotUsed = new Set<string>();

      const normKeyToThemeId = new Map<string, string>();
      const sortedKeys = [...firstLabel.keys()].sort((a, b) => a.localeCompare(b));

      const maxRow = (await dataSource.query(
        `SELECT MAX(sort_order)::text AS m FROM workspace_tour_themes WHERE workspace_id = $1`,
        [workspaceId],
      )) as { m: string | null }[];
      const maxParsed = maxRow[0]?.m != null ? Number.parseInt(maxRow[0].m, 10) : 0;
      let nextSort = Number.isFinite(maxParsed) ? maxParsed + 1 : 0;

      for (const nk of sortedKeys) {
        const label = firstLabel.get(nk)!;
        const displayName = canonicalDisplayName(label);
        const baseSlug = baseSlugFromName(displayName, nk);

        if (existingSlugToId.has(baseSlug) && !baseSlugSlotUsed.has(baseSlug)) {
          const id = existingSlugToId.get(baseSlug)!;
          normKeyToThemeId.set(nk, id);
          baseSlugSlotUsed.add(baseSlug);
          themesMatchedExistingCatalog += 1;
          continue;
        }

        const slug = uniqueSlug(baseSlug, workspaceTaken, batchSlugUsed);
        workspaceTaken.add(slug);

        const existing = (await dataSource.query(
          `SELECT id FROM workspace_tour_themes WHERE workspace_id = $1 AND slug = $2 LIMIT 1`,
          [workspaceId, slug],
        )) as { id: string }[];
        if (existing.length > 0) {
          normKeyToThemeId.set(nk, existing[0]!.id);
          if (slug === baseSlug) {
            baseSlugSlotUsed.add(baseSlug);
          }
          themesMatchedExistingCatalog += 1;
          continue;
        }

        if (dryRun) {
          if (slug === baseSlug) {
            baseSlugSlotUsed.add(baseSlug);
          }
          themesInserted += 1;
          continue;
        }

        const inserted = (await dataSource.query(
          `
          INSERT INTO workspace_tour_themes
            (workspace_id, name, slug, description, is_active, sort_order)
          VALUES ($1, $2, $3, NULL, true, $4)
          RETURNING id
          `,
          [workspaceId, displayName, slug, nextSort],
        )) as { id: string }[];
        nextSort += 1;
        const id = inserted[0]!.id;
        normKeyToThemeId.set(nk, id);
        existingSlugToId.set(slug, id);
        if (slug === baseSlug) {
          baseSlugSlotUsed.add(baseSlug);
        }
        themesInserted += 1;
      }

      if (dryRun) {
        toursMigrated += wsRows.filter(rowHasStringTourThemes).length;
        continue;
      }

      for (const row of wsRows) {
        const trip = { ...row.tripDetails } as Record<string, unknown>;
        const overviewRaw = trip.overview;
        if (!overviewRaw || typeof overviewRaw !== "object" || Array.isArray(overviewRaw)) {
          continue;
        }
        const overview = { ...(overviewRaw as Record<string, unknown>) };
        const tourTheme = overview.tourTheme;
        if (!Array.isArray(tourTheme)) {
          continue;
        }
        const stringTags = tourTheme.filter(isNonEmptyStringTag);
        if (stringTags.length === 0) {
          continue;
        }
        const mappedIds: string[] = [];
        for (const tag of stringTags) {
          const nk = normalizeThemeKey(tag);
          const id = normKeyToThemeId.get(nk);
          if (id) {
            mappedIds.push(id);
          }
        }
        const existingIds = filterValidUuid(overview.tourThemeIds);
        const merged = dedupeIdsPreserveOrder([...mappedIds, ...existingIds]);
        overview.tourThemeIds = merged.length > 0 ? merged : undefined;
        delete overview.tourTheme;
        if (Object.keys(overview).length === 0) {
          delete trip.overview;
        } else {
          trip.overview = overview;
        }

        await dataSource.query(`UPDATE tour_details SET trip_details = $1::jsonb WHERE id = $2`, [
          JSON.stringify(trip),
          row.tourDetailsId,
        ]);
        toursMigrated += 1;
      }
    }

    emitScriptInfo(
      JSON.stringify(
        {
          dryRun,
          uniqueThemeStrings: globalNormKeys.size,
          workspacesAffected: byWorkspace.size,
          themeRowsInserted: themesInserted,
          themeRowsMatchedExistingCatalogSlug: themesMatchedExistingCatalog,
          toursMigrated,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
