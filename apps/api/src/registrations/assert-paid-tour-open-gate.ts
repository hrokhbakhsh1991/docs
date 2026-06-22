import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { WorkspaceCommerceConfig } from "@app-tour/workspace-sdk/metadata";

import {
  assertWorkspaceCommerceGatewayActivationAllowed,
  isWorkspaceCommerceGatewayBlockedError,
} from "../workspace-metadata/assert-workspace-commerce-gateway-blocked.ts";
import { detectTourPublishTransition } from "../canonical/workspace-canonical-tour-dispatch.ts";

export class PaidTourOpenGateBlockedError extends Error {
  readonly code = "PAID_TOUR_OPEN_GATE_BLOCKED" as const;
  readonly statusCode = 403 as const;

  constructor(message = "Gateway commerce blocks paid tour OPEN until P5-D exit") {
    super(message);
    this.name = "PaidTourOpenGateBlockedError";
  }
}

export function isPaidTourOpenGateBlockedError(
  error: unknown
): error is PaidTourOpenGateBlockedError {
  return error instanceof PaidTourOpenGateBlockedError;
}

/**
 * P5-E-N-004 FIN-01 — offline_receipt may OPEN; gateway requires GU-02 lift (PC-06/07).
 */
export function assertPaidTourOpenCommerceGate(
  commerce: Pick<WorkspaceCommerceConfig, "paymentMode">
): void {
  try {
    assertWorkspaceCommerceGatewayActivationAllowed(commerce);
  } catch (error: unknown) {
    if (isWorkspaceCommerceGatewayBlockedError(error)) {
      throw new PaidTourOpenGateBlockedError(error.message);
    }
    throw error;
  }
}

/** FIN-01 — run commerce gate only when PATCH transitions tour to published. */
export function assertPaidTourOpenCommerceGateOnPublishTransition(input: {
  readonly workspaceType: string;
  readonly before: CanonicalDocument;
  readonly after: CanonicalDocument;
  readonly commerce: Pick<WorkspaceCommerceConfig, "paymentMode">;
}): void {
  const transition = detectTourPublishTransition(
    input.workspaceType,
    input.before,
    input.after
  );
  if (transition !== "published") {
    return;
  }
  assertPaidTourOpenCommerceGate(input.commerce);
}
