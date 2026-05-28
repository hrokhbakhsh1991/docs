import {
  CURRENT_DRAFT_SCHEMA_VERSION,
  DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION,
  type DraftSnapshot,
} from "./draft-snapshot.contract";

export type DraftMigrationResult<TData = Record<string, unknown>> = {
  readonly snapshot: DraftSnapshot<TData>;
  readonly upgraded: boolean;
};

export type DraftMigrator<TData = Record<string, unknown>> = (
  _data: unknown,
  _fromSchemaVersion: number,
) => { data: TData; toSchemaVersion: number };

export const DENALI_CREATE_DRAFT_KEY = "denali-create";

/** Pre–phase 3 Denali create wizard rail (photos last). */
const LEGACY_DENALI_WIZARD_RAIL = [
  "denali_basic",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "denali_photos",
  "review",
] as const;

/** Phase 3 Denali create wizard rail (content + gallery on step 2). */
const CURRENT_DENALI_WIZARD_RAIL = [
  "denali_basic",
  "denali_photos",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "review",
] as const;

export const DENALI_WIZARD_RAIL_LAYOUT_VERSION = 2;

function migrateDenaliDraftStepIndex(
  storedIndex: number,
  railLayoutVersion: number | undefined,
): number {
  const safeIndex = Number.isFinite(storedIndex) ? Math.floor(storedIndex) : 0;

  if ((railLayoutVersion ?? 1) >= DENALI_WIZARD_RAIL_LAYOUT_VERSION) {
    return Math.max(0, Math.min(safeIndex, CURRENT_DENALI_WIZARD_RAIL.length - 1));
  }

  const legacyIndex = Math.max(0, Math.min(safeIndex, LEGACY_DENALI_WIZARD_RAIL.length - 1));
  const stepId = LEGACY_DENALI_WIZARD_RAIL[legacyIndex]!;
  const mapped = CURRENT_DENALI_WIZARD_RAIL.indexOf(stepId);
  return mapped >= 0 ? mapped : 0;
}

/** Minimal safe Denali wizard draft blob when legacy rows are incomplete. */
export const migrateDenaliCreateDraftData: DraftMigrator = (
  data: unknown,
  _fromSchemaVersion: number,
) => {
  const record =
    data != null && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  const form =
    record.form != null && typeof record.form === "object" && !Array.isArray(record.form)
      ? (record.form as Record<string, unknown>)
      : {};

  const stepRaw = record.currentStepIndex;
  const railLayoutRaw = record.railLayoutVersion;
  const railLayoutVersion =
    typeof railLayoutRaw === "number" && Number.isFinite(railLayoutRaw)
      ? Math.floor(railLayoutRaw)
      : 1;
  const currentStepIndex = migrateDenaliDraftStepIndex(
    typeof stepRaw === "number" && Number.isFinite(stepRaw) ? stepRaw : 0,
    railLayoutVersion,
  );

  return {
    data: {
      form,
      currentStepIndex,
      railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
    } as Record<string, unknown>,
    toSchemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
  };
};

export class DraftMigratorRegistry {
  private readonly migrators = new Map<string, DraftMigrator>();

  register(draftKey: string, migrator: DraftMigrator): void {
    this.migrators.set(draftKey.trim(), migrator);
  }

  migrateEnvelope<TData = Record<string, unknown>>(
    draftKey: string,
    envelope: DraftSnapshot,
  ): DraftMigrationResult<TData> {
    const key = draftKey.trim();
    const fromVersion = Number(envelope.schemaVersion) || DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION;
    const migrator = this.migrators.get(key);

    if (!migrator && fromVersion >= CURRENT_DRAFT_SCHEMA_VERSION) {
      return { snapshot: envelope as DraftSnapshot<TData>, upgraded: false };
    }

    const { data, toSchemaVersion } = migrator
      ? migrator(envelope.data, fromVersion)
      : { data: envelope.data, toSchemaVersion: fromVersion };

    const upgraded =
      toSchemaVersion !== fromVersion ||
      JSON.stringify(data) !== JSON.stringify(envelope.data);

    if (!upgraded) {
      return { snapshot: envelope as DraftSnapshot<TData>, upgraded: false };
    }

    return {
      snapshot: {
        data: data as TData,
        version: envelope.version,
        schemaVersion: toSchemaVersion,
        lastModified: envelope.lastModified,
      },
      upgraded: true,
    };
  }
}

export function createDefaultDraftMigratorRegistry(): DraftMigratorRegistry {
  const registry = new DraftMigratorRegistry();
  registry.register(DENALI_CREATE_DRAFT_KEY, migrateDenaliCreateDraftData);
  return registry;
}
