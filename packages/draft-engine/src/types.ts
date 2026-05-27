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
  lastModified: number;
};

export type ConflictStrategy =
  | "SERVER_WINS"
  | "CLIENT_WINS"
  | "MERGE"
  /** Re-fetch latest via onFetch, then re-apply local edits and sync again. */
  | "REFETCH_REAPPLY";

export type DraftEngineConfig<T> = {
  id: string;
  conflictStrategy: ConflictStrategy;
  /** Default true. If false, fetched drafts are staged as pending until applyDraft(). */
  autoApply?: boolean;
  onFetch: () => Promise<DraftSyncPayload<T> | null>;
  onPush: (payload: DraftSyncPayload<T>) => Promise<DraftSyncPayload<T>>;
  /** Optional delete handler used by clearDraft(). */
  onDelete?: () => Promise<void>;
  /** Debounce interval before triggering onPush after update(). Default: 500ms. */
  debounceMs?: number;
  /** Required when conflictStrategy is MERGE; optional for REFETCH_REAPPLY (defaults to keeping local). */
  merge?: (local: T, server: T) => T;
};

export type DraftEngineState<T> = {
  readonly data: T | null;
  readonly status: DraftStatus;
  readonly version: number;
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
