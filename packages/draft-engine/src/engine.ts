import {
  DraftConflictError,
  type DraftAckCache,
  type DraftAckSource,
  type DraftEngineConfig,
  type DraftEngineState,
  type DraftSchemaIssue,
  type DraftSetDataOptions,
  type DraftSyncPayload,
} from "./types";

const DEFAULT_DEBOUNCE_MS = 500;

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

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight: Promise<void> | null = null;
  private pendingSync = false;
  /** Bumped on clearDraft — in-flight pushes must not mutate state after a clear. */
  private syncEpoch = 0;
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
    void this.config.onPush(gated.payload, { keepalive: true }).catch(() => {});
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
      this.data = newData;
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
      this.data = newData;
      this.lastModified = Date.now();
      this.error = undefined;
      this.notify();
      return;
    }
    this.data = newData;
    this.lastModified = Date.now();
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
    this.syncEpoch += 1;

    const inFlight = this.syncInFlight;
    if (inFlight != null) {
      try {
        await inFlight;
      } catch {
        // Stale push failure must not block server delete.
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
    this.conflictReloadNotice = false;
    this.notify();
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

  getState(): DraftEngineState<T> {
    return {
      data: this.data,
      status: this.status,
      version: this.version,
      schemaVersion: this.schemaVersion,
      lastModified: this.lastModified,
      ...(this.pendingDraft != null ? { pendingDraft: this.pendingDraft } : {}),
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
    this.captureLastValidSnapshot(payload);
    this.commitServerAck(payload, ackSource);
    this.setDraftData(payload.data, {
      source: "remote",
      version: payload.version,
      schemaVersion: payload.schemaVersion,
      lastModified: payload.lastModified,
    });
  }

  private captureLastValidSnapshot(payload: DraftSyncPayload<T>): void {
    this.lastValidSnapshot = {
      data: structuredClone(payload.data),
      version: payload.version,
      schemaVersion: payload.schemaVersion,
      lastModified: payload.lastModified,
    };
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

    try {
      const pushedPayload = gated.payload;
      const baselineAckData = this.ackCache?.data;
      const result = await this.config.onPush(pushedPayload);
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
      const localChangedDuringPush =
        this.data !== pushedPayload.data || this.lastModified !== pushedPayload.lastModified;
      if (localChangedDuringPush) {
        this.captureLastValidSnapshot(result);
        this.commitServerAck(result, "patch200");
        this.status = "DIRTY";
        this.scheduleSync();
      } else {
        this.hydrateFromRemote(result, "patch200");
        this.status = "IDLE";
      }
      this.config.onPushSuccess?.(pushedPayload, result, baselineAckData);
    } catch (err) {
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
      if (err instanceof DraftConflictError) {
        await this.handleConflict(err, epochAtStart);
        if (this.syncEpoch !== epochAtStart) {
          return;
        }
        this.notify();
        return;
      }
      if (err instanceof Error && err.message === "WORKSPACE_DRAFT_PATCH_ABORTED") {
        return;
      }
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
        const result = await this.config.onPush(clientGated.payload);
        this.hydrateFromRemote(result, "patch200");
        this.status = "IDLE";
        this.notify();
      } catch (retryErr) {
        if (retryErr instanceof DraftConflictError) {
          await this.handleConflict(retryErr, epochAtStart);
          return;
        }
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
      this.data = this.config.merge(this.data, serverPayload.data);
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
      const merged =
        serverPayload != null
          ? this.config.merge != null
            ? this.config.merge(localPending, serverPayload.data)
            : serverPayload.data
          : this.config.merge != null
            ? this.config.merge(localPending, fallback.data)
            : localPending;

      this.setDraftData(merged, {
        source: "remote",
        version: occSource.version,
        schemaVersion: occSource.schemaVersion,
        lastModified: occSource.lastModified,
      });
      this.commitServerAck(occSource, "conflictRefetch");
      this.captureLastValidSnapshot({ ...occSource, data: merged });
      this.status = "IDLE";
      this.error = undefined;
      this.notify();
    } catch {
      if (this.syncEpoch !== epochAtStart) {
        return;
      }
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
