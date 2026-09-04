export type MemberNotificationSourceModule = "ticketing" | "booking" | "finance" | "wallet";

export type MemberNotificationEntityType = "ticket" | "registration" | "payment" | "wallet_event";

export type MemberNotificationRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly sourceModule: MemberNotificationSourceModule;
  readonly eventType: string;
  readonly entityType: MemberNotificationEntityType;
  readonly entityId: string | null;
  readonly title: string;
  readonly body: string;
  readonly titleKey: string | null;
  readonly bodyKey: string | null;
  readonly templateKey: string | null;
  readonly dedupeKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly readAt: string | null;
  readonly createdAt: string;
};

export type MemberNotificationInsertInput = {
  readonly tenantId: string;
  readonly userId: string;
  readonly sourceModule: MemberNotificationSourceModule;
  readonly eventType: string;
  readonly entityType: MemberNotificationEntityType;
  readonly entityId?: string | null;
  readonly title: string;
  readonly body: string;
  readonly titleKey?: string | null;
  readonly bodyKey?: string | null;
  readonly templateKey?: string | null;
  readonly dedupeKey: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly enqueueEmailSms?: boolean;
};

export type MemberNotificationListQuery = {
  readonly tenantId: string;
  readonly userId?: string;
  readonly viewerTenantWide?: boolean;
  readonly sourceModule?: MemberNotificationSourceModule;
  readonly unreadOnly?: boolean;
  readonly cursor?: string | null;
  readonly limit: number;
};

export type MemberNotificationListResult = {
  readonly items: readonly MemberNotificationRow[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
};
