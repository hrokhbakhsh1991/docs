import type {
  EngagementAwardRuleDefinitionRow,
  EngagementBadgeDefinitionRow,
  EngagementDefinitionAuditRow,
  EngagementI18nText,
  EngagementLevelDefinitionRow,
} from "./engagement-definition.types";

export function badgeLabelKey(code: string): string {
  return `engagement.badge.${code}.label`;
}

export function badgeDescriptionKey(code: string): string {
  return `engagement.badge.${code}.description`;
}

export function levelLabelKey(code: string): string {
  return `engagement.level.${code}`;
}

export function mapBadgeToHttp(row: EngagementBadgeDefinitionRow) {
  return {
    id: row.id,
    code: row.code,
    titleI18n: row.titleI18n,
    descriptionI18n: row.descriptionI18n,
    labelKey: badgeLabelKey(row.code),
    descriptionKey: badgeDescriptionKey(row.code),
    iconKey: row.iconKey,
    status: row.status,
    triggerKind: row.triggerKind,
    triggerEventType: row.triggerEventType,
    triggerMinPoints: row.triggerMinPoints,
    rowVersion: row.rowVersion,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapLevelToHttp(row: EngagementLevelDefinitionRow) {
  return {
    id: row.id,
    code: row.code,
    titleI18n: row.titleI18n,
    descriptionI18n: row.descriptionI18n,
    labelKey: levelLabelKey(row.code),
    minPoints: row.minPoints,
    sortOrder: row.sortOrder,
    status: row.status,
    rowVersion: row.rowVersion,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAwardRuleToHttp(row: EngagementAwardRuleDefinitionRow) {
  return {
    id: row.id,
    eventType: row.eventType,
    sourceModule: row.sourceModule,
    points: row.points,
    badgeCode: row.badgeCode,
    status: row.status,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    dedupePolicy: row.dedupePolicy,
    version: row.version,
    rowVersion: row.rowVersion,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAuditToHttp(row: EngagementDefinitionAuditRow) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    beforeJson: row.beforeJson,
    afterJson: row.afterJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export function resolveLocalizedText(i18n: EngagementI18nText, locale: string): string {
  if (locale.startsWith("fa")) {
    return i18n.fa;
  }
  return i18n.en;
}
