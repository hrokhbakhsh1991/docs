import {
  buildScopedStorageKey,
  createScopedSessionStorage,
  resolveStorageTenantId,
} from "@/lib/storage/scoped-storage";

const STORAGE_KEY_PREFIX = "tour-wizard-submit-idempotency-key";

/** In-memory fallback when sessionStorage is unavailable (SSR / unit tests). */
const memoryFallbackKeys = new Map<string, string>();

const WIZARD_STORAGE_NAMESPACE = "wizard";
const WIZARD_IDEMPOTENCY_LOGICAL_KEY = "submit-idempotency";

function scopedStorageKey(workspaceId?: string): string {
  const tenantId = resolveStorageTenantId({ workspaceId });
  return buildScopedStorageKey(WIZARD_STORAGE_NAMESPACE, tenantId, WIZARD_IDEMPOTENCY_LOGICAL_KEY);
}

function legacyStorageKey(workspaceId?: string): string {
  const scoped = workspaceId?.trim();
  return `${STORAGE_KEY_PREFIX}-${scoped && scoped !== "undefined" ? scoped : "global"}`;
}

function sessionForWorkspace(workspaceId?: string) {
  return createScopedSessionStorage(
    WIZARD_STORAGE_NAMESPACE,
    resolveStorageTenantId({ workspaceId }),
  );
}

function readStoredKey(workspaceId?: string): string | null {
  const storageKey = scopedStorageKey(workspaceId);
  const storage = sessionForWorkspace(workspaceId);
  const fromScoped = storage.getItem(WIZARD_IDEMPOTENCY_LOGICAL_KEY);
  if (fromScoped?.trim()) {
    return fromScoped.trim();
  }
  const legacy = storage.migrateLegacyItem(
    WIZARD_IDEMPOTENCY_LOGICAL_KEY,
    legacyStorageKey(workspaceId),
  );
  if (legacy?.trim()) {
    return legacy.trim();
  }
  return memoryFallbackKeys.get(storageKey) ?? null;
}

function writeStoredKey(key: string, workspaceId?: string): void {
  const storageKey = scopedStorageKey(workspaceId);
  memoryFallbackKeys.set(storageKey, key);
  sessionForWorkspace(workspaceId).setItem(WIZARD_IDEMPOTENCY_LOGICAL_KEY, key);
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
  sessionForWorkspace(workspaceId).removeItem(WIZARD_IDEMPOTENCY_LOGICAL_KEY);
}
