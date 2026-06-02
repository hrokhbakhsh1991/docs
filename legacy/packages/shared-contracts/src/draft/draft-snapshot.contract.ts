import { z } from "zod";

/** Default payload schema generation for persisted draft snapshots (bump when breaking `data` shape). */
export const DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION = 1;

/** Current schema generation clients and migrators should target. */
export const CURRENT_DRAFT_SCHEMA_VERSION = DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION;

/**
 * Canonical draft snapshot envelope shared by API, web adapters, and `@repo/draft-engine`.
 * `version` is optimistic-concurrency; `schemaVersion` describes the `data` blob shape.
 */
export type DraftSnapshot<TData = Record<string, unknown>> = {
  readonly data: TData;
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
};

/** Wire alias when APIs expose snake_case JSON (optional mapping layer). */
export type DraftSnapshotWire<TData = Record<string, unknown>> = {
  readonly data: TData;
  readonly version: number;
  readonly schema_version: number;
  readonly lastModified: number;
};

export const draftSnapshotEnvelopeSchema = z
  .object({
    data: z.record(z.string(), z.unknown()),
    version: z.number().int().min(0),
    schemaVersion: z.number().int().min(1),
    lastModified: z.number().int().min(0),
  })
  .strict();

export type DraftSnapshotEnvelope = z.infer<typeof draftSnapshotEnvelopeSchema>;

export function toDraftSnapshotWire<TData>(
  snapshot: DraftSnapshot<TData>,
): DraftSnapshotWire<TData> {
  return {
    data: snapshot.data,
    version: snapshot.version,
    schema_version: snapshot.schemaVersion,
    lastModified: snapshot.lastModified,
  };
}

export function fromDraftSnapshotWire<TData>(
  wire: DraftSnapshotWire<TData>,
): DraftSnapshot<TData> {
  return {
    data: wire.data,
    version: wire.version,
    schemaVersion: wire.schema_version,
    lastModified: wire.lastModified,
  };
}
