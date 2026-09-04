export const MEMBER_ENGAGEMENT_LEVEL_THRESHOLDS: Readonly<Record<string, number>> = Object.freeze({
  base_camp: 0,
  trail_member: 100,
  summit_circle: 250,
});

export function resolveMemberLevelProgressPercent(input: {
  readonly totalPoints: number;
  readonly currentLevelCode: string;
  readonly pointsToNextLevel: number | null;
}): number | null {
  if (input.pointsToNextLevel === null) {
    return 100;
  }
  const currentMin = MEMBER_ENGAGEMENT_LEVEL_THRESHOLDS[input.currentLevelCode] ?? 0;
  const nextMin = input.totalPoints + input.pointsToNextLevel;
  if (nextMin <= currentMin) {
    return null;
  }
  return Math.min(
    100,
    Math.round(((input.totalPoints - currentMin) / (nextMin - currentMin)) * 100),
  );
}

export function engagementEventTypeMessageKey(sourceEventType: string): string {
  return `eventTypes.${sourceEventType.replaceAll(".", "_")}`;
}

export function formatMemberEngagementTimestamp(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
