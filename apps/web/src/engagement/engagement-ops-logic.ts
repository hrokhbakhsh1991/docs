import { createClientSafeId } from "@app-tour/draft-engine";

export const ENGAGEMENT_LEVEL_THRESHOLDS: Readonly<Record<string, number>> = Object.freeze({
  base_camp: 0,
  trail_member: 100,
  summit_circle: 250,
});

export const ENGAGEMENT_MEMBER_SEARCH_MIN_LENGTH = 2;

export const ENGAGEMENT_OPS_TEST_IDS = Object.freeze({
  page: "operator-engagement-page",
  recentPoints: "operator-engagement-recent-points",
  recentBadges: "operator-engagement-recent-badges",
  policy: "operator-engagement-policy",
  memberLookup: "operator-engagement-member-lookup",
  memberSearchInput: "operator-engagement-member-search-input",
  memberSearchResults: "operator-engagement-member-search-results",
  memberLookupResult: "operator-engagement-member-lookup-result",
  memberPoints: "operator-engagement-member-points",
  memberHistory: "operator-engagement-member-history",
  adjustButton: "operator-engagement-adjust-button",
  reverseButton: "operator-engagement-reverse-button",
  adjustDialog: "operator-engagement-adjust-dialog",
  reverseDialog: "operator-engagement-reverse-dialog",
  emptyPoints: "operator-engagement-empty-points",
  emptyBadges: "operator-engagement-empty-badges",
});

export type EngagementMutationKind = "adjust" | "reverse";

export type EngagementAdjustmentForm = {
  readonly pointsDelta: string;
  readonly reason: string;
};

export type EngagementReversalForm = {
  readonly reason: string;
};

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

export function buildEngagementPolicyPath(): string {
  return "/api/engagement/policy";
}

export function buildEngagementAdjustPath(userId: string): string {
  return `/api/engagement/members/${encodeURIComponent(userId)}/adjust`;
}

export function buildEngagementReversePath(userId: string): string {
  return `/api/engagement/members/${encodeURIComponent(userId)}/reverse`;
}

export function buildEngagementMemberSearchPath(search: string): string {
  const params = new URLSearchParams({
    search: search.trim(),
    status: "active",
    limit: "8",
  });
  return `/api/users?${params.toString()}`;
}

export function createEngagementIdempotencyKey(prefix: string): string {
  return createClientSafeId(prefix);
}

export function validateEngagementAdjustmentForm(
  form: EngagementAdjustmentForm,
):
  | { readonly ok: true; readonly value: { readonly pointsDelta: number; readonly reason: string } }
  | { readonly ok: false; readonly error: string } {
  const reason = form.reason.trim();
  if (reason.length < 3) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  const parsed = Number.parseInt(form.pointsDelta.trim(), 10);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return { ok: false, error: "POINTS_INVALID" };
  }
  if (Math.abs(parsed) > 500) {
    return { ok: false, error: "POINTS_OUT_OF_RANGE" };
  }
  return { ok: true, value: { pointsDelta: parsed, reason } };
}

export function validateEngagementReversalForm(
  form: EngagementReversalForm,
): { readonly ok: true; readonly value: { readonly reason: string } } | { readonly ok: false; readonly error: string } {
  const reason = form.reason.trim();
  if (reason.length < 3) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  return { ok: true, value: { reason } };
}

export function canReverseEngagementPointEvent(event: {
  readonly pointsDelta: number;
  readonly sourceEventType: string;
}): boolean {
  return event.pointsDelta > 0 && event.sourceEventType !== "engagement.points.reversed";
}
