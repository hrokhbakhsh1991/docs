export type EngagementPointEventRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly profileId: string;
  readonly pointsDelta: number;
  readonly sourceModule: string;
  readonly sourceEventType: string;
  readonly sourceEntityId: string | null;
  readonly dedupeKey: string;
  readonly reversesEventId: string | null;
  readonly actorUserId: string | null;
  readonly actorRole: string | null;
  readonly reason: string | null;
  readonly createdAt: Date;
};

export type EngagementProfileRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly totalPoints: number;
  readonly currentLevelCode: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MemberEngagementBadgeRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly profileId: string;
  readonly badgeCode: string;
  readonly earnedAt: Date;
  readonly dedupeKey: string;
};

export type AwardEngagementPointsInput = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly pointsDelta: number;
  readonly sourceModule: string;
  readonly sourceEventType: string;
  readonly sourceEntityId?: string | null;
  readonly dedupeKey: string;
  readonly actorUserId?: string | null;
  readonly actorRole?: string | null;
  readonly reason?: string | null;
  readonly reversesEventId?: string | null;
};

export type AwardEngagementPointsResult = {
  readonly replay: boolean;
  readonly profile: EngagementProfileRow;
  readonly event: EngagementPointEventRow | null;
  readonly newBadges: readonly MemberEngagementBadgeRow[];
};

export type EngagementRepository = {
  awardPoints(input: AwardEngagementPointsInput): Promise<AwardEngagementPointsResult>;
  getOrCreateProfile(
    tenantId: string,
    workspaceId: string,
    userId: string,
  ): Promise<EngagementProfileRow>;
  listPointEventsForUser(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly workspaceId?: string;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<{ readonly items: readonly EngagementPointEventRow[]; readonly hasMore: boolean; readonly nextCursor: string | null }>;
  listBadgesForUser(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<readonly MemberEngagementBadgeRow[]>;
  listRecentPointEventsForWorkspace(
    tenantId: string,
    workspaceId: string,
    limit: number,
  ): Promise<readonly EngagementPointEventRow[]>;
  listRecentBadgesForWorkspace(
    tenantId: string,
    workspaceId: string,
    limit: number,
  ): Promise<readonly MemberEngagementBadgeRow[]>;
  findPointEventById(tenantId: string, eventId: string): Promise<EngagementPointEventRow | null>;
};
