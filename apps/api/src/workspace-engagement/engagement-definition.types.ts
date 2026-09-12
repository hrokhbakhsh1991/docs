import type {
  EngagementDedupePolicy,
  EngagementDefinitionStatus,
} from "./engagement-admin-catalog";

export type EngagementI18nText = Readonly<{
  readonly fa: string;
  readonly en: string;
}>;

export type EngagementBadgeDefinitionRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly code: string;
  readonly titleI18n: EngagementI18nText;
  readonly descriptionI18n: EngagementI18nText;
  readonly iconKey: string;
  readonly status: EngagementDefinitionStatus;
  readonly triggerKind: "event" | "points_threshold";
  readonly triggerEventType: string | null;
  readonly triggerMinPoints: number | null;
  readonly rowVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
};

export type EngagementLevelDefinitionRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly code: string;
  readonly titleI18n: EngagementI18nText;
  readonly descriptionI18n: EngagementI18nText;
  readonly minPoints: number;
  readonly sortOrder: number;
  readonly status: EngagementDefinitionStatus;
  readonly rowVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type EngagementAwardRuleDefinitionRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly eventType: string;
  readonly sourceModule: string;
  readonly points: number;
  readonly badgeCode: string | null;
  readonly status: EngagementDefinitionStatus;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly dedupePolicy: EngagementDedupePolicy;
  readonly version: number;
  readonly rowVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type EngagementDefinitionAuditRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly entityType: "badge" | "level" | "award_rule";
  readonly entityId: string;
  readonly action: string;
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly beforeJson: unknown;
  readonly afterJson: unknown;
  readonly createdAt: Date;
};
