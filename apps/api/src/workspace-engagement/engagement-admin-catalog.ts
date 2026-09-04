/**
 * MEG-001 — operator-managed engagement catalog constraints.
 */

export const ENGAGEMENT_BADGE_ICON_KEYS = Object.freeze([
  "mountain",
  "flag",
  "compass",
  "tent",
  "star",
  "medal",
  "summit",
  "trail",
] as const);

export type EngagementBadgeIconKey = (typeof ENGAGEMENT_BADGE_ICON_KEYS)[number];

export const ENGAGEMENT_SUPPORTED_AWARD_EVENTS = Object.freeze([
  {
    eventType: "profile.completed",
    sourceModule: "identity",
    labelKey: "engagement.eventTypes.profile_completed",
  },
  {
    eventType: "registration.first_approved",
    sourceModule: "booking",
    labelKey: "engagement.eventTypes.registration_first_approved",
  },
] as const);

export const ENGAGEMENT_FORBIDDEN_AWARD_EVENT_PREFIXES = Object.freeze([
  "wallet.",
  "payment.",
  "finance.",
  "ledger.",
  "money.",
] as const);

export const ENGAGEMENT_OPERATOR_ONLY_EVENT_TYPES = Object.freeze([
  "engagement.points.manual_adjustment",
  "engagement.points.reversed",
] as const);

export type EngagementDefinitionStatus = "active" | "inactive" | "archived";

export type EngagementDedupePolicy = "per_user" | "per_entity";

export function isApprovedBadgeIconKey(value: string): value is EngagementBadgeIconKey {
  return (ENGAGEMENT_BADGE_ICON_KEYS as readonly string[]).includes(value);
}

export function isSupportedAwardEventType(eventType: string): boolean {
  if ((ENGAGEMENT_OPERATOR_ONLY_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return false;
  }
  const lower = eventType.trim().toLowerCase();
  for (const prefix of ENGAGEMENT_FORBIDDEN_AWARD_EVENT_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return false;
    }
  }
  return ENGAGEMENT_SUPPORTED_AWARD_EVENTS.some((entry) => entry.eventType === eventType);
}

export function resolveSupportedSourceModule(eventType: string): string | undefined {
  return ENGAGEMENT_SUPPORTED_AWARD_EVENTS.find((entry) => entry.eventType === eventType)?.sourceModule;
}

export function buildAwardDedupeKey(
  policy: EngagementDedupePolicy,
  eventType: string,
  userId: string,
  sourceEntityId?: string | null,
): string {
  if (policy === "per_entity" && sourceEntityId !== undefined && sourceEntityId !== null) {
    return `engagement:${eventType}:${sourceEntityId}`;
  }
  return `engagement:${eventType}:${userId}`;
}
