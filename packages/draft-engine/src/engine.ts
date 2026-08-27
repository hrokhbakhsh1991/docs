import {
  DraftConflictError,
  type DraftAckCache,
  type DraftAckSource,
  type DraftDebugSnapshot,
  type DraftEngineConfig,
  type DraftEngineState,
  type DraftPushOptions,
  type DraftSchemaIssue,
  type DraftSetDataOptions,
  type DraftSyncEvent,
  type DraftSyncPayload,
} from "./types";
import { createClientSafeUuid } from "./client-safe-id";

const DEFAULT_DEBOUNCE_MS = 500;
const PUSH_RETRY_BACKOFF_MS = [1000, 2000] as const;
const PUSH_MAX_ATTEMPTS = 3;

export class DraftEngine<T> {
  private readonly config: DraftEngineConfig<T>;
  private readonly debounceMs: number;

  private data: T | null = null;
  private pendingDraft: DraftSyncPayload<T> | null = null;
  private status: DraftEngineState<T>["status"] = "IDLE";
  private version = 0;
  private schemaVersion = 1;
  private lastModified = 0;
  private error: Error | undefined;
  private schemaIssues: readonly DraftSchemaIssue[] | undefined;
  private lastValidSnapshot: DraftSyncPayload<T> | null = null;
  private ackCache: DraftAckCache<T> | null = null;
  private conflictReloadNotice = false;
  private lastIntentId: string | null = null;
  private lastErrorMessage: string | null = null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight: Promise<void> | null = null;
  private pendingSync = false;
  /** Bumped on clearDraft — in-flight pushes must not mutate state after a clear. */
  private syncEpoch = 0;
  /** True after user/clear sets freshStart data until the next successful push at v0. */
  private freshStartBypassPending = false;
  private readonly listeners = new Set<(_state: DraftEngineState<T>) => void>();

