export const ENGAGEMENT_LEVEL_THRESHOLDS: Readonly<Record<string, number>> = Object.freeze({
  base_camp: 0,
  trail_member: 100,
  summit_circle: 250,
});

export const ENGAGEMENT_OPS_TEST_IDS = Object.freeze({
  page: "operator-engagement-page",
  recentPoints: "operator-engagement-recent-points",
  recentBadges: "operator-engagement-recent-badges",
  memberLookup: "operator-engagement-member-lookup",
  memberLookupResult: "operator-engagement-member-lookup-result",
  emptyPoints: "operator-engagement-empty-points",
  emptyBadges: "operator-engagement-empty-badges",
});

export function resolveLevelProgressPercent(
  totalPoints: number,
  currentLevelCode: string,
  pointsToNextLevel: number | null,
): number | null {
  if (pointsToNextLevel === null) {
    return 100;
  }
  const currentMin = ENGAGEMENT_LEVEL_THRESHOLDS[currentLevelCode] ?? 0;
  const nextMin = totalPoints + pointsToNextLevel;
  if (nextMin <= currentMin) {
    return null;
  }
  return Math.min(100, Math.round(((totalPoints - currentMin) / (nextMin - currentMin)) * 100));
}

export function formatEngagementTimestamp(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function engagementEventTypeLabelKey(sourceEventType: string): string {
  return `eventTypes.${sourceEventType.replaceAll(".", "_")}`;
}

export function engagementBadgeLabelKey(badgeCode: string): string {
  return `badges.${badgeCode}`;
}

export function engagementLevelLabelKey(levelCode: string): string {
  return `levels.${levelCode}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateEngagementMemberUserId(
  value: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string } {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, error: "MEMBER_USER_ID_INVALID" };
  }
  return { ok: true, value: trimmed };
}

export function buildEngagementMemberLookupPath(userId: string): string {
  return `/api/engagement/members/${encodeURIComponent(userId)}`;
}
