"use client";

import {
  hasIntegrationLoadWarnings,
  partitionIntegrationLoadWarnings,
} from "@/integrations/integration-connection-load-warnings";
import type { IntegrationConnectionLoadWarning } from "@/integrations/integrations-types";

type IntegrationConnectionLoadWarningsBannerProps = {
  readonly loadWarnings: readonly IntegrationConnectionLoadWarning[] | undefined;
  readonly tourPublishedPolicyDriftLabel: string;
  readonly detailDegradedLabel: string;
  readonly testId?: string;
};

export function IntegrationConnectionLoadWarningsBanner({
  loadWarnings,
  tourPublishedPolicyDriftLabel,
  detailDegradedLabel,
  testId = "integration-connection-load-warnings",
}: IntegrationConnectionLoadWarningsBannerProps) {
  if (!hasIntegrationLoadWarnings(loadWarnings)) {
    return null;
  }

  const { tourPublishedPolicyDrift, other } = partitionIntegrationLoadWarnings(loadWarnings);

  return (
    <div className="space-y-2" data-testid={testId}>
      {tourPublishedPolicyDrift ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
          role="status"
          data-testid="integration-tour-published-policy-drift-banner"
        >
          {tourPublishedPolicyDriftLabel}
        </div>
      ) : null}
      {other.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
          role="status"
          data-testid="integration-detail-degraded"
        >
          {detailDegradedLabel}
        </div>
      ) : null}
    </div>
  );
}
