const STORAGE_KEY = "tour-wizard-submit-idempotency-key";

/** In-memory fallback when sessionStorage is unavailable (SSR / unit tests). */
let memoryFallbackKey: string | null = null;

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

function readStoredKey(): string | null {
  const storage = getSessionStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw && raw.trim() !== "") {
        return raw.trim();
      }
    } catch {
      // fall through to memory
    }
  }
  return memoryFallbackKey;
}

function writeStoredKey(key: string): void {
  memoryFallbackKey = key;
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, key);
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
export function getWizardSubmitIdempotencyKey(): string {
  const existing = readStoredKey();
  if (existing) {
    return existing;
  }
  const next = mintKey();
  writeStoredKey(next);
  return next;
}

/** Call after successful tour create so the next tour gets a fresh key. */
export function clearWizardSubmitIdempotencyKey(): void {
  memoryFallbackKey = null;
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
