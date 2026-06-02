/** Canonical envelope passed from {@link OutboxProcessor} into downstream dispatch / audit. */
export type OutboxDeliveryEnvelope = {
  tenant_id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at?: string;
};
