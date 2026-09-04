import { createClientSafeId } from "@app-tour/draft-engine";

export const ENGAGEMENT_LEVEL_THRESHOLDS: Readonly<Record<string, number>> = Object.freeze({
  base_camp: 0,
  trail_member: 100,
  summit_circle: 250,
});

export const ENGAGEMENT_MEMBER_SEARCH_MIN_LENGTH = 2;

export const ENGAGEMENT_SUPPORTED_AWARD_EVENT_TYPES = Object.freeze([
  "profile.completed",
  "registration.first_approved",
] as const);

export function resolveEngagementSupportedEventTypes(
  catalog: { readonly supportedEvents?: readonly { readonly eventType: string }[] } | null,
): readonly string[] {
  const fromCatalog = catalog?.supportedEvents?.map((event) => event.eventType) ?? [];
  if (fromCatalog.length > 0) {
    return fromCatalog;
  }
  return ENGAGEMENT_SUPPORTED_AWARD_EVENT_TYPES;
}

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

export const ENGAGEMENT_DEFINITION_STATUSES = Object.freeze(["active", "inactive", "archived"] as const);

export const ENGAGEMENT_TRIGGER_KINDS = Object.freeze(["event", "points_threshold"] as const);

const ENGAGEMENT_CODE_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

export type EngagementOpsTab = "overview" | "badges" | "levels" | "awardRules" | "audit";

export const ENGAGEMENT_OPS_TABS: readonly EngagementOpsTab[] = Object.freeze([
  "overview",
  "badges",
  "levels",
  "awardRules",
  "audit",
]);

export function canMutateEngagementAsOperator(role: string): boolean {
  return role === "owner" || role === "admin";
}

