export const TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PREFIX =
  "tenant_payment_config:invalidate:";

export const TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN = `${TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PREFIX}*`;

export function tenantPaymentConfigInvalidateChannel(tenantId: string): string {
  return `${TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PREFIX}${tenantId.trim().toLowerCase()}`;
}

export function parseTenantIdFromPaymentConfigInvalidateChannel(
  channel: string,
): string | null {
  const normalized = channel.trim();
  if (!normalized.startsWith(TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PREFIX)) {
    return null;
  }
  const tenantId = normalized
    .slice(TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PREFIX.length)
    .trim()
    .toLowerCase();
  return tenantId || null;
}
