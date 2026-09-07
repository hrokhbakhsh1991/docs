import type { Prisma } from "@prisma/client";

import { getIdentityRepository } from "../identity/create-identity-repository";
import type {
  IdentityMembershipRecord,
  IdentityUserRecord,
} from "../identity/in-memory-identity.repository";

const LEADER_ELIGIBILITY_REWARD_LABELS = new Set([
  "admin",
  "leader",
  "لیدر",
  "راهنما",
]);

export class TourExecutionInvalidLeaderError extends Error {
  constructor() {
    super("TOUR_EXECUTION_INVALID_LEADER");
  }
}

export function isEligibleTourLeaderCandidate(input: {
  readonly role: string;
  readonly status: string;
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
}): boolean {
  if (input.status !== "ACTIVE") {
    return false;
  }
  if (input.role === "admin" || input.role === "owner") {
    return true;
  }
  if (input.isSelectableLeader === true) {
    return true;
  }
  for (const label of input.labels ?? []) {
    if (LEADER_ELIGIBILITY_REWARD_LABELS.has(label.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

export async function assertEligibleTourLeaderUser(
  tenantId: string,
  tourLeaderUserId: string,
): Promise<void> {
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(tourLeaderUserId, tenantId);
  if (membership === null) {
    throw new TourExecutionInvalidLeaderError();
  }
  const user = await repo.findUserById(tourLeaderUserId);
  if (user === null) {
    throw new TourExecutionInvalidLeaderError();
  }
  const rewards = membership.rewards;
  if (
    !isEligibleTourLeaderCandidate({
      role: membership.role,
      status: membership.status,
      isSelectableLeader: rewards?.isSelectableLeader,
      labels: rewards?.labels,
    })
  ) {
    throw new TourExecutionInvalidLeaderError();
  }
}

export async function resolveTourLeaderPublicDisplayName(
  tenantId: string,
  tourLeaderUserId: string | null | undefined,
): Promise<string | null> {
  if (tourLeaderUserId === null || tourLeaderUserId === undefined || tourLeaderUserId.trim().length === 0) {
    return null;
  }
  const repo = getIdentityRepository();
  const [user, membership] = await Promise.all([
    repo.findUserById(tourLeaderUserId),
    repo.findMembership(tourLeaderUserId, tenantId),
  ]);
  if (user === null || membership === null || membership.status !== "ACTIVE") {
    return null;
  }
  return resolvePublicDisplayName(user, membership);
}

function resolvePublicDisplayName(
  user: IdentityUserRecord,
  membership: IdentityMembershipRecord,
): string {
  const profileName = membership.displayName?.trim();
  if (profileName !== undefined && profileName.length > 0) {
    return profileName;
  }
  return user.mobile;
}

/** Prisma select shape for export contact — guest phone/email only, no member user ids. */
export type ManifestExportRegistrationContact = {
  readonly guestPhone: string | null;
  readonly guestEmail: string | null;
};

export function resolveManifestExportContact(
  registration: ManifestExportRegistrationContact,
): string {
  const phone = registration.guestPhone?.trim();
  if (phone !== undefined && phone.length > 0) {
    return phone;
  }
  const email = registration.guestEmail?.trim();
  if (email !== undefined && email.length > 0) {
    return email;
  }
  return "";
}
