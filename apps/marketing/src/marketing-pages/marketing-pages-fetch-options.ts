/** Next.js cache tag for tenant marketing page payloads (MKP-001). */
export function buildMarketingPagesCacheTag(tenantId: string): string {
  const id = tenantId.trim();
  if (id.length === 0) {
    throw new Error("MARKETING_PAGES_TENANT_ID_REQUIRED");
  }
  return `marketing-pages-${id}`;
}
