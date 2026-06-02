import { bffBrowserFetch } from "./inflight-bff-get";
import { decodeJwtPayload } from "./decode-jwt-payload";
import { SESSION_TOKEN_COOKIE } from "./session-cookie";
import { resolveTenantSlugFromHost } from "@/lib/tenant/runtime-tenant-context";

export { SESSION_TOKEN_COOKIE };

/**
 * Prefix for the Nest Bearer mirror in localStorage. Keys are scoped per workspace subdomain
 * (`tour_ops_session_token:{tenantSlug}`), per-user on loopback (`localhost_user_{sub}`), or `_default`
 * on apex hosts without a tenant subdomain label.
 */
export const SESSION_TOKEN_STORAGE_KEY_PREFIX = "tour_ops_session_token";

/** Unscoped legacy key (Phase 1). Migrated once into the active scope. */
export const LEGACY_SESSION_TOKEN_STORAGE_KEY = SESSION_TOKEN_STORAGE_KEY_PREFIX;

/** Fallback scope on apex domains when no tenant subdomain label is present. */
export const SESSION_TOKEN_STORAGE_DEFAULT_SCOPE = "_default";

/**
 * Same JWT string that is stored in the HttpOnly `session` cookie (Next origin). Because that cookie
 * is not sent to the Nest API on another origin, `apiClient` reads this copy from localStorage and
 * sends `Authorization: Bearer` to Nest (see `lib/api-client.ts`).
 *
 * localStorage is used (not sessionStorage) so the token survives full-page refreshes.
 * The HttpOnly cookie remains the authoritative route-protection signal in middleware.ts.
 *
 * Mirrors are partitioned by host subdomain scope so multiple workspace hosts cannot overwrite
 * each other's Bearer tokens; loopback hosts partition by JWT `sub` to avoid cross-user overwrites.
 */

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function loopbackUserScopeFromToken(tokenForScope?: string): string | null {
  const token = tokenForScope?.trim();
  if (!token) {
    return null;
  }
  const claims = decodeJwtPayload(token);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  if (!userId) {
    return null;
  }
  return `localhost_user_${userId}`;
}

/**
 * Resolves the localStorage partition from the active host subdomain and, on loopback hosts,
 * the JWT `sub` claim when a token is available.
 */
export function resolveSessionStorageScope(tokenForScope?: string): string {
  if (typeof window !== "undefined") {
    const slug = resolveTenantSlugFromHost(window.location.hostname);
    if (slug) {
      return slug.trim().toLowerCase();
    }
    if (isLoopbackHost(window.location.hostname)) {
      const userScope = loopbackUserScopeFromToken(tokenForScope);
      if (userScope) {
        return userScope;
      }
    }
  }
  return SESSION_TOKEN_STORAGE_DEFAULT_SCOPE;
}

export function buildSessionTokenStorageKey(scope?: string, tokenForScope?: string): string {
  const resolved = scope?.trim() || resolveSessionStorageScope(tokenForScope);
  return `${SESSION_TOKEN_STORAGE_KEY_PREFIX}:${resolved}`;
}

function isPartitionedSessionMirrorKey(key: string): boolean {
  return key.startsWith(`${SESSION_TOKEN_STORAGE_KEY_PREFIX}:`);
}

function removeAllPartitionedSessionMirrors(storage: Storage): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && isPartitionedSessionMirrorKey(key)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function readLoopbackUserPartitionToken(): string | null {
  const storage = readStorage();
  if (!storage || typeof window === "undefined" || !isLoopbackHost(window.location.hostname)) {
    return null;
  }
  const prefix = `${SESSION_TOKEN_STORAGE_KEY_PREFIX}:localhost_user_`;
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) {
      const token = storage.getItem(key)?.trim();
      if (token) {
        return token;
      }
    }
  }
  return null;
}

function readScopedToken(scope?: string, tokenForScope?: string): string | null {
  const storage = readStorage();
  if (!storage) {
    return null;
  }
  const tokenHint = tokenForScope?.trim() || readLoopbackUserPartitionToken() || undefined;
  const key = buildSessionTokenStorageKey(scope, tokenHint);
  const token = storage.getItem(key)?.trim();
  return token || null;
}

function removeLegacyGlobalMirror(storage: Storage): void {
  storage.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);
}

