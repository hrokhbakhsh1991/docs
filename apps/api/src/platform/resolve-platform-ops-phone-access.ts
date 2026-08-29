import { normalizeLoginMobile } from "../identity/phone-login-authorization.ts";
import type { PlatformOpsUserRepository } from "./platform-ops-user.repository.ts";
import { readPlatformOpsPhones } from "./read-platform-ops-phones.ts";
import { requiresProductionGradeIntegrity } from "../server/runtime-profile.ts";

export type PlatformOpsRole = "owner" | "admin" | "support";

async function resolveRepository(
  repository?: PlatformOpsUserRepository
): Promise<PlatformOpsUserRepository> {
  if (repository) return repository;
  const { PlatformOpsUserRepository: Repository } = await import("./platform-ops-user.repository.ts");
  return new Repository();
}

export function normalizePlatformOpsRole(role: string): PlatformOpsRole {
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin" || normalized === "support") {
    return normalized;
  }
  return "owner";
}

/**
 * DB role wins.
 * Empty PLATFORM_OPS_PHONES: fail-closed under production/prodlike; owner fallback only in test/dev (TODO-004).
 */
export async function resolvePlatformOpsPhoneAccess(
  phone: string,
  deps: { repository?: PlatformOpsUserRepository } = {}
): Promise<{ readonly role: PlatformOpsRole } | null> {
  const normalized = normalizeLoginMobile(phone);
  if (normalized.length === 0) {
    return null;
  }

  const repository = await resolveRepository(deps.repository);
  try {
    const dbUser = await repository.findByPhone(normalized);
    if (dbUser) {
      return { role: normalizePlatformOpsRole(dbUser.role) };
    }
  } catch {
    // fall through to env whitelist
  }

  const allowed = readPlatformOpsPhones().map((entry) => normalizeLoginMobile(entry));
  if (allowed.length === 0) {
    if (requiresProductionGradeIntegrity()) {
      return null;
    }
    return { role: "owner" };
  }
  if (allowed.includes(normalized)) {
    return { role: "owner" };
  }
  return null;
}
