import Cookies from "js-cookie";

import { SESSION_TOKEN_COOKIE } from "./session-cookie";

export { SESSION_TOKEN_COOKIE };

export function getSessionToken(): string | undefined {
  return Cookies.get(SESSION_TOKEN_COOKIE);
}

export function setSessionToken(token: string): void {
  Cookies.set(SESSION_TOKEN_COOKIE, token, {
    path: "/",
    sameSite: "strict",
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  });
}

export function clearSessionToken(): void {
  Cookies.remove(SESSION_TOKEN_COOKIE, { path: "/" });
}

/**
 * Clears the session cookie and navigates to `/login` unless already on a login route.
 * Used when the API returns 401 (expired or invalid token).
 */
export function clearAuthAndRedirectToLogin(): void {
  clearSessionToken();
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/auth/login")) return;
  window.location.assign("/login");
}
