import { ForbiddenException } from "@nestjs/common";
import {
  normalizeProductCapabilityId,
  tryParseWorkspaceRole,
  WorkspaceRole,
} from "@repo/shared";

export function jwtCapsIncludeCapability(
  jwtCaps: readonly string[] | undefined,
  requiredRaw: string,
): boolean {
  const normalized = normalizeProductCapabilityId(requiredRaw);
  if (!normalized) {
    return false;
  }
  if (!jwtCaps?.length) {
    return false;
  }
  for (const raw of jwtCaps) {
    const cap = raw.trim();
    if (!cap) {
      continue;
    }
    if (cap === normalized || cap === requiredRaw.trim()) {
      return true;
    }
    if (normalizeProductCapabilityId(cap) === normalized) {
      return true;
    }
  }
  return false;
}

/**
 * Fast JWT `caps` gate for {@link RequireCapability} routes (Phase 16).
 * DB/ALS verification remains in {@link assertRequireCapabilitiesForExecutionContext}.
 */
export function assertJwtCapsSatisfyRequireCapability(
  required: readonly string[],
  jwtCaps: readonly string[] | undefined,
  role: string | undefined,
): void {
  const unique = [...new Set(required.filter((c) => typeof c === "string" && c.trim() !== ""))];
  if (unique.length === 0) {
    return;
  }

  const parsedRole = tryParseWorkspaceRole(role);
  if (parsedRole === WorkspaceRole.Owner || parsedRole === WorkspaceRole.Admin) {
    return;
  }

  for (const raw of unique) {
    const normalized = normalizeProductCapabilityId(raw);
    if (!normalized) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_CAPABILITY",
          message: `Unknown or unsupported capability: ${raw}`,
          capability: raw,
        },
      });
    }
    if (!jwtCapsIncludeCapability(jwtCaps, raw)) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_CAPABILITY",
          message: `Insufficient capability: ${raw}`,
          capability: raw,
        },
      });
    }
  }
}
