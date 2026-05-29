import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";

import { SESSION_TOKEN_COOKIE } from "./session-cookie";
import {
  validateSessionToken,
  type SessionTokenValidation,
} from "./validate-session-token";

function decodeCookieValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/** All `session` values from a raw `Cookie` request header (duplicate cookies allowed). */
export function extractAllSessionTokensFromCookieHeader(
  cookieHeader: string | null,
): string[] {
  if (!cookieHeader?.trim()) {
    return [];
  }
  const pattern = new RegExp(`(?:^|;\\s*)${SESSION_TOKEN_COOKIE}=([^;]+)`, "g");
  const tokens: string[] = [];
  for (const match of cookieHeader.matchAll(pattern)) {
    const raw = match[1];
    if (raw) {
      const decoded = decodeCookieValue(raw);
      if (decoded) {
        tokens.push(decoded);
      }
    }
  }
  return tokens;
}

/** Prefer a non-expired JWT when the browser sends duplicate `session` cookies. */
export function pickSessionTokenFromValues(
  values: Iterable<string | undefined | null>,
): { token: string; validation: SessionTokenValidation } | null {
  const tokens: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      tokens.push(value.trim());
    }
  }
  if (tokens.length === 0) {
    return null;
  }

  let firstInvalid: { token: string; validation: SessionTokenValidation } | null = null;
  for (const token of tokens) {
    const validation = validateSessionToken(token);
    if (validation.status === "valid") {
      return { token, validation };
    }
    if (!firstInvalid) {
      firstInvalid = { token, validation };
    }
  }

  return firstInvalid;
}

export function pickSessionTokenFromRequestCookies(
  jar: Pick<RequestCookies, "get" | "getAll">,
): { token: string; validation: SessionTokenValidation } | null {
  const all = jar.getAll(SESSION_TOKEN_COOKIE);
  if (all.length > 0) {
    return pickSessionTokenFromValues(all.map((c) => c.value));
  }
  return pickSessionTokenFromValues([jar.get(SESSION_TOKEN_COOKIE)?.value]);
}
