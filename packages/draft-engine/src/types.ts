export type DraftStatus =
  | "IDLE"
  | "SYNCING"
  | "DIRTY"
  | "DRAFT_AVAILABLE"
  | "CONFLICT_RESOLVING"
  | "ERROR"
  /** Network sync halted after prePush schema gate failure — UI data remains editable (Phase 5A). */
  | "QUARANTINED";

export type DraftSchemaPhase = "prePush" | "merge";

export type DraftSchemaIssue = {
  readonly code: string;
  readonly path?: readonly string[];
  readonly message?: string;
};

export type DraftSchemaGateResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly DraftSchemaIssue[] };

export type DraftSchemaGate<T> = (
  _candidate: T,
  _ctx: { readonly phase: DraftSchemaPhase }
) => DraftSchemaGateResult<T>;

export type DraftSyncPayload<T> = {
  data: T;
  version: number;
  /** Draft `data` blob schema generation for forward-compatible migrations. */
  schemaVersion: number;
  lastModified: number;
};

export type DraftAckSource = "initialize" | "patch200" | "conflictRefetch";

/** Last parsed GET/PATCH 200 — OCC cache only (Track B / INV-6). */
export type DraftAckCache<T> = {
  readonly version: number;
  readonly lastModified: number;
  readonly schemaVersion: number;
  readonly data: T;
  readonly ackedAt: number;
  readonly ackSource: DraftAckSource;
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

export type DraftPushOptions = {
  /** Browser may complete PATCH after page unload (Phase 3 visibility flush). */
  readonly keepalive?: boolean;
};

export type DraftEngineConfig<T> = {
  id: string;
  conflictStrategy: ConflictStrategy;
  /** Default true. If false, fetched drafts are staged as pending until applyDraft(). */
  autoApply?: boolean;
  onFetch: () => Promise<DraftSyncPayload<T> | null>;
  onPush: (
    _payload: DraftSyncPayload<T>,
    _options?: DraftPushOptions
  ) => Promise<DraftSyncPayload<T>>;
  /** Optional delete handler used by clearDraft(). */
  onDelete?: () => Promise<void>;
  /** Debounce interval before triggering onPush after update(). Default: 500ms. */
  debounceMs?: number;
  /** Required when conflictStrategy is MERGE; optional for REFETCH_REAPPLY (defaults to keeping local). */
  merge?: (_local: T, _server: T) => T;
  /** Optional hook after successful PATCH (non-keepalive). */
  onPushSuccess?: (
    _localPayload: DraftSyncPayload<T>,
    _serverPayload: DraftSyncPayload<T>,
    _baselineData: T | undefined,
  ) => void;
  /** Runs at prePush only — never blocks setDraftData (Phase 5A). */
  schemaGate?: DraftSchemaGate<T>;
};

export type DraftEngineState<T> = {
  readonly data: T | null;
  readonly status: DraftStatus;
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
  readonly pendingDraft?: DraftSyncPayload<T> | null;
  readonly error?: Error;
  readonly schemaIssues?: readonly DraftSchemaIssue[];
  readonly hasLastValidSnapshot?: boolean;
  /** True after SERVER_WINS 409 reload until next user edit (Track C). */
  readonly conflictReloadNotice?: boolean;
};

export class DraftConflictError<T> extends Error {
  readonly serverPayload: DraftSyncPayload<T>;

  constructor(serverPayload: DraftSyncPayload<T>, message = "Draft sync conflict") {
    super(message);
    this.name = "DraftConflictError";
    this.serverPayload = serverPayload;
  }
}
