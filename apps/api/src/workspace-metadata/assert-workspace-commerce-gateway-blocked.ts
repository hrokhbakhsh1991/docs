import type { WorkspaceCommerceConfig } from "@app-tour/workspace-sdk/metadata";

export class WorkspaceCommerceGatewayBlockedError extends Error {
  readonly code = "WORKSPACE_COMMERCE_GATEWAY_BLOCKED" as const;
  readonly statusCode = 503 as const;

  constructor(message = "Gateway payment mode is blocked until P5-D exit") {
    super(message);
    this.name = "WorkspaceCommerceGatewayBlockedError";
  }
}

/**
 * P5-C-N-009 GU-02 — gateway activation blocked until P5-D exit (lift at N-010).
 */
export function isWorkspaceCommerceGatewayActivationEnabled(): boolean {
  return process.env.P5_D_GATEWAY_ACTIVATION_ENABLED?.trim() === "true";
}

export function assertWorkspaceCommerceGatewayActivationAllowed(
  commerce: Pick<WorkspaceCommerceConfig, "paymentMode">
): void {
  if (commerce.paymentMode === "gateway" && !isWorkspaceCommerceGatewayActivationEnabled()) {
    throw new WorkspaceCommerceGatewayBlockedError();
  }
}

export function isWorkspaceCommerceGatewayBlockedError(
  error: unknown
): error is WorkspaceCommerceGatewayBlockedError {
  return error instanceof WorkspaceCommerceGatewayBlockedError;
}
