import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { Prisma, PrismaClient } from "@prisma/client";

import { deriveTourProjections } from "./projection-sync";
import { resolveMigrateCanonicalHook } from "./migrate-canonical-hook";
import { WORKSPACE_CANONICAL_TOUR_BINDINGS } from "./workspace-canonical-tour-bindings.generated";

export const MIGRATE_CANONICAL_TENANT_IDS_ENV = "MIGRATE_CANONICAL_TENANT_IDS";

export type MigrateCanonicalWorkspaceResult = {
  readonly tenantId: string;
  readonly migratedTourIds: readonly string[];
  readonly skippedTourIds: readonly string[];
};

type CanonicalMigrationSurface = {
  readonly legacySoTRoot: string;
  readonly currentSchemaVersion: number;
  readonly legacySchemaVersion: number;
  readonly wrapLegacyCanonical: (legacyForm: Record<string, unknown>) => CanonicalDocument;
};

function resolveCanonicalMigrationSurface(
  workspaceType: string
): CanonicalMigrationSurface | undefined {
  const binding = WORKSPACE_CANONICAL_TOUR_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  if (
    binding === undefined ||
    !("legacySoTRoot" in binding) ||
    !("currentSchemaVersion" in binding) ||
    !("legacySchemaVersion" in binding) ||
    !("wrapLegacyCanonical" in binding)
  ) {
    return undefined;
  }
  return {
    legacySoTRoot: binding.legacySoTRoot as string,
    currentSchemaVersion: binding.currentSchemaVersion as number,
    legacySchemaVersion: binding.legacySchemaVersion as number,
    wrapLegacyCanonical: binding.wrapLegacyCanonical as CanonicalMigrationSurface["wrapLegacyCanonical"],
  };
}

function requireCanonicalMigrationSurface(workspaceType: string): CanonicalMigrationSurface {
  const surface = resolveCanonicalMigrationSurface(workspaceType);
  if (surface === undefined) {
    throw new Error(`MIGRATE_CANONICAL_SURFACE_UNAVAILABLE:${workspaceType}`);
  }
  return surface;
}

export function parseMigrateCanonicalTenantAllowlist(
  raw: string | undefined = process.env[MIGRATE_CANONICAL_TENANT_IDS_ENV]
): ReadonlySet<string> {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

export function isTenantMigrateCanonicalAllowlisted(
  tenantId: string,
  allowlist: ReadonlySet<string> = parseMigrateCanonicalTenantAllowlist()
): boolean {
  return allowlist.has(tenantId.trim());
}

export function workspaceSupportsCanonicalMigration(workspaceType: string): boolean {
  return WORKSPACE_CANONICAL_TOUR_BINDINGS.some(
    (binding) => binding.workspaceType === workspaceType && "migrateCanonical" in binding
  );
}

function asCanonicalRecord(value: Prisma.JsonValue): CanonicalDocument | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.schemaVersion !== "number" ||
    !Array.isArray(record.roots) ||
    record.data == null ||
    typeof record.data !== "object" ||
    Array.isArray(record.data)
  ) {
    return null;
  }
  return {
    schemaVersion: record.schemaVersion,
    roots: record.roots as readonly string[],
    data: record.data as Record<string, unknown>,
  };
}

function needsLegacyTripDetailsMigration(
  canonical: CanonicalDocument,
  surface: CanonicalMigrationSurface
): boolean {
  if (canonical.schemaVersion >= surface.currentSchemaVersion) {
    return false;
  }
  if (canonical.roots.includes(surface.legacySoTRoot)) {
    return true;
  }
  const legacyRoot = canonical.data[surface.legacySoTRoot];
  return legacyRoot != null && typeof legacyRoot === "object" && !Array.isArray(legacyRoot);
}

function assertNoDualWriteSoT(
  canonical: CanonicalDocument,
  surface: CanonicalMigrationSurface
): void {
  if (canonical.data[surface.legacySoTRoot] != null) {
    throw new Error("MIGRATE_DENALI_DUAL_WRITE_SOT");
  }
  if (canonical.roots.includes(surface.legacySoTRoot)) {
    throw new Error("MIGRATE_DENALI_DUAL_WRITE_SOT");
  }
}

/** Stages a legacy form under the workspace migrate surface (requires migrate meta binding). */
export function buildLegacyTripDetailsCanonicalEnvelope(
  legacyForm: Record<string, unknown>,
  workspaceType: string
): CanonicalDocument {
  return requireCanonicalMigrationSurface(workspaceType).wrapLegacyCanonical(legacyForm);
}

/**
 * Controlled batch migration — allowlisted tenants only (REQ-P6-017 / DEC-P6-007).
 * PSR-4b-defaults: `workspaceType` is required (no product default).
 */
export async function migrateWorkspaceCanonicalForTenant(
  prisma: PrismaClient,
  tenantId: string,
  options: {
    readonly allowlist?: ReadonlySet<string>;
    readonly workspaceType?: string;
  } = {}
): Promise<MigrateCanonicalWorkspaceResult> {
  const allowlist = options.allowlist ?? parseMigrateCanonicalTenantAllowlist();
  if (!isTenantMigrateCanonicalAllowlisted(tenantId, allowlist)) {
    return { tenantId, migratedTourIds: [], skippedTourIds: [] };
  }

  const workspaceType = options.workspaceType?.trim() ?? "";
  if (workspaceType.length === 0) {
    throw new Error("MIGRATE_CANONICAL_WORKSPACE_TYPE_REQUIRED");
  }
  if (!workspaceSupportsCanonicalMigration(workspaceType)) {
    return { tenantId, migratedTourIds: [], skippedTourIds: [] };
  }
  const surface = requireCanonicalMigrationSurface(workspaceType);
  const migrateHook = resolveMigrateCanonicalHook(workspaceType);

  const tours = await prisma.tour.findMany({
    where: { tenantId },
    select: { id: true, canonical: true, schemaVersion: true },
  });

  const migratedTourIds: string[] = [];
  const skippedTourIds: string[] = [];

  for (const tour of tours) {
    const stored = asCanonicalRecord(tour.canonical);
    if (stored == null || !needsLegacyTripDetailsMigration(stored, surface)) {
      skippedTourIds.push(tour.id);
      continue;
    }

    const migrated = migrateHook(stored.schemaVersion, stored.data);
    assertNoDualWriteSoT(migrated, surface);

    const projections = deriveTourProjections(migrated);
    await prisma.tour.update({
      where: { tenantId_id: { tenantId, id: tour.id } },
      data: {
        canonical: migrated as unknown as Prisma.InputJsonValue,
        schemaVersion: migrated.schemaVersion,
        title: projections.title,
      },
    });
    migratedTourIds.push(tour.id);
  }

  return {
    tenantId,
    migratedTourIds,
    skippedTourIds,
  };
}

/** Test helper — detect legacy staging envelope without persisting. */
export function isLegacyTripDetailsSchemaVersion(
  schemaVersion: number,
  workspaceType: string
): boolean {
  return (
    schemaVersion === requireCanonicalMigrationSurface(workspaceType).legacySchemaVersion
  );
}
