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
  readonly createdAt: string;
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
  readonly recentPointEvents: readonly EngagementPointEventHttpItem[];
};

export type EngagementPointHistoryHttpResponse = {
  readonly items: readonly EngagementPointEventHttpItem[];
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
  readonly summary: EngagementMemberSummaryHttpResponse;
};

export type EngagementReversalHttpResponse = {
  readonly reversalEventId: string;
  readonly totalPoints: number;
  readonly replay: boolean;
};

export type EngagementOperatorPolicyHttpResponse = {
  readonly managementMode: "system_managed";
  readonly editUnavailableReasonKey: string;
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
