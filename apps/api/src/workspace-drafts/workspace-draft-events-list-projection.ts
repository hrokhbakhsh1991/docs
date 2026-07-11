/** AP15 P1 — draft event list reads (SQL-bound, no in-memory slice). */
export const WORKSPACE_DRAFT_EVENT_LIST_SELECT = {
  id: true,
  tenantId: true,
  workspaceId: true,
  userId: true,
  draftNamespace: true,
  draftKey: true,
  action: true,
  version: true,
  schemaVersion: true,
  actorUserId: true,
  occurredAt: true,
} as const;
