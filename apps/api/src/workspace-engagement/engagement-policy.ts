/**
 * MEG-001 — workspace engagement policy (levels, badges, award rules).
 * Denali V1 defaults; manifest-driven expansion in later revisions.
 */

export type EngagementLevelDefinition = {
  readonly code: string;
  readonly labelKey: string;
  readonly titleI18n?: Readonly<{ readonly fa: string; readonly en: string }>;
  readonly minPoints: number;
};

export type EngagementBadgeDefinition = {
  readonly code: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly titleI18n?: Readonly<{ readonly fa: string; readonly en: string }>;
  readonly descriptionI18n?: Readonly<{ readonly fa: string; readonly en: string }>;
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
  {
    code: "base_camp",
    labelKey: "engagement.level.base_camp",
    titleI18n: { en: "Base camp", fa: "اردوگاه پایه" },
    minPoints: 0,
  },
  {
    code: "trail_member",
    labelKey: "engagement.level.trail_member",
    titleI18n: { en: "Trail member", fa: "عضو مسیر" },
    minPoints: 100,
  },
  {
    code: "summit_circle",
    labelKey: "engagement.level.summit_circle",
    titleI18n: { en: "Summit circle", fa: "حلقه قله" },
    minPoints: 250,
  },
]);

export const DEFAULT_ENGAGEMENT_BADGES: readonly EngagementBadgeDefinition[] = Object.freeze([
  {
    code: "trailhead_ready",
    labelKey: "engagement.badge.trailhead_ready.label",
    descriptionKey: "engagement.badge.trailhead_ready.description",
    titleI18n: { en: "Trailhead ready", fa: "آماده مسیر" },
    descriptionI18n: { en: "Complete your profile", fa: "تکمیل پروفایل" },
    trigger: { kind: "event", eventType: "profile.completed" },
  },
  {
    code: "first_expedition",
    labelKey: "engagement.badge.first_expedition.label",
    descriptionKey: "engagement.badge.first_expedition.description",
    titleI18n: { en: "First expedition", fa: "اولین اکسپدیشن" },
    descriptionI18n: { en: "First approved tour registration", fa: "تأیید اولین ثبت‌نام تور" },
    trigger: { kind: "event", eventType: "registration.first_approved" },
  },
  {
    code: "summit_rookie",
    labelKey: "engagement.badge.summit_rookie.label",
    descriptionKey: "engagement.badge.summit_rookie.description",
    titleI18n: { en: "Summit rookie", fa: "تازه‌کار قله" },
    descriptionI18n: { en: "Reach 100 points", fa: "رسیدن به ۱۰۰ امتیاز" },
    trigger: { kind: "points_threshold", minPoints: 100 },
  },
  {
    code: "ridge_partner",
    labelKey: "engagement.badge.ridge_partner.label",
    descriptionKey: "engagement.badge.ridge_partner.description",
    titleI18n: { en: "Ridge partner", fa: "هم‌مسیر یال" },
    descriptionI18n: { en: "Reach 250 points", fa: "رسیدن به ۲۵۰ امتیاز" },
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
