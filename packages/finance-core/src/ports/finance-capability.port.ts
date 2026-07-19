/**
 * Workspace support + finance module enablement (application capability seam).
 * Host adapter resolves tenant row, codegen bindings, and theme modules —
 * FinanceService must not import those directly.
 */

export type FinanceWorkspaceGateResult = {
  readonly workspaceType: string;
  readonly theme: unknown;
};

export interface FinanceCapabilityPort {
  /**
   * Fail-closed: unsupported workspace → FINANCE_WORKSPACE_UNSUPPORTED;
   * module disabled → FORBIDDEN_FINANCE_MODULE_DISABLED.
   */
  assertEnabled(tenantId: string): Promise<FinanceWorkspaceGateResult>;
}
