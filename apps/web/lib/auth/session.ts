import { SESSION_TOKEN_COOKIE } from "./session-cookie";

export { SESSION_TOKEN_COOKIE };

/**
 * Same JWT string that is stored in the HttpOnly `session` cookie (Next origin). Because that cookie
 * is not sent to the Nest API on another origin, `apiClient` reads this copy from sessionStorage and
 * sends `Authorization: Bearer` to Nest (see `lib/api-client.ts`).
 */
const SESSION_TOKEN_STORAGE_KEY = "tour_ops_session_token";

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getStoredSessionToken(): string | null {
  const storage = readStorage();
  if (!storage) {
    return null;
  }
  const token = storage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim();
  return token || null;
}

export async function persistSessionToken(token: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: token })
  });
  void response;
  const storage = readStorage();
  if (storage) {
    storage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  }
}

export async function clearSessionToken(): Promise<void> {
  const stack =
    typeof Error === "function" ? new Error("clearSessionToken").stack?.split("\n").slice(1, 5) : undefined;
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "770f2e"
    },
    body: JSON.stringify({
      sessionId: "770f2e",
      runId: "initial",
      hypothesisId: "H6",
      location: "lib/auth/session.ts:42",
      message: "clear_session_token_called",
      data: { caller_stack: stack ?? [] },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "include"
  });
  const storage = readStorage();
  if (storage) {
    storage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  }
}

/**
 * Clears the session cookie and navigates to `/login` unless already on a login route.
 * Used when the API returns 401 (expired or invalid token).
 */
export async function clearAuthAndRedirectToLogin(): Promise<void> {
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "770f2e"
    },
    body: JSON.stringify({
      sessionId: "770f2e",
      runId: "initial",
      hypothesisId: "H6",
      location: "lib/auth/session.ts:57",
      message: "clear_auth_and_redirect_called",
      data: {
        has_window: typeof window !== "undefined"
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  await clearSessionToken();
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/auth/login")) return;
  window.location.assign("/login");
}
