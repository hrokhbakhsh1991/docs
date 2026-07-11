/** AP15 P1 — bounded settings audit trail list reads. */
export const MAX_SETTINGS_AUDIT_EVENTS_PER_PAGE = 100;
export const MAX_SETTINGS_AUDIT_EVENTS_PER_TENANT = 500;

export const SETTINGS_AUDIT_LIST_SELECT = {
  id: true,
  tenantId: true,
  occurredAt: true,
  actorUserId: true,
  action: true,
  resourceType: true,
  resourceId: true,
  summary: true,
} as const;