  constructor(config: DraftEngineConfig<T>) {
    this.config = config;
    this.debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  subscribe(listener: (_state: DraftEngineState<T>) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private newIntentId(): string {
    return createClientSafeUuid();
  }

  private emitDiagnostic(event: DraftSyncEvent): void {
    this.config.onDiagnostic?.(event);
  }

  private errorCause(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private draftPayloadDeepEqual(a: T | null, b: T | null): boolean {
    if (a === b) {
      return true;
    }
    if (a == null || b == null) {
      return false;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private isRetryablePushError(err: unknown): boolean {
    if (err instanceof DraftConflictError) {
      return false;
    }
    if (err instanceof Error && err.message === "WORKSPACE_DRAFT_PATCH_ABORTED") {
      return false;
    }
    if (err instanceof TypeError) {
      return true;
    }
    if (err instanceof Error && err.message.startsWith("WORKSPACE_DRAFT_PATCH_FAILED:")) {
      const status = Number.parseInt(
        err.message.slice("WORKSPACE_DRAFT_PATCH_FAILED:".length),
        10
      );
      return Number.isFinite(status) && status >= 500 && status <= 599;
    }
    return false;
  }

  private async invokePushWithRetry(
    payload: DraftSyncPayload<T>,
    options: DraftPushOptions
  ): Promise<DraftSyncPayload<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < PUSH_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.config.onPush(payload, options);
      } catch (err) {
        lastError = err;
        if (attempt >= PUSH_MAX_ATTEMPTS - 1 || !this.isRetryablePushError(err)) {
          throw err;
        }
        await this.sleep(PUSH_RETRY_BACKOFF_MS[attempt] ?? 2000);
      }
    }
    throw lastError;
  }

  async initialize(): Promise<void> {
    this.clearDebounce();
    this.status = "SYNCING";
    this.error = undefined;
    this.notify();

    try {
      await this.fetchAndHydrate({ forceApply: false });
      if (this.status === "SYNCING") {
        this.status = "IDLE";
      }
    } catch (err) {
      this.status = "ERROR";
      this.error = err instanceof Error ? err : new Error(String(err));
    }
    this.notify();
  }

  /** Push local DIRTY state immediately (skips debounce). No-op when not DIRTY. */
  async flush(): Promise<void> {
    this.clearDebounce();
    await this.flushSync();
  }

  /**
   * Best-effort push for tab unload — no SYNCING transition; errors swallowed by caller.
   * Uses {@link DraftPushOptions.keepalive} when the adapter supports it.
   */
  flushKeepalive(): void {
    if (this.status === "QUARANTINED" || this.data == null) {
      return;
    }
    if (this.status !== "DIRTY") {
      return;
    }
    this.clearDebounce();
    const gated = this.buildPayloadForPush();
    if (!gated.ok) {
      this.schemaIssues = gated.issues;
      this.status = "QUARANTINED";
      this.notify();
      return;
    }
    this.schemaIssues = undefined;
    const intentId = this.newIntentId();
    this.lastIntentId = intentId;
    this.emitDiagnostic({
      type: "push_start",
      intentId,
      version: gated.payload.version,
    });
    void this.config
      .onPush(gated.payload, { keepalive: true })
      .then((result) => {
        this.emitDiagnostic({
          type: "push_success",
          intentId,
          version: result.version,
        });
        this.lastErrorMessage = null;
      })
      .catch((err) => {
        const cause = this.errorCause(err);
        this.lastErrorMessage = cause;
        this.emitDiagnostic({
          type: "error",
          intentId,
          cause,
          recoverable: true,
        });
      });
  }

  async retry(): Promise<void> {
    const state = this.getState();
    if (state.status !== "ERROR" && state.status !== "QUARANTINED") {
      return;
    }
    if (state.data == null) {
      await this.initialize();
      return;
    }
    this.status = "DIRTY";
    this.error = undefined;
    this.notify();
    await this.flushSync();
  }

  /**
   * UI entry point: update local draft and optionally schedule sync via the engine debouncer.
   * Use `{ source: 'remote' }` for server hydration (no DIRTY, no push).
   */
  setDraftData(newData: T, options?: DraftSetDataOptions): void {
    const source = options?.source ?? "user";

    if (source === "user") {
      this.conflictReloadNotice = false;
    }

    if (source === "remote") {
      this.clearDebounce();
      this.data =
        this.config.normalizeRemote != null
          ? this.config.normalizeRemote(newData)
          : newData;
      if (options?.version != null) {
        this.version = options.version;
      }
      if (options?.schemaVersion != null) {
        this.schemaVersion = options.schemaVersion;
      }
      if (options?.lastModified != null) {
        this.lastModified = options.lastModified;
      }
      this.status = "IDLE";
      this.error = undefined;
      this.notify();
      return;
    }

    if (this.status === "CONFLICT_RESOLVING") {
      return;
    }
    if (this.status === "DRAFT_AVAILABLE") {
      return;
    }
    if (this.status === "QUARANTINED") {
      if (this.draftPayloadDeepEqual(this.data, newData)) {
        return;
      }
      this.data = newData;
      this.lastModified = Date.now();
      this.error = undefined;
      this.notify();
      return;
    }
    if (this.draftPayloadDeepEqual(this.data, newData)) {
      return;
    }
    const previousData = this.data;
    this.data = newData;
    this.lastModified = Date.now();
    const freshStartArmed = this.config.shouldBypassServerVersionAdoption?.(newData) === true;
    const freshStartWasArmed =
      previousData != null &&
      this.config.shouldBypassServerVersionAdoption?.(previousData) === true;
    if (freshStartArmed && !freshStartWasArmed) {
      this.freshStartBypassPending = true;
      this.ackCache = null;
      this.version = 0;
    }
    this.status = "DIRTY";
    this.error = undefined;
    this.notify();
    this.scheduleSync();
  }

  /** @deprecated Prefer setDraftData — kept for tests and backward compatibility. */
  update(newData: T, options?: DraftSetDataOptions): void {
    this.setDraftData(newData, options);
  }

  applyDraft(): void {
    if (this.pendingDraft == null) {
      return;
    }
    this.hydrateFromRemote(this.pendingDraft, "initialize");
    this.pendingDraft = null;
    this.status = "IDLE";
    this.error = undefined;
    this.notify();
  }

  async clearDraft(): Promise<void> {
    if (this.config.onDelete == null) {
      throw new Error("clearDraft requires config.onDelete");
    }

    this.clearDebounce();
    this.pendingSync = false;
    this.config.onAbortInFlightPush?.();
    this.syncEpoch += 1;

    const inFlight = this.syncInFlight;
    if (inFlight != null) {
      try {
        await inFlight;
      } catch {
        this.emitDiagnostic({
          type: "error",
          cause: "clear_await_push_failed",
          recoverable: true,
        });
      }
    }

    this.syncInFlight = null;
    this.pendingSync = false;

    await this.config.onDelete();

    this.pendingDraft = null;
    this.data = null;
    this.version = 0;
    this.schemaVersion = 1;
    this.lastModified = 0;
    this.status = "IDLE";
    this.error = undefined;
    this.schemaIssues = undefined;
    this.lastValidSnapshot = null;
    this.ackCache = null;
    this.freshStartBypassPending = false;
    this.conflictReloadNotice = false;
    this.notify();
  }

  /**
   * Delete remote draft then apply reset data in one notify — avoids a transient
   * `data=null` render between clear and freshStart setData (React prefill race).
   */
  async clearDraftAndReset(resetData: T): Promise<void> {
    if (this.config.onDelete == null) {
      throw new Error("clearDraftAndReset requires config.onDelete");
    }

    this.clearDebounce();
    this.pendingSync = false;
    this.config.onAbortInFlightPush?.();
    this.syncEpoch += 1;

    const inFlight = this.syncInFlight;
    if (inFlight != null) {
      try {
        await inFlight;
      } catch {
        this.emitDiagnostic({
          type: "error",
          cause: "clear_await_push_failed",
          recoverable: true,
        });
      }
    }

    this.syncInFlight = null;
    this.pendingSync = false;

    await this.config.onDelete();

    this.pendingDraft = null;
    this.data = resetData;
    this.version = 0;
    this.schemaVersion = 1;
    this.lastModified = Date.now();
    this.status = "DIRTY";
    this.error = undefined;
    this.schemaIssues = undefined;
    this.lastValidSnapshot = null;
    this.ackCache = null;
    this.conflictReloadNotice = false;
    this.freshStartBypassPending =
      this.config.shouldBypassServerVersionAdoption?.(resetData) === true;
    this.notify();
    await this.flushSync();
  }

  /** Test-only — read ack cache for Track B specs. */
  getAckCacheForTests(): DraftAckCache<T> | null {
    return this.ackCache;
  }

  /** Test-only — simulate ack cache miss while version > 0. */
  clearAckCacheForTests(): void {
    this.ackCache = null;
  }

  private commitServerAck(payload: DraftSyncPayload<T>, ackSource: DraftAckSource): void {
    this.ackCache = {
      version: payload.version,
      lastModified: payload.lastModified,
      schemaVersion: payload.schemaVersion,
      data: structuredClone(payload.data),
      ackedAt: Date.now(),
      ackSource,
    };
  }

  private async ensureAckBeforePush(epochAtStart: number): Promise<boolean> {
    if (
      this.data != null &&
      this.config.shouldBypassServerVersionAdoption?.(this.data) === true
    ) {
      if (this.freshStartBypassPending) {
        this.version = 0;
      }
      return this.syncEpoch === epochAtStart;
    }

    if (this.ackCache != null || this.version === 0) {
      return true;
    }

    const payload = await this.config.onFetch();
    if (this.syncEpoch !== epochAtStart) {
      return false;
    }

    if (payload == null) {
      this.version = 0;
      this.schemaVersion = 1;
      this.lastModified = 0;
      return true;
    }

    this.commitServerAck(payload, "initialize");
    if (this.status === "DIRTY" && this.data != null) {
      this.version = payload.version;
      this.schemaVersion = payload.schemaVersion;
      return this.syncEpoch === epochAtStart;
    }

    this.captureLastValidSnapshot(payload);
    this.setDraftData(payload.data, {
      source: "remote",
      version: payload.version,
      schemaVersion: payload.schemaVersion,
      lastModified: payload.lastModified,
    });
    return this.syncEpoch === epochAtStart;
  }

  /** Restore last server-valid snapshot and exit quarantine (Phase 5A revert CTA). */
  revertToLastValid(): void {
    if (this.lastValidSnapshot == null) {
      return;
    }
    const snap = this.lastValidSnapshot;
    this.schemaIssues = undefined;
    this.commitServerAck(snap, "patch200");
    this.setDraftData(snap.data, {
      source: "remote",
      version: snap.version,
      schemaVersion: snap.schemaVersion,
      lastModified: snap.lastModified,
    });
  }

  hasLastValidSnapshot(): boolean {
    return this.lastValidSnapshot != null;
  }

  getDebugSnapshot(): DraftDebugSnapshot {
    return {
      status: this.status,
      version: this.version,
      schemaVersion: this.schemaVersion,
      lastModified: this.lastModified,
      pendingSync: this.pendingSync,
      syncEpoch: this.syncEpoch,
      ackVersion: this.ackCache?.version ?? null,
      lastIntentId: this.lastIntentId,
      lastError: this.lastErrorMessage,
      conflictReloadNotice: this.conflictReloadNotice,
    };
  }

  getState(): DraftEngineState<T> {
    return {
      data: this.data != null ? structuredClone(this.data) : this.data,
      status: this.status,
      version: this.version,
      schemaVersion: this.schemaVersion,
      lastModified: this.lastModified,
      ...(this.pendingDraft != null
        ? {
            pendingDraft: {
              ...this.pendingDraft,
              data: structuredClone(this.pendingDraft.data),
            },
          }
        : {}),
      ...(this.error != null ? { error: this.error } : {}),
      ...(this.schemaIssues != null ? { schemaIssues: this.schemaIssues } : {}),
      ...(this.lastValidSnapshot != null ? { hasLastValidSnapshot: true } : {}),
      ...(this.conflictReloadNotice ? { conflictReloadNotice: true } : {}),
    };
  }

  private async fetchAndHydrate(options: { forceApply: boolean }): Promise<void> {
    const payload = await this.config.onFetch();
    if (payload == null) {
      this.pendingDraft = null;
      return;
    }
    if (options.forceApply || this.config.autoApply !== false) {
      this.hydrateFromRemote(payload, "initialize");
      this.pendingDraft = null;
      return;
    }
    this.pendingDraft = payload;
    this.status = "DRAFT_AVAILABLE";
  }

  /** Server / snapshot hydration — updates version metadata without marking DIRTY or pushing. */
  private hydrateFromRemote(payload: DraftSyncPayload<T>, ackSource: DraftAckSource): void {
    this.commitServerAck(payload, ackSource);
    this.setDraftData(payload.data, {
      source: "remote",
      version: payload.version,
      schemaVersion: payload.schemaVersion,
      lastModified: payload.lastModified,
    });
    if (this.data != null) {
      this.captureLastValidSnapshot({
        data: structuredClone(this.data),
        version: payload.version,
        schemaVersion: payload.schemaVersion,
        lastModified: payload.lastModified,
      });
    }
  }

  private captureLastValidSnapshot(payload: DraftSyncPayload<T>): void {
    this.lastValidSnapshot = {
      data: structuredClone(payload.data),
      version: payload.version,
      schemaVersion: payload.schemaVersion,
      lastModified: payload.lastModified,
    };
  }

  private applyPostMergeGate(merged: T): T {
    const gate = this.config.schemaGate;
    if (gate == null) {
      return merged;
    }
    const result = gate(merged, { phase: "merge" });
    return result.ok ? result.value : merged;
  }

  private buildPayload(): DraftSyncPayload<T> {
    if (this.data == null) {
      throw new Error("Cannot push draft: data is null");
    }
    return {
      data: this.data,
      version: this.ackCache?.version ?? this.version,
      schemaVersion: this.schemaVersion,
      lastModified: this.lastModified,
    };
  }

  private buildPayloadForPush():
    | { readonly ok: true; readonly payload: DraftSyncPayload<T> }
    | { readonly ok: false; readonly issues: readonly DraftSchemaIssue[] } {
    const base = this.buildPayload();
    const gate = this.config.schemaGate;
    if (gate == null) {
      return { ok: true, payload: base };
    }
    const result = gate(base.data, { phase: "prePush" });
    if (!result.ok) {
      return { ok: false, issues: result.issues };
    }
    return {
      ok: true,
      payload: {
        ...base,
        data: result.value,
      },
    };
  }

  private clearDebounce(): void {
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleSync(): void {
    if (this.status === "CONFLICT_RESOLVING" || this.status === "QUARANTINED") {
      return;
    }
    this.scheduleDebouncedSync();
  }

  /** Debounced sync scheduler — runs on the timer queue, not during React render. */
  private scheduleDebouncedSync(): void {
    if (this.status === "CONFLICT_RESOLVING" || this.status === "QUARANTINED") {
      return;
    }
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.status === "CONFLICT_RESOLVING" || this.status === "QUARANTINED") {
        return;
      }
      void this.flushSync();
    }, this.debounceMs);
  }

