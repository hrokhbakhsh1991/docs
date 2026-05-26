export type DraftStatus = "IDLE" | "SYNCING" | "DIRTY" | "ERROR";

export type DraftSyncPayload<T> = {
  data: T;
  version: number;
  lastModified: number;
};

export type ConflictStrategy = "SERVER_WINS" | "CLIENT_WINS" | "MERGE";

export type DraftEngineConfig<T> = {
  id: string;
  conflictStrategy: ConflictStrategy;
  onFetch: () => Promise<DraftSyncPayload<T> | null>;
  onPush: (payload: DraftSyncPayload<T>) => Promise<DraftSyncPayload<T>>;
  /** Debounce interval before triggering onPush after update(). Default: 500ms. */
  debounceMs?: number;
  /** Required when conflictStrategy is MERGE. */
  merge?: (local: T, server: T) => T;
};

export type DraftEngineState<T> = {
  readonly data: T | null;
  readonly status: DraftStatus;
  readonly version: number;
  readonly lastModified: number;
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
