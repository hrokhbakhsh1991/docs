import { decodeJwtPayload, isJwtExpired } from "@app-tour/session-client";

import type { PlatformOpsSessionPayload } from "./build-platform-session-cookie";

export type PlatformSessionValidation =
  | { status: "valid"; session: PlatformOpsSessionPayload }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "invalid_claims" };

function normalizePlatformRole(
  role: string | undefined
): PlatformOpsSessionPayload["role"] | null {
  if (role === "owner" || role === "admin" || role === "support") {
    return role;
  }
  return null;
}

export function validatePlatformSessionToken(
  raw: string | undefined | null
): PlatformSessionValidation {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (token.length === 0) {
    return { status: "missing" };
  }

  if (token.startsWith("{") || token.startsWith("%7B")) {
    return { status: "invalid_claims" };
  }

  const claims = decodeJwtPayload(token);
  if (isJwtExpired(claims)) {
    return { status: "expired" };
  }

  const kind = (claims as { kind?: string } | null)?.kind;
  if (kind !== "platform_ops") {
    return { status: "invalid_claims" };
  }

  const phone = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const platformRoleRaw =
    typeof (claims as { platform_role?: string } | null)?.platform_role === "string"
      ? (claims as { platform_role: string }).platform_role.trim()
      : "";
  const role = normalizePlatformRole(platformRoleRaw);
  if (phone.length === 0 || role === null) {
    return { status: "invalid_claims" };
  }

  return { status: "valid", session: { phone, role } };
}

/** @deprecated Legacy JSON cookies — use validatePlatformSessionToken. */
export function parsePlatformSession(raw: string | undefined): PlatformOpsSessionPayload | null {
  const validated = validatePlatformSessionToken(raw);
  return validated.status === "valid" ? validated.session : null;
}
