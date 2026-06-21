import { normalizeLoginMobile } from "../identity/phone-login-authorization.ts";
import type { PlatformOpsUserRepository } from "./platform-ops-user.repository.ts";
import { readPlatformOpsPhones } from "./read-platform-ops-phones.ts";

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

/** DB role wins; empty PLATFORM_OPS_PHONES allows any phone as owner (dev). */
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

  const allowed = readPlatformOpsPhones();
  if (allowed.length === 0 || allowed.includes(normalized)) {
    return { role: "owner" };
  }
  return null;
}