export const ENGAGEMENT_OPS_TEST_IDS = Object.freeze({
  page: "operator-engagement-page",
  tabs: "operator-engagement-tabs",
  tabOverview: "operator-engagement-tab-overview",
  tabBadges: "operator-engagement-tab-badges",
  tabLevels: "operator-engagement-tab-levels",
  tabAwardRules: "operator-engagement-tab-award-rules",
  tabAudit: "operator-engagement-tab-audit",
  memberOpsUsersLink: "operator-engagement-member-ops-users-link",
  recentPoints: "operator-engagement-recent-points",
  recentBadges: "operator-engagement-recent-badges",
  badgesPanel: "operator-engagement-badges-panel",
  badgesList: "operator-engagement-badges-list",
  badgesEmpty: "operator-engagement-badges-empty",
  badgesCreateButton: "operator-engagement-badges-create-button",
  badgesCreateDialog: "operator-engagement-badges-create-dialog",
  badgesEditDialog: "operator-engagement-badges-edit-dialog",
  badgePreview: "operator-engagement-badge-preview",
  levelsPanel: "operator-engagement-levels-panel",
  levelsList: "operator-engagement-levels-list",
  levelsEmpty: "operator-engagement-levels-empty",
  levelsCreateButton: "operator-engagement-levels-create-button",
  awardRulesPanel: "operator-engagement-award-rules-panel",
  awardRulesList: "operator-engagement-award-rules-list",
  awardRulesEmpty: "operator-engagement-award-rules-empty",
  awardRulesCreateButton: "operator-engagement-award-rules-create-button",
  auditPanel: "operator-engagement-audit-panel",
  auditTable: "operator-engagement-audit-table",
  auditEmpty: "operator-engagement-audit-empty",
  permissionDenied: "operator-engagement-permission-denied",
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

export type EngagementI18nFormText = {
  readonly en: string;
  readonly fa: string;
};

export type EngagementBadgeCreateForm = {
  readonly code: string;
  readonly titleEn: string;
  readonly titleFa: string;
  readonly descriptionEn: string;
  readonly descriptionFa: string;
  readonly iconKey: string;
  readonly triggerKind: "event" | "points_threshold";
  readonly triggerEventType: string;
  readonly triggerMinPoints: string;
};

export type EngagementLevelCreateForm = {
  readonly code: string;
  readonly titleEn: string;
  readonly titleFa: string;
  readonly descriptionEn: string;
  readonly descriptionFa: string;
  readonly minPoints: string;
  readonly sortOrder: string;
};

export type EngagementAwardRuleCreateForm = {
  readonly eventType: string;
  readonly points: string;
  readonly badgeCode: string;
};

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

export function buildEngagementBadgesPath(): string {
  return "/api/engagement/badges";
}

export function buildEngagementBadgeUpdatePath(code: string): string {
  return `/api/engagement/badges/${encodeURIComponent(code)}`;
}

export function buildEngagementLevelsPath(): string {
  return "/api/engagement/levels";
}

export function buildEngagementLevelUpdatePath(code: string): string {
  return `/api/engagement/levels/${encodeURIComponent(code)}`;
}

export function buildEngagementAwardRulesPath(): string {
  return "/api/engagement/award-rules";
}

export function buildEngagementAwardRuleUpdatePath(ruleId: string): string {
  return `/api/engagement/award-rules/${encodeURIComponent(ruleId)}`;
}

export function buildEngagementAuditLogPath(limit = 50): string {
  const params = new URLSearchParams({ limit: String(limit) });
  return `/api/engagement/audit-log?${params.toString()}`;
}

export function buildEngagementCatalogPath(): string {
  return "/api/engagement/catalog";
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

function validateEngagementCodeSlug(
  value: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string } {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 64 || !ENGAGEMENT_CODE_SLUG_PATTERN.test(trimmed)) {
    return { ok: false, error: "CODE_INVALID" };
  }
  return { ok: true, value: trimmed };
}

function validateEngagementI18nPair(
  en: string,
  fa: string,
): { readonly ok: true; readonly value: EngagementI18nFormText } | { readonly ok: false; readonly error: string } {
  const enTrimmed = en.trim();
  const faTrimmed = fa.trim();
  if (enTrimmed.length === 0 || faTrimmed.length === 0) {
    return { ok: false, error: "I18N_REQUIRED" };
  }
  if (enTrimmed.length > 500 || faTrimmed.length > 500) {
    return { ok: false, error: "I18N_TOO_LONG" };
  }
  return { ok: true, value: { en: enTrimmed, fa: faTrimmed } };
}

export function sortEngagementLevelsByMinPoints<
  T extends { readonly minPoints: number; readonly sortOrder?: number },
>(levels: readonly T[]): T[] {
  return [...levels].sort((left, right) => {
    if (left.minPoints !== right.minPoints) {
      return left.minPoints - right.minPoints;
    }
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
  });
}

export function validateEngagementBadgeCreateForm(
  form: EngagementBadgeCreateForm,
  supportedEventTypes: readonly string[],
):
  | {
      readonly ok: true;
      readonly value: {
        readonly code: string;
        readonly titleI18n: EngagementI18nFormText;
        readonly descriptionI18n: EngagementI18nFormText;
        readonly iconKey: string;
        readonly triggerKind: "event" | "points_threshold";
        readonly triggerEventType?: string;
        readonly triggerMinPoints?: number;
      };
    }
  | { readonly ok: false; readonly error: string } {
  const codeResult = validateEngagementCodeSlug(form.code);
  if (!codeResult.ok) {
    return codeResult;
  }
  const titleResult = validateEngagementI18nPair(form.titleEn, form.titleFa);
  if (!titleResult.ok) {
    return titleResult;
  }
  const descriptionResult = validateEngagementI18nPair(form.descriptionEn, form.descriptionFa);
  if (!descriptionResult.ok) {
    return descriptionResult;
  }
  if (!(ENGAGEMENT_BADGE_ICON_KEYS as readonly string[]).includes(form.iconKey)) {
    return { ok: false, error: "ICON_INVALID" };
  }
  if (!(ENGAGEMENT_TRIGGER_KINDS as readonly string[]).includes(form.triggerKind)) {
    return { ok: false, error: "TRIGGER_KIND_INVALID" };
  }
  if (form.triggerKind === "event") {
    if (!supportedEventTypes.includes(form.triggerEventType)) {
      return { ok: false, error: "TRIGGER_EVENT_INVALID" };
    }
    return {
      ok: true,
      value: {
        code: codeResult.value,
        titleI18n: titleResult.value,
        descriptionI18n: descriptionResult.value,
        iconKey: form.iconKey,
        triggerKind: "event",
        triggerEventType: form.triggerEventType,
      },
    };
  }
  const minPoints = Number.parseInt(form.triggerMinPoints.trim(), 10);
  if (!Number.isFinite(minPoints) || minPoints < 1 || minPoints > 100_000) {
    return { ok: false, error: "TRIGGER_POINTS_INVALID" };
  }
  return {
    ok: true,
    value: {
      code: codeResult.value,
      titleI18n: titleResult.value,
      descriptionI18n: descriptionResult.value,
      iconKey: form.iconKey,
      triggerKind: "points_threshold",
      triggerMinPoints: minPoints,
    },
  };
}

export function validateEngagementLevelCreateForm(
  form: EngagementLevelCreateForm,
  existingMinPoints: readonly number[],
):
  | {
      readonly ok: true;
      readonly value: {
        readonly code: string;
        readonly titleI18n: EngagementI18nFormText;
        readonly descriptionI18n: EngagementI18nFormText;
        readonly minPoints: number;
        readonly sortOrder: number;
      };
    }
  | { readonly ok: false; readonly error: string } {
  const codeResult = validateEngagementCodeSlug(form.code);
  if (!codeResult.ok) {
    return codeResult;
  }
  const titleResult = validateEngagementI18nPair(form.titleEn, form.titleFa);
  if (!titleResult.ok) {
    return titleResult;
  }
  const descriptionResult = validateEngagementI18nPair(form.descriptionEn, form.descriptionFa);
  if (!descriptionResult.ok) {
    return descriptionResult;
  }
  const minPoints = Number.parseInt(form.minPoints.trim(), 10);
  if (!Number.isFinite(minPoints) || minPoints < 0 || minPoints > 1_000_000) {
    return { ok: false, error: "MIN_POINTS_INVALID" };
  }
  if (existingMinPoints.includes(minPoints)) {
    return { ok: false, error: "MIN_POINTS_DUPLICATE" };
  }
  const sortOrderParsed = form.sortOrder.trim().length === 0 ? 0 : Number.parseInt(form.sortOrder.trim(), 10);
  if (!Number.isFinite(sortOrderParsed) || sortOrderParsed < 0 || sortOrderParsed > 10_000) {
    return { ok: false, error: "SORT_ORDER_INVALID" };
  }
  return {
    ok: true,
    value: {
      code: codeResult.value,
      titleI18n: titleResult.value,
      descriptionI18n: descriptionResult.value,
      minPoints,
      sortOrder: sortOrderParsed,
    },
  };
}

export function validateEngagementLevelUpdateMinPoints(
  minPointsRaw: string,
  existingMinPoints: readonly number[],
  currentMinPoints: number,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  const minPoints = Number.parseInt(minPointsRaw.trim(), 10);
  if (!Number.isFinite(minPoints) || minPoints < 0 || minPoints > 1_000_000) {
    return { ok: false, error: "MIN_POINTS_INVALID" };
  }
  if (minPoints !== currentMinPoints && existingMinPoints.includes(minPoints)) {
    return { ok: false, error: "MIN_POINTS_DUPLICATE" };
  }
  return { ok: true, value: minPoints };
}

export function validateEngagementAwardRuleCreateForm(
  form: EngagementAwardRuleCreateForm,
  supportedEventTypes: readonly string[],
):
  | {
      readonly ok: true;
      readonly value: {
        readonly eventType: string;
        readonly points: number;
        readonly badgeCode: string | null;
      };
    }
  | { readonly ok: false; readonly error: string } {
  if (!supportedEventTypes.includes(form.eventType)) {
    return { ok: false, error: "EVENT_TYPE_INVALID" };
  }
  const points = Number.parseInt(form.points.trim(), 10);
  if (!Number.isFinite(points) || points < 1 || points > 10_000) {
    return { ok: false, error: "POINTS_INVALID" };
  }
  const badgeCodeTrimmed = form.badgeCode.trim();
  let badgeCode: string | null = null;
  if (badgeCodeTrimmed.length > 0) {
    const badgeCodeResult = validateEngagementCodeSlug(badgeCodeTrimmed);
    if (!badgeCodeResult.ok) {
      return badgeCodeResult;
    }
    badgeCode = badgeCodeResult.value;
  }
  return { ok: true, value: { eventType: form.eventType, points, badgeCode } };
}

export function isEngagementPermissionDenied(status: number): boolean {
  return status === 403;
}

export function parseEngagementApiErrorCode(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const record = payload as { code?: string; error?: { code?: string } };
  return record.code ?? record.error?.code ?? null;
}
