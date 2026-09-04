export type EngagementLoadState = "idle" | "loading" | "error" | "ready" | "permissionDenied";

export type EngagementBadgeDefinition = {
  readonly id: string;
  readonly code: string;
  readonly titleI18n: { readonly en: string; readonly fa: string };
  readonly descriptionI18n: { readonly en: string; readonly fa: string };
  readonly iconKey: string;
  readonly status: "active" | "inactive" | "archived";
  readonly triggerKind: "event" | "points_threshold";
  readonly triggerEventType: string | null;
  readonly triggerMinPoints: number | null;
  readonly rowVersion: number;
  readonly updatedAt: string;
};

export type EngagementLevelDefinition = {
  readonly id: string;
  readonly code: string;
  readonly titleI18n: { readonly en: string; readonly fa: string };
  readonly descriptionI18n: { readonly en: string; readonly fa: string };
  readonly minPoints: number;
  readonly sortOrder: number;
  readonly status: "active" | "inactive" | "archived";
  readonly rowVersion: number;
  readonly updatedAt: string;
};

export type EngagementAwardRuleDefinition = {
  readonly id: string;
  readonly eventType: string;
  readonly sourceModule: string;
  readonly points: number;
  readonly badgeCode: string | null;
  readonly status: "active" | "inactive" | "archived";
  readonly rowVersion: number;
  readonly updatedAt: string;
};

export type EngagementAuditEntry = {
  readonly id: string;
  readonly entityType: "badge" | "level" | "award_rule";
  readonly entityId: string;
  readonly action: string;
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly createdAt: string;
};

export type EngagementCatalog = {
  readonly icons: readonly { readonly key: string; readonly labelKey: string }[];
  readonly supportedEvents: readonly {
    readonly eventType: string;
    readonly sourceModule: string;
    readonly labelKey: string;
  }[];
};

export type OverviewPayload = {
  readonly recentPointEvents: readonly {
    readonly userId: string;
    readonly pointsDelta: number;
    readonly sourceEventType: string;
    readonly createdAt: string;
    readonly displayHint: string | null;
  }[];
  readonly recentBadges: readonly {
    readonly userId: string;
    readonly badgeCode: string;
    readonly labelKey: string;
    readonly earnedAt: string;
    readonly displayHint: string | null;
  }[];
};

export type PointEventRow = {
  readonly id: string;
  readonly pointsDelta: number;
  readonly sourceEventType: string;
  readonly reason: string | null;
  readonly actorRole: string | null;
  readonly createdAt: string;
};

export type MemberLookupPayload = {
  readonly userId: string;
  readonly summary: {
    readonly totalPoints: number;
    readonly currentLevelCode: string;
    readonly earnedBadgeCount: number;
    readonly badges: readonly { readonly code: string; readonly earned: boolean }[];
    readonly recentPointEvents: readonly PointEventRow[];
  };
};
