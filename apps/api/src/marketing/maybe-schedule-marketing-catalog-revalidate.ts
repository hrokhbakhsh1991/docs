import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { scheduleMarketingCatalogRevalidate } from "./schedule-marketing-catalog-revalidate";
import { shouldInvalidateMarketingCatalog } from "./should-invalidate-marketing-catalog";

/**
 * P4-A — single entry for catalog cache purge after canonical writes.
 * Fail-open: schedules async fetch; never throws.
 */
export function maybeScheduleMarketingCatalogRevalidate(input: {
  workspaceType: string;
  before: CanonicalDocument | null;
  after: CanonicalDocument;
  tenantId: string;
}): void {
  if (!shouldInvalidateMarketingCatalog(input.workspaceType, input.before, input.after)) {
    return;
  }
  scheduleMarketingCatalogRevalidate(input.tenantId);
}
