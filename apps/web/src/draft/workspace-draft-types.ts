import type { ConflictStrategy, DraftEngineState, DraftSetDataOptions } from "@app-tour/draft-engine";

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
  readonly merge?: (_local: T, _server: T) => T;
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
  readonly navLocked: boolean;
  readonly setData: (_data: T, _options?: DraftSetDataOptions) => void;
  readonly retry: () => Promise<void>;
  readonly clearDraft: () => Promise<void>;
  readonly applyDraft: () => void;
  readonly flush: () => Promise<void>;
  readonly initialize: () => Promise<void>;
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