  private async flushSync(): Promise<void> {
    if (this.syncInFlight != null) {
      this.pendingSync = true;
      return;
    }

    if (this.status !== "DIRTY" && this.status !== "QUARANTINED") {
      return;
    }

    this.syncInFlight = this.doPush();
    try {
      await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
      if (this.pendingSync) {
        this.pendingSync = false;
        if (this.status === "DIRTY" || this.status === "QUARANTINED") {
          await this.flushSync();
        }
      }
    }
  }

  private async doPush(): Promise<void> {
    const epochAtStart = this.syncEpoch;

    if (this.status === "CONFLICT_RESOLVING") {
      return;
    }
    if ((this.status !== "DIRTY" && this.status !== "QUARANTINED") || this.data == null) {
      return;
    }

    const ackReady = await this.ensureAckBeforePush(epochAtStart);
    if (!ackReady || this.syncEpoch !== epochAtStart) {
      return;
    }

    const gated = this.buildPayloadForPush();
    if (!gated.ok) {
      this.schemaIssues = gated.issues;
      this.status = "QUARANTINED";
      this.error = undefined;
      this.notify();
      return;
    }

    this.schemaIssues = undefined;
    this.status = "SYNCING";
    this.error = undefined;
    this.notify();

    const intentId = this.newIntentId();
    this.lastIntentId = intentId;
    this.emitDiagnostic({
      type: "push_start",
      intentId,
      version: gated.payload.version,
    });

    try {
      const pushedPayload = gated.payload;
      const baselineAckData = this.ackCache?.data;
      const result = await this.invokePushWithRetry(pushedPayload, { intentId });
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
      if (this.config.shouldBypassServerVersionAdoption?.(pushedPayload.data) === true) {
        this.freshStartBypassPending = false;
      }
      const localChangedDuringPush =
        this.lastModified !== pushedPayload.lastModified ||
        JSON.stringify(this.data) !== JSON.stringify(pushedPayload.data);
      if (localChangedDuringPush) {
        this.captureLastValidSnapshot(result);
        this.commitServerAck(result, "patch200");
        this.status = "DIRTY";
        this.scheduleSync();
      } else {
        this.hydrateFromRemote(result, "patch200");
        this.status = "IDLE";
      }
      this.emitDiagnostic({
        type: "push_success",
        intentId,
        version: result.version,
      });
      this.lastErrorMessage = null;
      this.config.onPushSuccess?.(pushedPayload, result, baselineAckData);
    } catch (err) {
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
      if (err instanceof DraftConflictError) {
        this.emitDiagnostic({
          type: "conflict",
          intentId,
          strategy: this.config.conflictStrategy,
        });
        await this.handleConflict(err, epochAtStart);
        if (this.syncEpoch !== epochAtStart) {
          return;
        }
        this.notify();
        return;
      }
      if (err instanceof Error && err.message === "WORKSPACE_DRAFT_PATCH_ABORTED") {
        if (this.status === "SYNCING") {
          this.status = "DIRTY";
          this.scheduleSync();
        }
        return;
      }
      const cause = this.errorCause(err);
      this.lastErrorMessage = cause;
      this.emitDiagnostic({
        type: "error",
        intentId,
        cause,
        recoverable: false,
      });
      this.status = "ERROR";
      this.error = err instanceof Error ? err : new Error(String(err));
    }
    this.notify();
  }

