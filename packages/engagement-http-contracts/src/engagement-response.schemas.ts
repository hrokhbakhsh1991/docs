export type EngagementLevelHttpItem = {
  readonly code: string;
  readonly labelKey: string;
  readonly minPoints: number;
  readonly isCurrent: boolean;
};

export type EngagementBadgeHttpItem = {
  readonly code: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly earned: boolean;
  readonly earnedAt: string | null;
  readonly progressPercent: number | null;
};

export type EngagementPointEventHttpItem = {
  readonly id: string;
  readonly pointsDelta: number;
  readonly sourceModule: string;
  readonly sourceEventType: string;
  readonly sourceEntityId: string | null;
  readonly reason: string | null;
  readonly actorRole: string | null;
  readonly createdAt: string;
};

export type EngagementMemberPointEventViewKind = "award" | "correction" | "reversal";

export type EngagementMemberPointEventHttpItem = {
  readonly id: string;
  readonly kind: EngagementMemberPointEventViewKind;
  readonly labelKey: string;
  readonly detailLabelKey: string | null;
  readonly createdAt: string;
  readonly pointsAwarded: number | null;
};

export type EngagementMemberSummaryHttpResponse = {
  readonly totalPoints: number;
  readonly currentLevelCode: string;
  readonly currentLevelLabelKey: string;
  readonly nextLevelCode: string | null;
  readonly nextLevelLabelKey: string | null;
  readonly pointsToNextLevel: number | null;
  readonly earnedBadgeCount: number;
  readonly badges: readonly EngagementBadgeHttpItem[];
  readonly recentPointEvents: readonly EngagementMemberPointEventHttpItem[];
};

export type EngagementOperatorMemberSummaryHttpResponse = Omit<
  EngagementMemberSummaryHttpResponse,
  "recentPointEvents"
> & {
  readonly totalPoints: number;
  readonly recentPointEvents: readonly EngagementPointEventHttpItem[];
};

export type EngagementPointHistoryHttpResponse = {
  readonly items: readonly EngagementMemberPointEventHttpItem[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
};

export type EngagementOperatorOverviewHttpResponse = {
  readonly recentPointEvents: readonly (EngagementPointEventHttpItem & {
    readonly userId: string;
    readonly displayHint: string | null;
  })[];
  readonly recentBadges: readonly {
    readonly userId: string;
    readonly badgeCode: string;
    readonly labelKey: string;
    readonly earnedAt: string;
    readonly displayHint: string | null;
  }[];
};

export type EngagementMemberLookupHttpResponse = {
  readonly userId: string;
  readonly summary: EngagementOperatorMemberSummaryHttpResponse;
};

export type EngagementReversalHttpResponse = {
  readonly reversalEventId: string;
  readonly totalPoints: number;
  readonly replay: boolean;
};

export type EngagementOperatorPolicyHttpResponse = {
  readonly managementMode: "operator_managed" | "system_managed";
  readonly editUnavailableReasonKey: string | null;
  readonly levels: readonly {
    readonly code: string;
    readonly labelKey: string;
    readonly minPoints: number;
  }[];
  readonly badges: readonly {
    readonly code: string;
    readonly labelKey: string;
    readonly descriptionKey: string;
    readonly triggerKind: "event" | "points_threshold";
    readonly triggerEventType: string | null;
    readonly triggerMinPoints: number | null;
  }[];
  readonly awardRules: readonly {
    readonly eventType: string;
    readonly points: number;
    readonly sourceModule: string;
  }[];
};

export type EngagementAdjustmentHttpResponse = {
  readonly eventId: string;
  readonly totalPoints: number;
  readonly replay: boolean;
};

export type EngagementI18nHttpText = Readonly<{
  readonly en: string;
  readonly fa: string;
}>;

export type EngagementDefinitionStatusHttp = "active" | "inactive" | "archived";

export type EngagementBadgeDefinitionHttpItem = {
  readonly id: string;
  readonly code: string;
  readonly titleI18n: EngagementI18nHttpText;
  readonly descriptionI18n: EngagementI18nHttpText;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly iconKey: string;
  readonly status: EngagementDefinitionStatusHttp;
  readonly triggerKind: "event" | "points_threshold";
  readonly triggerEventType: string | null;
  readonly triggerMinPoints: number | null;
  readonly rowVersion: number;
  readonly archivedAt: string | null;
  readonly updatedAt: string;
};

export type EngagementLevelDefinitionHttpItem = {
  readonly id: string;
  readonly code: string;
  readonly titleI18n: EngagementI18nHttpText;
  readonly descriptionI18n: EngagementI18nHttpText;
  readonly labelKey: string;
  readonly minPoints: number;
  readonly sortOrder: number;
  readonly status: EngagementDefinitionStatusHttp;
  readonly rowVersion: number;
  readonly updatedAt: string;
};

export type EngagementAwardRuleDefinitionHttpItem = {
  readonly id: string;
  readonly eventType: string;
  readonly sourceModule: string;
  readonly points: number;
  readonly badgeCode: string | null;
  readonly status: EngagementDefinitionStatusHttp;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly dedupePolicy: "per_user" | "per_entity";
  readonly version: number;
  readonly rowVersion: number;
  readonly updatedAt: string;
};

export type EngagementDefinitionAuditHttpItem = {
  readonly id: string;
  readonly entityType: "badge" | "level" | "award_rule";
  readonly entityId: string;
  readonly action: string;
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly beforeJson: unknown;
  readonly afterJson: unknown;
  readonly createdAt: string;
};

export type EngagementOperatorCatalogHttpResponse = {
  readonly icons: readonly {
    readonly key: string;
    readonly labelKey: string;
  }[];
  readonly supportedEvents: readonly {
    readonly eventType: string;
    readonly sourceModule: string;
    readonly labelKey: string;
  }[];
};

export type EngagementBadgeDefinitionListHttpResponse = {
  readonly items: readonly EngagementBadgeDefinitionHttpItem[];
};

export type EngagementLevelDefinitionListHttpResponse = {
  readonly items: readonly EngagementLevelDefinitionHttpItem[];
};

export type EngagementAwardRuleDefinitionListHttpResponse = {
  readonly items: readonly EngagementAwardRuleDefinitionHttpItem[];
};

export type EngagementDefinitionAuditListHttpResponse = {
  readonly items: readonly EngagementDefinitionAuditHttpItem[];
};
