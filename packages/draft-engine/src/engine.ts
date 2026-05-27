import { DraftConflictError, type DraftEngineConfig, type DraftEngineState, type DraftSyncPayload } from "./types";

const DEFAULT_DEBOUNCE_MS = 500;

export class DraftEngine<T> {
  private readonly config: DraftEngineConfig<T>;
  private readonly debounceMs: number;

  private data: T | null = null;
  private pendingDraft: DraftSyncPayload<T> | null = null;
  private status: DraftEngineState<T>["status"] = "IDLE";
  private version = 0;
  private lastModified = 0;
  private error: Error | undefined;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight: Promise<void> | null = null;
  private pendingSync = false;
  private readonly listeners = new Set<(state: DraftEngineState<T>) => void>();

  constructor(config: DraftEngineConfig<T>) {
    this.config = config;
    this.debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  subscribe(listener: (state: DraftEngineState<T>) => void): () => void {
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

  async retry(): Promise<void> {
    const state = this.getState();
    if (state.status !== "ERROR") {
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
   * UI entry point: update local draft and schedule sync via the engine's internal debouncer
   * (outside React's render/effect cycle).
   */
  setDraftData(newData: T): void {
    if (this.status === "DRAFT_AVAILABLE" || this.status === "CONFLICT_RESOLVING") {
      return;
    }
    this.data = newData;
    this.lastModified = Date.now();
    this.status = "DIRTY";
    this.error = undefined;
    this.notify();
    this.scheduleDebouncedSync();
  }

  /** @deprecated Prefer setDraftData — kept for tests and backward compatibility. */
  update(newData: T): void {
    this.setDraftData(newData);
  }

  applyDraft(): void {
    if (this.pendingDraft == null) {
      return;
    }
    this.applyPayload(this.pendingDraft);
    this.pendingDraft = null;
    this.status = "IDLE";
    this.error = undefined;
    this.notify();
  }

  async clearDraft(): Promise<void> {
    if (this.config.onDelete == null) {
      throw new Error("clearDraft requires config.onDelete");
    }
    await this.config.onDelete();
    this.clearDebounce();
    this.pendingDraft = null;
    this.data = null;
    this.version = 0;
    this.lastModified = 0;
    this.status = "IDLE";
    this.error = undefined;
    this.notify();
  }

  getState(): DraftEngineState<T> {
    return {
      data: this.data,
      status: this.status,
      version: this.version,
      lastModified: this.lastModified,
      ...(this.pendingDraft != null ? { pendingDraft: this.pendingDraft } : {}),
      ...(this.error != null ? { error: this.error } : {}),
    };
  }

  private async fetchAndHydrate(options: { forceApply: boolean }): Promise<void> {
    const payload = await this.config.onFetch();
    if (payload == null) {
      this.pendingDraft = null;
      return;
    }
    if (options.forceApply || this.config.autoApply !== false) {
      this.applyPayload(payload);
      this.pendingDraft = null;
      return;
    }
    this.pendingDraft = payload;
    this.status = "DRAFT_AVAILABLE";
  }

  private applyPayload(payload: DraftSyncPayload<T>): void {
    this.data = payload.data;
    this.version = payload.version;
    this.lastModified = payload.lastModified;
  }

  private buildPayload(): DraftSyncPayload<T> {
    if (this.data == null) {
      throw new Error("Cannot push draft: data is null");
    }
    return {
      data: this.data,
      version: this.version,
      lastModified: this.lastModified,
    };
  }

  private clearDebounce(): void {
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Debounced sync scheduler — runs on the timer queue, not during React render. */
  private scheduleDebouncedSync(): void {
    if (this.status === "CONFLICT_RESOLVING") {
      return;
    }
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.status === "CONFLICT_RESOLVING") {
        return;
      }
      void this.flushSync();
    }, this.debounceMs);
  }

  private scheduleSync(): void {
    this.scheduleDebouncedSync();
  }

  private async flushSync(): Promise<void> {
    if (this.syncInFlight != null) {
      this.pendingSync = true;
      return;
    }

    if (this.status !== "DIRTY") {
      return;
    }

    this.syncInFlight = this.doPush();
    try {
      await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
      if (this.pendingSync) {
        this.pendingSync = false;
        if (this.status === "DIRTY") {
          await this.flushSync();
        }
      }
    }
  }

  private async doPush(): Promise<void> {
    if (this.status === "CONFLICT_RESOLVING") {
      console.warn("doPush ignored: Conflict resolution in progress");
      return;
    }
    if (this.status !== "DIRTY" || this.data == null) {
      return;
    }

    this.status = "SYNCING";
    this.error = undefined;
    this.notify();

    try {
      const pushedPayload = this.buildPayload();
      const result = await this.config.onPush(pushedPayload);
      const localChangedDuringPush =
        this.data !== pushedPayload.data || this.lastModified !== pushedPayload.lastModified;
      if (localChangedDuringPush) {
        this.status = "DIRTY";
        this.scheduleSync();
      } else {
        this.applyPayload(result);
        this.status = "IDLE";
      }
    } catch (err) {
      if (err instanceof DraftConflictError) {
        await this.handleConflict(err);
        this.notify();
        return;
      }
      this.status = "ERROR";
      this.error = err instanceof Error ? err : new Error(String(err));
    }
    this.notify();
  }

  private async handleConflict(conflict: DraftConflictError<T>): Promise<void> {
    const { conflictStrategy } = this.config;
    const serverPayload = conflict.serverPayload;

    if (conflictStrategy === "REFETCH_REAPPLY") {
      await this.refetchAndReapplyLocal(conflict);
      return;
    }

    if (conflictStrategy === "SERVER_WINS") {
      this.applyPayload(serverPayload);
      this.status = "IDLE";
      this.notify();
      return;
    }

    if (conflictStrategy === "CLIENT_WINS") {
      try {
        const result = await this.config.onPush(this.buildPayload());
        this.applyPayload(result);
        this.status = "IDLE";
        this.notify();
      } catch (retryErr) {
        if (retryErr instanceof DraftConflictError) {
          await this.handleConflict(retryErr);
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
   * On 409: warn, re-fetch server state, overlay local edits, and schedule another push.
   */
  private async refetchAndReapplyLocal(conflict: DraftConflictError<T>): Promise<void> {
    const localPending = this.data;
    if (localPending == null) {
      this.applyPayload(conflict.serverPayload);
      this.status = "IDLE";
      this.error = undefined;
      return;
    }

    console.warn("Conflict detected, re-fetching latest...");
    this.status = "CONFLICT_RESOLVING";
    this.error = undefined;
    this.notify();
    try {
      await this.fetchAndHydrate({ forceApply: true });
      const serverData = this.data;
      if (this.config.merge != null && serverData != null) {
        this.data = this.config.merge(localPending, serverData);
      } else {
        this.data = localPending;
      }

      this.lastModified = Date.now();
      this.status = "DIRTY";
      this.error = undefined;
      this.notify();
      this.scheduleSync();
    } catch {
      this.applyPayload(conflict.serverPayload);
      this.error = undefined;
    } finally {
      if (this.status === "CONFLICT_RESOLVING") {
        this.status = "IDLE";
        this.notify();
      }
    }
  }
}