  private async handleConflict(
    conflict: DraftConflictError<T>,
    epochAtStart: number = this.syncEpoch
  ): Promise<void> {
    const { conflictStrategy } = this.config;
    const serverPayload = conflict.serverPayload;

    if (conflictStrategy === "REFETCH_REAPPLY") {
      await this.refetchAndReapplyLocal(conflict, epochAtStart);
      return;
    }

    if (conflictStrategy === "SERVER_WINS") {
      this.hydrateFromRemote(serverPayload, "conflictRefetch");
      this.conflictReloadNotice = true;
      this.status = "IDLE";
      this.notify();
      return;
    }

    if (conflictStrategy === "CLIENT_WINS") {
      try {
        const clientGated = this.buildPayloadForPush();
        if (!clientGated.ok) {
          this.schemaIssues = clientGated.issues;
          this.status = "QUARANTINED";
          this.error = undefined;
          this.notify();
          return;
        }
        const retryIntentId = this.newIntentId();
        this.lastIntentId = retryIntentId;
        this.emitDiagnostic({
          type: "push_start",
          intentId: retryIntentId,
          version: clientGated.payload.version,
        });
        const result = await this.invokePushWithRetry(clientGated.payload, {
          intentId: retryIntentId,
        });
        this.emitDiagnostic({
          type: "push_success",
          intentId: retryIntentId,
          version: result.version,
        });
        this.lastErrorMessage = null;
        this.hydrateFromRemote(result, "patch200");
        this.status = "IDLE";
        this.notify();
      } catch (retryErr) {
        if (retryErr instanceof DraftConflictError) {
          const retryIntentId = this.lastIntentId;
          if (retryIntentId != null) {
            this.emitDiagnostic({
              type: "conflict",
              intentId: retryIntentId,
              strategy: this.config.conflictStrategy,
            });
          }
          await this.handleConflict(retryErr, epochAtStart);
          return;
        }
        const cause = this.errorCause(retryErr);
        this.lastErrorMessage = cause;
        this.emitDiagnostic({
          type: "error",
          intentId: this.lastIntentId ?? undefined,
          cause,
          recoverable: false,
        });
        this.status = "ERROR";
        this.error = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
        this.notify();
      }
      return;
    }

    if (conflictStrategy === "MERGE") {
      if (this.config.merge == null) {
        this.status = "ERROR";
        this.error = new Error("MERGE conflict strategy requires config.merge");
        this.notify();
        return;
      }
      if (this.data == null) {
        this.status = "ERROR";
        this.error = new Error("Cannot merge draft: local data is null");
        this.notify();
        return;
      }
      this.data = this.applyPostMergeGate(this.config.merge(this.data, serverPayload.data));
      this.lastModified = Date.now();
      this.status = "DIRTY";
      this.notify();
      this.scheduleSync();
    }
  }

