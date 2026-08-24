/**
 * MAT-012 — computable SLO burn query definitions (Prometheus / log-aggregator syntax).
 * Live dashboard wiring: BLOCKED_EXTERNAL until staging Prometheus/Grafana exists.
 */

export type WorkspaceSloQueryDefinition = {
  readonly id: string;
  readonly area: string;
  readonly window: string;
  readonly target: number;
  readonly expression: string;
};

/** SLO burn = bad / total over window; alert when burn rate exceeds budget. */
export const WORKSPACE_SLO_QUERY_DEFINITIONS: readonly WorkspaceSloQueryDefinition[] = [
  {
    id: "api-availability-30d",
    area: "api",
    window: "30d",
    target: 0.995,
    expression:
      'sum(rate(http_request_total{status=~"5.."}[5m])) / sum(rate(http_request_total[5m]))',
  },
  {
    id: "registration-success-7d",
    area: "registration",
    window: "7d",
    target: 0.99,
    expression:
      'sum(rate(workspace_slo_event_total{area="registration",outcome="error"}[15m])) by (workspace_type) / sum(rate(workspace_slo_event_total{area="registration"}[15m])) by (workspace_type)',
  },
  {
    id: "publish-write-success-30d",
    area: "publish_write",
    window: "30d",
    target: 0.995,
    expression:
      'sum(rate(workspace_slo_event_total{area="publish_write",outcome="error"}[1h])) by (workspace_type,validation_stage) / sum(rate(workspace_slo_event_total{area="publish_write"}[1h])) by (workspace_type,validation_stage)',
  },
  {
    id: "portal-auth-success-30d",
    area: "portal_auth",
    window: "30d",
    target: 0.995,
    expression:
      'sum(rate(workspace_slo_event_total{area="portal_auth",outcome="error"}[15m])) by (workspace_type) / sum(rate(workspace_slo_event_total{area="portal_auth"}[15m])) by (workspace_type)',
  },
  {
    id: "finance-critical-30d",
    area: "finance",
    window: "30d",
    target: 0.999,
    expression:
      'sum(rate(workspace_slo_event_total{area="finance",outcome="error"}[5m])) by (workspace_type) / sum(rate(workspace_slo_event_total{area="finance"}[5m])) by (workspace_type)',
  },
] as const;

export function validateWorkspaceSloQueryDefinitions(): readonly string[] {
  const violations: string[] = [];
  for (const query of WORKSPACE_SLO_QUERY_DEFINITIONS) {
    if (query.target <= 0 || query.target >= 1) {
      violations.push(`${query.id}:target-out-of-range`);
    }
    if (query.expression.trim().length === 0) {
      violations.push(`${query.id}:empty-expression`);
    }
    if (!query.expression.includes("workspace")) {
      violations.push(`${query.id}:missing-workspace-dimension`);
    }
  }
  return violations;
}
