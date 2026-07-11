/** AP15 P3 — batched platform past-due subscription scans. */
export const MAX_PAST_DUE_SUBSCRIPTION_BATCH = 50;

export const PAST_DUE_SUBSCRIPTION_LIST_SELECT = {
  tenantId: true,
  planId: true,
  status: true,
  currentPeriodEnd: true,
  createdAt: true,
  updatedAt: true,
  plan: true,
} as const;
