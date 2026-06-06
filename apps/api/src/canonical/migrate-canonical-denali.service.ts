import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import {
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION,
  LEGACY_TRIP_DETAILS_SOT_ROOT,
  wrapLegacyTripDetailsForMigration,
} from "@app-tour/workspace-denali";
import type { Prisma, PrismaClient } from "@prisma/client";

import { deriveTourProjections } from "./projection-sync";
import { resolveMigrateCanonicalHook } from "./migrate-canonical-hook";

export const MIGRATE_CANONICAL_TENANT_IDS_ENV = "MIGRATE_CANONICAL_TENANT_IDS";

export type MigrateCanonicalDenaliResult = {
  readonly tenantId: string;
  readonly migratedTourIds: readonly string[];
  readonly skippedTourIds: readonly string[];
};

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

function needsDenaliTripDetailsMigration(canonical: CanonicalDocument): boolean {
  if (canonical.schemaVersion >= DENALI_CURRENT_CANONICAL_SCHEMA_VERSION) {
    return false;
  }
  if (canonical.roots.includes(LEGACY_TRIP_DETAILS_SOT_ROOT)) {
    return true;
  }
  const legacyRoot = canonical.data[LEGACY_TRIP_DETAILS_SOT_ROOT];
  return legacyRoot != null && typeof legacyRoot === "object" && !Array.isArray(legacyRoot);
}

function assertNoDualWriteSoT(canonical: CanonicalDocument): void {
  if (canonical.data[LEGACY_TRIP_DETAILS_SOT_ROOT] != null) {
    throw new Error("MIGRATE_DENALI_DUAL_WRITE_SOT");
  }
  if (canonical.roots.includes(LEGACY_TRIP_DETAILS_SOT_ROOT)) {
    throw new Error("MIGRATE_DENALI_DUAL_WRITE_SOT");
  }
}

export function buildLegacyTripDetailsCanonicalEnvelope(
  legacyForm: Record<string, unknown>
): CanonicalDocument {
  return wrapLegacyTripDetailsForMigration(legacyForm);
}

/**
 * Controlled batch migration — allowlisted tenants only (REQ-P6-017 / DEC-P6-007).
 */
export async function migrateDenaliCanonicalForTenant(
  prisma: PrismaClient,
  tenantId: string,
  options: {
    readonly allowlist?: ReadonlySet<string>;
    readonly workspaceType?: string;
  } = {}
): Promise<MigrateCanonicalDenaliResult> {
  const allowlist = options.allowlist ?? parseMigrateCanonicalTenantAllowlist();
  if (!isTenantMigrateCanonicalAllowlisted(tenantId, allowlist)) {
    return { tenantId, migratedTourIds: [], skippedTourIds: [] };
  }

  const workspaceType = options.workspaceType ?? "denali";
  const migrateHook = resolveMigrateCanonicalHook(workspaceType);

  const tours = await prisma.tour.findMany({
    where: { tenantId },
    select: { id: true, canonical: true, schemaVersion: true },
  });

  const migratedTourIds: string[] = [];
  const skippedTourIds: string[] = [];

  for (const tour of tours) {
    const stored = asCanonicalRecord(tour.canonical);
    if (stored == null || !needsDenaliTripDetailsMigration(stored)) {
      skippedTourIds.push(tour.id);
      continue;
    }

    const migrated = migrateHook(stored.schemaVersion, stored.data);
    assertNoDualWriteSoT(migrated);

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
export function isLegacyTripDetailsSchemaVersion(schemaVersion: number): boolean {
  return schemaVersion === DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION;
}
