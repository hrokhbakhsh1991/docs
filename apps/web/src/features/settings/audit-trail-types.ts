export type AuditTrailEvent = {
  readonly id: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly summary: string;
};

export type AuditTrailListResponse = {
  readonly items: readonly AuditTrailEvent[];
  readonly total: number;
};

export const AUDIT_TRAIL_TEST_IDS = {
  page: "operator-settings-audit-trail-page",
  list: "operator-settings-audit-trail-list",
  row: "operator-settings-audit-trail-row",
} as const;
