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
  data: unknown,
  fromSchemaVersion: number,
) => { data: TData; toSchemaVersion: number };

export const DENALI_CREATE_DRAFT_KEY = "denali-create";

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
  const currentStepIndex =
    typeof stepRaw === "number" && Number.isFinite(stepRaw) && stepRaw >= 0
      ? Math.floor(stepRaw)
      : 0;

  return {
    data: { form, currentStepIndex } as Record<string, unknown>,
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
