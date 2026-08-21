import {
  decodeJwtPayload,
  isJwtExpired,
  isJwtVerifyConfigured,
  verifySessionJwtSignature,
} from "@app-tour/session-client";

import type { PlatformOpsSessionPayload } from "./platform-session-types";

export type PlatformSessionValidation =
  | { status: "valid"; session: PlatformOpsSessionPayload }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "invalid_claims" }
  | { status: "invalid_signature" };

function normalizePlatformRole(
  role: string | undefined
): PlatformOpsSessionPayload["role"] | null {
  if (role === "owner" || role === "admin" || role === "support") {
    return role;
  }
  return null;
}

export async function validatePlatformSessionToken(
  raw: string | undefined | null
): Promise<PlatformSessionValidation> {
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

  // Platform BFF credentials may only be minted from a signed browser session.
  if (!isJwtVerifyConfigured() || !(await verifySessionJwtSignature(token))) {
    return { status: "invalid_signature" };
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
export async function parsePlatformSession(raw: string | undefined): Promise<PlatformOpsSessionPayload | null> {
  const validated = await validatePlatformSessionToken(raw);
  return validated.status === "valid" ? validated.session : null;
}