  /**
   * On 409: re-fetch server state, merge with local edits, hydrate quietly (no auto-push).
   */
  private async refetchAndReapplyLocal(
    conflict: DraftConflictError<T>,
    epochAtStart: number = this.syncEpoch
  ): Promise<void> {
    const localPending = this.data;
    if (localPending == null) {
      this.hydrateFromRemote(conflict.serverPayload, "conflictRefetch");
      this.status = "IDLE";
      this.error = undefined;
      this.notify();
      return;
    }

    if (
      this.config.shouldBypassServerVersionAdoption?.(localPending) === true &&
      this.config.onDelete != null
    ) {
      this.status = "CONFLICT_RESOLVING";
      this.error = undefined;
      this.notify();
      try {
        await this.config.onDelete();
        if (this.syncEpoch !== epochAtStart) {
          return;
        }
        this.version = 0;
        this.ackCache = null;
        this.freshStartBypassPending = true;
        this.status = "DIRTY";
        this.error = undefined;
        this.pendingSync = true;
        this.notify();
      } catch {
        if (this.syncEpoch !== epochAtStart) {
          return;
        }
        this.emitDiagnostic({
          type: "error",
          cause: "fresh_start_conflict_recovery_failed",
          recoverable: false,
        });
        this.status = "ERROR";
        this.error = new Error("FRESH_START_CONFLICT_RECOVERY_FAILED");
        this.notify();
      }
      return;
    }

    this.status = "CONFLICT_RESOLVING";
    this.error = undefined;
    this.notify();
    try {
      const serverPayload = await this.config.onFetch();
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
      const fallback = conflict.serverPayload;
      const occSource = serverPayload ?? fallback;
      const rawMerged =
        serverPayload != null
          ? this.config.merge != null
            ? this.config.merge(localPending, serverPayload.data)
            : serverPayload.data
          : this.config.merge != null
            ? this.config.merge(localPending, fallback.data)
            : localPending;
      const merged = this.applyPostMergeGate(rawMerged);

      this.setDraftData(merged, {
        source: "remote",
        version: occSource.version,
        schemaVersion: occSource.schemaVersion,
        lastModified: occSource.lastModified,
      });
      this.commitServerAck(occSource, "conflictRefetch");
      const snapshotData = this.data ?? merged;
      this.captureLastValidSnapshot({ ...occSource, data: snapshotData });
      this.status = "IDLE";
      this.error = undefined;
      this.notify();
    } catch {
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
      this.emitDiagnostic({
        type: "error",
        cause: "refetch_reapply_failed",
        recoverable: true,
      });
      this.hydrateFromRemote(conflict.serverPayload, "conflictRefetch");
      this.status = "IDLE";
      this.error = undefined;
      this.notify();
    } finally {
      if (this.status === "CONFLICT_RESOLVING") {
        this.status = "IDLE";
        this.notify();
      }
    }
  }
}
