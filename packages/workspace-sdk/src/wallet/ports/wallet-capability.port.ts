/**
 * Workspace support + wallet module enablement (application capability seam).
 * Host adapter resolves tenant row, codegen bindings, and theme modules —
 * future WalletService must not import those directly.
 */

export type WalletWorkspaceGateResult = {
  readonly workspaceType: string;
  readonly theme: unknown;
};

export interface WalletCapabilityPort {
  /**
   * Fail-closed: unsupported workspace → WALLET_WORKSPACE_UNSUPPORTED;
   * module disabled → FORBIDDEN_WALLET_MODULE_DISABLED.
   */
  assertEnabled(tenantId: string): Promise<WalletWorkspaceGateResult>;
}
