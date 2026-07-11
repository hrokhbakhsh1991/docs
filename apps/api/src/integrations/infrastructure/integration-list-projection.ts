/** AP15 P1 — bounded integration list reads (exclude credentials on list paths). */
export const MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE = 50;
export const MAX_INTEGRATION_EVENT_POLICIES_PER_CONNECTION = 100;

export const INTEGRATION_CONNECTION_LIST_SELECT = {
  id: true,
  tenantId: true,
  workspaceType: true,
  provider: true,
  status: true,
  enabled: true,
  capabilities: true,
  config: true,
  secretRef: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const INTEGRATION_EVENT_POLICY_LIST_SELECT = {
  id: true,
  tenantId: true,
  integrationConnectionId: true,
  eventType: true,
  enabled: true,
} as const;
