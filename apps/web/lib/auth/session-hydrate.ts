/* eslint-disable no-console -- dev-only auth hydrate warnings */
import { decodeJwtPayload } from "./decode-jwt-payload";
import {
  clearSessionStorageMirror,
  getStoredSessionToken,
  overwriteSessionTokenMirror,
} from "./session";

export type SessionHydrateUser = {
  userId: string;
  tenantId: string;
  role?: string;
};

export type SessionHydrateWire = {
  authenticated?: boolean;
  user?: SessionHydrateUser;
  user_id?: string;
  tenant_id?: string;
  session_token?: string;
  decoded?: { payload?: { role?: unknown } };
};

/** Server explicitly reported no valid session (BFF `authenticated: false`). */
export function isServerUnauthenticatedPayload(payload: SessionHydrateWire): boolean {
  return payload.authenticated !== true;
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  if (name === "AbortError") {
    return true;
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return code === "ABORT_ERR" || code === "ERR_CANCELED";
}

/** Transient client/network failure — do not treat as logged out or clear cookies. */
export function isSessionHydrateFetchFailure(error: unknown): boolean {
  if (isAbortError(error)) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return error instanceof Error && error.message.toLowerCase().includes("fetch");
}

export function warnSessionHydrate(message: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (detail !== undefined) {
    console.warn(`[AuthProvider] ${message}`, detail);
  } else {
    console.warn(`[AuthProvider] ${message}`);
  }
}

/** Logged when the 8s hydrate budget fires — session cookie is left intact. */
export function warnAuthHydrateTimeout(detail?: unknown): void {
  const message = "Auth hydration timed out, keeping previous session state.";
  if (detail !== undefined) {
    console.warn(`[AuthProvider] ${message}`, detail);
  } else {
    console.warn(`[AuthProvider] ${message}`);
  }
}

/**
 * Applies a successful session hydrate body.
 * @returns user when authenticated payload is valid; `null` when server said unauthenticated.
 */
export function applySessionHydratePayload(payload: SessionHydrateWire): SessionHydrateUser | null {
  if (isServerUnauthenticatedPayload(payload)) {
    clearSessionStorageMirror();
    return null;
  }

  const userId =
    payload.user?.userId?.trim() ||
    (typeof payload.user_id === "string" ? payload.user_id.trim() : "");
  const tenantId =
    payload.user?.tenantId?.trim() ||
    (typeof payload.tenant_id === "string" ? payload.tenant_id.trim() : "");
  const tokenForClaims =
    typeof payload.session_token === "string" ? payload.session_token.trim() : "";

  if (tokenForClaims) {
    const storedMirror = getStoredSessionToken();
    if (storedMirror !== tokenForClaims) {
      overwriteSessionTokenMirror(tokenForClaims);
    }
  }

  const roleFromJwt =
    tokenForClaims !== "" ? decodeJwtPayload(tokenForClaims)?.role : undefined;
  const role =
    payload.user?.role ||
    (typeof payload.decoded?.payload?.role === "string"
      ? payload.decoded.payload.role.trim()
      : undefined) ||
    (typeof roleFromJwt === "string" ? roleFromJwt.trim() : undefined);

  if (!userId || !tenantId) {
    warnSessionHydrate("session hydrate returned authenticated without user/tenant ids");
    return null;
  }

  return { userId, tenantId, role };
}
