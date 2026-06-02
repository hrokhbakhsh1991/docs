export type DraftStatus =
  | "IDLE"
  | "SYNCING"
  | "DIRTY"
  | "DRAFT_AVAILABLE"
  | "CONFLICT_RESOLVING"
  | "ERROR";

export type DraftSyncPayload<T> = {
  data: T;
  version: number;
  /** Draft `data` blob schema generation (see `@repo/shared-contracts` `DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION`). */
  schemaVersion: number;
  lastModified: number;
};

/** Origin of a {@link DraftEngine.setDraftData} call — controls dirty + sync scheduling. */
export type DraftDataSource = "user" | "remote";

export type DraftSetDataOptions = {
  /** Default `user` — marks DIRTY and schedules debounced push. `remote` is quiet hydration only. */
  source?: DraftDataSource;
  /** When `source` is `remote`, apply server OCC fields so the next user push uses the latest version. */
  version?: number;
  schemaVersion?: number;
  lastModified?: number;
};

export type ConflictStrategy =
  | "SERVER_WINS"
  | "CLIENT_WINS"
  | "MERGE"
  /** Re-fetch via onFetch, merge with local, hydrate quietly — no automatic retry push. */
  | "REFETCH_REAPPLY";

export type DraftEngineConfig<T> = {
  id: string;
  conflictStrategy: ConflictStrategy;
  /** Default true. If false, fetched drafts are staged as pending until applyDraft(). */
  autoApply?: boolean;
  onFetch: () => Promise<DraftSyncPayload<T> | null>;
  onPush: (_payload: DraftSyncPayload<T>) => Promise<DraftSyncPayload<T>>;
  /** Optional delete handler used by clearDraft(). */
  onDelete?: () => Promise<void>;
  /** Debounce interval before triggering onPush after update(). Default: 500ms. */
  debounceMs?: number;
  /** Required when conflictStrategy is MERGE; optional for REFETCH_REAPPLY (defaults to keeping local). */
  merge?: (_local: T, _server: T) => T;
};

export type DraftEngineState<T> = {
  readonly data: T | null;
  readonly status: DraftStatus;
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
  readonly pendingDraft?: DraftSyncPayload<T> | null;
  readonly error?: Error;
};

export class DraftConflictError<T> extends Error {
  readonly serverPayload: DraftSyncPayload<T>;

  constructor(serverPayload: DraftSyncPayload<T>, message = "Draft sync conflict") {
    super(message);
    this.name = "DraftConflictError";
    this.serverPayload = serverPayload;
  }
}
