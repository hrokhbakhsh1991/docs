import { OPERATOR_WELCOME_ARMED_COOKIE } from "@/auth/operator-welcome-cookie";

const ARMED_KEY = "operator-welcome-armed";
const SHOWN_KEY = "operator-welcome-shown";
const PRESENTED_KEY = "operator-welcome-presented";

/** @deprecated Legacy permanent dismiss — cleared on login arm */
const LEGACY_STORAGE_PREFIX = "operator-welcome-dismissed";

function readSessionStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore private-mode / quota failures.
  }
}

function removeSessionStorage(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

/** Sync BFF login cookie into session — welcome shows once per login until dismiss. */
export function armOperatorWelcomeForLogin(): void {
  writeSessionStorage(ARMED_KEY, "1");
  removeSessionStorage(SHOWN_KEY);
  removeSessionStorage(PRESENTED_KEY);
  clearLegacyPermanentWelcomeDismiss();
}

/** BFF login sets a short-lived cookie — sync once when dashboard gate mounts. */
export function syncOperatorWelcomeFromLoginCookie(): void {
  if (typeof document === "undefined") {
    return;
  }
  const pattern = new RegExp(`(?:^|; )${OPERATOR_WELCOME_ARMED_COOKIE}=([^;]*)`);
  const match = document.cookie.match(pattern);
  if (decodeURIComponent(match?.[1] ?? "") !== "1") {
    return;
  }
  armOperatorWelcomeForLogin();
  clearOperatorWelcomeArmedCookieClient();
}

export function clearOperatorWelcomeSession(): void {
  removeSessionStorage(ARMED_KEY);
  removeSessionStorage(SHOWN_KEY);
  removeSessionStorage(PRESENTED_KEY);
  clearOperatorWelcomeArmedCookieClient();
}

function clearOperatorWelcomeArmedCookieClient(): void {
  if (typeof document === "undefined") {
    return;
  }
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = [
    `${OPERATOR_WELCOME_ARMED_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function isOperatorWelcomeArmedForLogin(): boolean {
  return readSessionStorage(ARMED_KEY) === "1";
}

export function isOperatorWelcomeShownThisLogin(): boolean {
  return readSessionStorage(SHOWN_KEY) === "1";
}

export function isOperatorWelcomePresentedThisLogin(): boolean {
  return readSessionStorage(PRESENTED_KEY) === "1";
}

export function markOperatorWelcomePresentedThisLogin(): void {
  writeSessionStorage(PRESENTED_KEY, "1");
}

export function markOperatorWelcomeShownThisLogin(): void {
  writeSessionStorage(SHOWN_KEY, "1");
  removeSessionStorage(ARMED_KEY);
  removeSessionStorage(PRESENTED_KEY);
}

function clearLegacyPermanentWelcomeDismiss(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${LEGACY_STORAGE_PREFIX}:`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
}
