import { parseMembershipMetadata, type MembershipMetadata } from "./membership-metadata";
import { tryParseWorkspaceRole, WorkspaceRole } from "./workspace-roles";

/**
 * Membership metadata capability tokens that do NOT map to CASL / dashboard gates.
 * They annotate the membership row for product-specific selectors (e.g. tour leader pickers).
 */
export const SELECTABLE_LEADER_CAPABILITY = "capability.is_selectable_leader" as const;

export const MEMBERSHIP_MICRO_CAPABILITIES = [SELECTABLE_LEADER_CAPABILITY] as const;

export type MembershipMicroCapability = (typeof MEMBERSHIP_MICRO_CAPABILITIES)[number];

export function isMembershipMicroCapability(raw: string): boolean {
  const key = raw.trim();
  return (MEMBERSHIP_MICRO_CAPABILITIES as readonly string[]).includes(key);
}

export function partitionMembershipCapabilityTokens(
  capabilities: readonly string[] | null | undefined,
): { micro: string[]; product: string[] } {
  const micro: string[] = [];
  const product: string[] = [];
  for (const raw of capabilities ?? []) {
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    if (isMembershipMicroCapability(trimmed)) {
      if (!micro.includes(trimmed)) {
        micro.push(trimmed);
      }
    } else {
      if (!product.includes(trimmed)) {
        product.push(trimmed);
      }
    }
  }
  return { micro, product };
}

const TOUR_CREW_ELIGIBLE_ROLES = new Set<WorkspaceRole>([
  WorkspaceRole.Owner,
  WorkspaceRole.Admin,
  WorkspaceRole.Leader,
]);

/**
 * Whether an ACTIVE workspace membership may appear in tour `leaderUserIds` pickers
 * (owner / admin / leader roles, or explicit `capability.is_selectable_leader`).
 */
export function isEligibleTourLeaderMembership(
  role: string,
  membershipMetadata: MembershipMetadata | Record<string, unknown> | null | undefined,
): boolean {
  const parsed = tryParseWorkspaceRole(role);
  if (parsed && TOUR_CREW_ELIGIBLE_ROLES.has(parsed)) {
    return true;
  }
  return membershipHasSelectableLeader(membershipMetadata);
}

export function membershipHasSelectableLeader(
  metadata: MembershipMetadata | Record<string, unknown> | null | undefined,
): boolean {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? parseMembershipMetadata(metadata)
      : parseMembershipMetadata(metadata);
  return (meta.capabilities ?? []).includes(SELECTABLE_LEADER_CAPABILITY);
}

export function mergeMembershipMicroCapabilities(
  existing: readonly string[] | null | undefined,
  micro: readonly string[],
): string[] {
  const { micro: preserved, product } = partitionMembershipCapabilityTokens(existing);
  const nextMicro = new Set<string>([...preserved, ...micro.filter(isMembershipMicroCapability)]);
  return [...nextMicro, ...product];
}

export function setSelectableLeaderCapability(
  existingCapabilities: readonly string[] | null | undefined,
  enabled: boolean,
): string[] {
  const { micro, product } = partitionMembershipCapabilityTokens(existingCapabilities);
  const nextMicro = new Set(micro);
  if (enabled) {
    nextMicro.add(SELECTABLE_LEADER_CAPABILITY);
  } else {
    nextMicro.delete(SELECTABLE_LEADER_CAPABILITY);
  }
  return [...nextMicro, ...product];
}