function migrateLoopbackDefaultToUserScope(storage: Storage, tokenForScope?: string): void {
  if (typeof window === "undefined" || !isLoopbackHost(window.location.hostname)) {
    return;
  }
  const userScope = loopbackUserScopeFromToken(tokenForScope);
  if (!userScope) {
    return;
  }
  const userKey = buildSessionTokenStorageKey(userScope);
  if (storage.getItem(userKey)?.trim()) {
    return;
  }
  const defaultKey = buildSessionTokenStorageKey(SESSION_TOKEN_STORAGE_DEFAULT_SCOPE);
  const legacyToken = storage.getItem(defaultKey)?.trim();
  if (!legacyToken) {
    return;
  }
  storage.setItem(userKey, legacyToken);
  storage.removeItem(defaultKey);
}

/** One-time Phase 1 migration: legacy mirror lived in sessionStorage / unscoped localStorage. */
function migrateLegacySessionStorageMirror(scope?: string, tokenForScope?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const storage = readStorage();
  if (!storage) {
    return;
  }
  migrateLoopbackDefaultToUserScope(storage, tokenForScope);
  const key = buildSessionTokenStorageKey(scope, tokenForScope);
  if (storage.getItem(key)?.trim()) {
    return;
  }
  const legacyLocal = storage.getItem(LEGACY_SESSION_TOKEN_STORAGE_KEY)?.trim();
  if (legacyLocal) {
    storage.setItem(key, legacyLocal);
    removeLegacyGlobalMirror(storage);
    return;
  }
  try {
    const legacySession = window.sessionStorage.getItem(LEGACY_SESSION_TOKEN_STORAGE_KEY)?.trim();
    if (legacySession) {
      storage.setItem(key, legacySession);
      window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);
      removeLegacyGlobalMirror(storage);
    }
  } catch {
    /* private mode */
  }
}

export function getStoredSessionToken(scope?: string, tokenForScope?: string): string | null {
  migrateLegacySessionStorageMirror(scope, tokenForScope);
  return readScopedToken(scope, tokenForScope);
}

/** Removes every Nest Bearer mirror partition and the legacy global key (no BFF cookie mutation). */
export function clearSessionStorageMirror(_scope?: string): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  removeAllPartitionedSessionMirrors(storage);
  removeLegacyGlobalMirror(storage);
}

/**
 * Clears the Bearer mirror and legacy global key immediately before a cross-host workspace
 * navigation so in-flight hydrates cannot republish a stale identity on the next origin.
 */
export function clearSessionStorageMirrorForHostNavigation(): void {
  clearSessionStorageMirror();
}

/**
 * Session bridge: copy JWT into localStorage when empty or unchanged skip.
 * Prefer {@link overwriteSessionTokenMirror} after BFF hydrate when the server token may differ.
 */
export function ensureSessionStorageSync(token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    return;
  }
  const storage = readStorage();
  if (!storage) {
    return;
  }
  migrateLegacySessionStorageMirror(undefined, normalized);
  const key = buildSessionTokenStorageKey(undefined, normalized);
  const existing = storage.getItem(key)?.trim();
  if (existing !== normalized) {
    storage.setItem(key, normalized);
    removeLegacyGlobalMirror(storage);
  }
}

/**
 * Forces the Nest Bearer mirror to match the HttpOnly cookie token from hydrate/login.
 * Call when `GET /api/auth/session` returns `session_token` to fix stale localStorage 401s.
 */
export function overwriteSessionTokenMirror(token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    return;
  }
  const storage = readStorage();
  if (!storage) {
    return;
  }
  migrateLegacySessionStorageMirror(undefined, normalized);
  const key = buildSessionTokenStorageKey(undefined, normalized);
  storage.setItem(key, normalized);
  removeLegacyGlobalMirror(storage);
}

export async function persistSessionToken(token: string): Promise<void> {
  const response = await bffBrowserFetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: token }),
  });
  void response;
  const storage = readStorage();
  if (storage) {
    const key = buildSessionTokenStorageKey(undefined, token);
    storage.setItem(key, token);
    removeLegacyGlobalMirror(storage);
  }
}

export async function clearSessionToken(): Promise<void> {
  await bffBrowserFetch("/api/auth/session", {
    method: "DELETE",
  });
  clearSessionStorageMirror();
}

/**
 * Clears the session cookie and navigates to `/login` unless already on a login route.
 * Used when the API returns 401 (expired or invalid token).
 */
export async function clearAuthAndRedirectToLogin(): Promise<void> {
  await clearSessionToken();
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/auth/login")) return;
  window.location.assign("/login");
}
