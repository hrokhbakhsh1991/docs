const STORAGE_KEY_PREFIX = "tour-wizard-submit-idempotency-key";

/** In-memory fallback when sessionStorage is unavailable (SSR / unit tests). */
const memoryFallbackKeys = new Map<string, string>();

function resolveScope(workspaceId?: string): string {
  const scoped = workspaceId?.trim();
  return scoped && scoped !== "undefined" ? scoped : "global";
}

function scopedStorageKey(workspaceId?: string): string {
  return `${STORAGE_KEY_PREFIX}-${resolveScope(workspaceId)}`;
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage;
    }
    const g = globalThis as typeof globalThis & { window?: { sessionStorage?: Storage } };
    if (g.window?.sessionStorage) {
      return g.window.sessionStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function readStoredKey(workspaceId?: string): string | null {
  const storageKey = scopedStorageKey(workspaceId);
  const storage = getSessionStorage();
  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw && raw.trim() !== "") {
        return raw.trim();
      }
    } catch {
      // fall through to memory
    }
  }
  return memoryFallbackKeys.get(storageKey) ?? null;
}

function writeStoredKey(key: string, workspaceId?: string): void {
  const storageKey = scopedStorageKey(workspaceId);
  memoryFallbackKeys.set(storageKey, key);
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(storageKey, key);
  } catch {
    // ignore quota / private mode
  }
}

function mintKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Stable Idempotency-Key for one wizard create attempt until {@link clearWizardSubmitIdempotencyKey}.
 * map-phase P1.2-a
 */
export function getWizardSubmitIdempotencyKey(workspaceId?: string): string {
  const existing = readStoredKey(workspaceId);
  if (existing) {
    return existing;
  }
  const next = mintKey();
  writeStoredKey(next, workspaceId);
  return next;
}

/** Call after successful tour create so the next tour gets a fresh key. */
export function clearWizardSubmitIdempotencyKey(workspaceId?: string): void {
  const storageKey = scopedStorageKey(workspaceId);
  memoryFallbackKeys.delete(storageKey);
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(storageKey);
  } catch {
    // ignore
  }
}
