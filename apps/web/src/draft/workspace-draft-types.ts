import type { ConflictStrategy, DraftEngineState, DraftSchemaGate, DraftSetDataOptions, DraftStatus, DraftSyncPayload } from "@app-tour/draft-engine";

export type WorkspaceDraftEnvelope<TForm, TMeta = unknown> = {
  readonly form: TForm;
  readonly meta: TMeta;
};

export type WorkspaceDraftAdapterOptions<T> = {
  readonly workspaceId: string;
  readonly namespace: string;
  readonly draftKey: string;
  readonly id?: string;
  readonly conflictStrategy?: ConflictStrategy;
  readonly debounceMs?: number;
  readonly autoApply?: boolean;
  /** When false, skip initial GET — used when `?clone=` hydrates locally first (11.6). */
  readonly hydrateFromRemote?: boolean;
  /** When false, skip visibility/pagehide flush hooks (Phase 3). Default true. */
  readonly visibilityFlush?: boolean;
  readonly merge?: (_local: T, _server: T) => T;
  readonly onPushSuccess?: (
    _localPayload: DraftSyncPayload<T>,
    _serverPayload: DraftSyncPayload<T>,
    _baselineData: T | undefined,
  ) => void;
  /** prePush gate — Phase 5A; never blocks setData. */
  readonly schemaGate?: DraftSchemaGate<T>;
  /** Strip server-only fields after remote hydrate (Track B B-8). */
  readonly normalizeRemote?: (_data: T) => T;
  /** Skip server OCC adoption on push when local data is a fresh-start envelope. */
  readonly shouldBypassServerVersionAdoption?: (_data: T) => boolean;
};

export type UseWorkspaceDraftOptions<T> = WorkspaceDraftAdapterOptions<T>;

export type WorkspaceDraftIndexItem = {
  readonly draftNamespace: string;
  readonly draftKey: string;
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
  readonly updatedAt: string;
};

export type WorkspaceDraftIndexResponse = {
  readonly items: readonly WorkspaceDraftIndexItem[];
};

export type WorkspaceDraftHookResult<T> = {
  readonly data: T | null;
  readonly status: DraftEngineState<T>["status"];
  readonly version: number;
  readonly schemaVersion: number;
  readonly lastModified: number;
  readonly error: Error | undefined;
  readonly pendingDraft: DraftEngineState<T>["pendingDraft"];
  readonly schemaIssues: DraftEngineState<T>["schemaIssues"];
  readonly conflictReloadNotice: boolean;
  readonly canRevertQuarantine: boolean;
  readonly navLocked: boolean;
  readonly setData: (_data: T, _options?: DraftSetDataOptions) => void;
  readonly retry: () => Promise<void>;
  readonly clearDraft: () => Promise<void>;
  readonly clearDraftAndReset: (reset: T) => Promise<void>;
  readonly applyDraft: () => void;
  readonly flush: () => Promise<DraftStatus | undefined>;
  readonly initialize: () => Promise<void>;
  readonly revertToLastValid: () => void;
};

export type WorkspaceDraftEventListItem = {
  readonly id: string;
  readonly action: "created" | "updated" | "deleted";
  readonly version: number | null;
  readonly schemaVersion: number;
  readonly actorUserId: string;
  readonly occurredAt: string;
};

export type WorkspaceDraftEventsResponse = {
  readonly items: readonly WorkspaceDraftEventListItem[];
};
