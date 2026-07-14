/** DL-12 subset — allowlisted relative portalReturn only (no open redirect). */
export function isSafePortalReturnPath(value: string | undefined | null): value is string {
  if (value === undefined || value === null) {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}

const DEFAULT_MEMBER_LOGIN_EGRESS_PATH = "/me/registrations";

/** True when URL is member login (portal /login or legacy portalReturn on register). */
export function isMemberLoginEgressFromLocation(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (pathname === "/login") {
    return true;
  }
  return readPortalReturnFromLocation() !== null;
}

/** DL-12 subset — allowlisted relative portalReturn only (no open redirect). */
export function readPortalReturnFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = new URLSearchParams(window.location.search).get("portalReturn");
  return isSafePortalReturnPath(value) ? value.trim() : null;
}

function readPortalReturnFromDocument(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const element =
    document.querySelector("main[data-portal-return]") ??
    document.querySelector("[data-portal-return]");
  const value = element?.getAttribute("data-portal-return");
  return isSafePortalReturnPath(value) ? value.trim() : null;
}

/** Resolve post-login redirect target: query → SSR data attribute → fallback. */
export function resolveMemberLoginEgressPath(fallbackPath?: string): string {
  const fromQuery = readPortalReturnFromLocation();
  if (fromQuery !== null) {
    return fromQuery;
  }
  const fromDocument = readPortalReturnFromDocument();
  if (fromDocument !== null) {
    return fromDocument;
  }
  if (isSafePortalReturnPath(fallbackPath)) {
    return fallbackPath.trim();
  }
  return DEFAULT_MEMBER_LOGIN_EGRESS_PATH;
}

export type CompleteMemberLoginEgressOptions = {
  readonly fallbackPath?: string;
};

/** Redirect after member login auth on login egress; returns true when navigation started. */
export function completeMemberLoginEgress(options?: CompleteMemberLoginEgressOptions): boolean {
  if (!isMemberLoginEgressFromLocation()) {
    return false;
  }
  window.location.assign(resolveMemberLoginEgressPath(options?.fallbackPath));
  return true;
}

/** Redirect to portalReturn query when present; returns true when navigation started. */
export function completeMemberLoginEgressIfPresent(): boolean {
  const portalReturn = readPortalReturnFromLocation();
  if (portalReturn === null) {
    return false;
  }
  window.location.assign(portalReturn);
  return true;
}
