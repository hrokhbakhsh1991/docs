import { bffBrowserFetch } from "./inflight-bff-get";
import { SESSION_TOKEN_COOKIE } from "./session-cookie";

export { SESSION_TOKEN_COOKIE };

/**
 * Same JWT string that is stored in the HttpOnly `session` cookie (Next origin). Because that cookie
 * is not sent to the Nest API on another origin, `apiClient` reads this copy from localStorage and
 * sends `Authorization: Bearer` to Nest (see `lib/api-client.ts`).
 *
 * localStorage is used (not sessionStorage) so the token survives full-page refreshes.
 * The HttpOnly cookie remains the authoritative route-protection signal in middleware.ts.
 */
const SESSION_TOKEN_STORAGE_KEY = "tour_ops_session_token";

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

/** One-time Phase 1 migration: legacy mirror lived in sessionStorage. */
function migrateLegacySessionStorageMirror(): void {
  if (typeof window === "undefined") {
    return;
  }
  const storage = readStorage();
  if (!storage) {
    return;
  }
  if (storage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim()) {
    return;
  }
  try {
    const legacy = window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim();
    if (legacy) {
      storage.setItem(SESSION_TOKEN_STORAGE_KEY, legacy);
      window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    /* private mode */
  }
}

export function getStoredSessionToken(): string | null {
  migrateLegacySessionStorageMirror();
  const storage = readStorage();
  if (!storage) {
    return null;
  }
  const token = storage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim();
  return token || null;
}

/** Removes the Nest Bearer mirror from localStorage only (no BFF cookie mutation). */
export function clearSessionStorageMirror(): void {
  const storage = readStorage();
  if (storage) {
    storage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  }
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
  migrateLegacySessionStorageMirror();
  const existing = storage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim();
  if (existing !== normalized) {
    storage.setItem(SESSION_TOKEN_STORAGE_KEY, normalized);
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
  migrateLegacySessionStorageMirror();
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, normalized);
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
    // Write to localStorage so the Bearer token survives full-page refreshes.
    storage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
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
