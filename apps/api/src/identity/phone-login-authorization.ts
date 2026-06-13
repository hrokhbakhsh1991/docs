import { canonicalizeLoginMobile } from "./canonicalize-login-mobile";
import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";
import { findPendingInviteByPhone } from "./resolve-pending-invite-auth";

const MIN_MOBILE_DIGITS = 8;

export function normalizeLoginMobile(mobile: string): string {
  return canonicalizeLoginMobile(mobile);
}

export function isLoginMobileFormatValid(mobile: string): boolean {
  const normalized = normalizeLoginMobile(mobile);
  if (normalized.length === 0) {
    return false;
  }
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= MIN_MOBILE_DIGITS;
}

export async function isPhoneAuthorizedForTenantLogin(
  tenantId: string,
  mobile: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<boolean> {
  const normalized = normalizeLoginMobile(mobile);
  const user = await repo.findUserByMobile(normalized);
  if (user === null) {
    const pendingInvite = await findPendingInviteByPhone(tenantId, normalized, repo);
    return pendingInvite !== null;
  }

  const membership = await repo.findMembership(user.id, tenantId);
  if (membership !== null && membership.status === "ACTIVE") {
    return true;
  }

  const pendingInvite = await findPendingInviteByPhone(tenantId, normalized, repo);
  return pendingInvite !== null;
}
