/**
 * MEG-001 — workspace engagement policy (levels, badges, award rules).
 * Denali V1 defaults; manifest-driven expansion in later revisions.
 */

export type EngagementLevelDefinition = {
  readonly code: string;
  readonly labelKey: string;
  readonly minPoints: number;
};

export type EngagementBadgeDefinition = {
  readonly code: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly trigger:
    | { readonly kind: "event"; readonly eventType: string }
    | { readonly kind: "points_threshold"; readonly minPoints: number };
};

export type EngagementAwardRule = {
  readonly eventType: string;
  readonly points: number;
  readonly sourceModule: string;
};

export const DEFAULT_ENGAGEMENT_LEVELS: readonly EngagementLevelDefinition[] = Object.freeze([
  { code: "base_camp", labelKey: "engagement.level.base_camp", minPoints: 0 },
  { code: "trail_member", labelKey: "engagement.level.trail_member", minPoints: 100 },
  { code: "summit_circle", labelKey: "engagement.level.summit_circle", minPoints: 250 },
]);

export const DEFAULT_ENGAGEMENT_BADGES: readonly EngagementBadgeDefinition[] = Object.freeze([
  {
    code: "trailhead_ready",
    labelKey: "engagement.badge.trailhead_ready.label",
    descriptionKey: "engagement.badge.trailhead_ready.description",
    trigger: { kind: "event", eventType: "profile.completed" },
  },
  {
    code: "first_expedition",
    labelKey: "engagement.badge.first_expedition.label",
    descriptionKey: "engagement.badge.first_expedition.description",
    trigger: { kind: "event", eventType: "registration.first_approved" },
  },
  {
    code: "summit_rookie",
    labelKey: "engagement.badge.summit_rookie.label",
    descriptionKey: "engagement.badge.summit_rookie.description",
    trigger: { kind: "points_threshold", minPoints: 100 },
  },
  {
    code: "ridge_partner",
    labelKey: "engagement.badge.ridge_partner.label",
    descriptionKey: "engagement.badge.ridge_partner.description",
    trigger: { kind: "points_threshold", minPoints: 250 },
  },
]);

export const DEFAULT_ENGAGEMENT_AWARD_RULES: readonly EngagementAwardRule[] = Object.freeze([
  {
    eventType: "profile.completed",
    points: 50,
    sourceModule: "identity",
  },
  {
    eventType: "registration.first_approved",
    points: 100,
    sourceModule: "booking",
  },
]);

export function resolveLevelForPoints(
  totalPoints: number,
  levels: readonly EngagementLevelDefinition[] = DEFAULT_ENGAGEMENT_LEVELS,
): EngagementLevelDefinition {
  let current = levels[0]!;
  for (const level of levels) {
    if (totalPoints >= level.minPoints) {
      current = level;
    }
  }
  return current;
}

export function resolveNextLevel(
  totalPoints: number,
  levels: readonly EngagementLevelDefinition[] = DEFAULT_ENGAGEMENT_LEVELS,
): EngagementLevelDefinition | null {
  const sorted = [...levels].sort((a, b) => a.minPoints - b.minPoints);
  for (const level of sorted) {
    if (level.minPoints > totalPoints) {
      return level;
    }
  }
  return null;
}
