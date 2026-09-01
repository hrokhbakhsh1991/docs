"use client";

import {
  OPERATOR_WARNING_CALLOUT_PANEL_CLASS,
} from "@/admin/patterns/operator-semantic-surfaces";
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
          className={`${OPERATOR_WARNING_CALLOUT_PANEL_CLASS} p-4`}
          role="status"
          data-testid="integration-tour-published-policy-drift-banner"
        >
          {tourPublishedPolicyDriftLabel}
        </div>
      ) : null}
      {other.length > 0 ? (
        <div
          className={`${OPERATOR_WARNING_CALLOUT_PANEL_CLASS} p-4`}
          role="status"
          data-testid="integration-detail-degraded"
        >
          {detailDegradedLabel}
        </div>
      ) : null}
    </div>
  );
}
