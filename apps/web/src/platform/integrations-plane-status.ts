export type IntegrationsPlaneStatus = {
  readonly zibalConfigured: boolean;
  readonly stripeConfigured: boolean;
  readonly webhookConfigured: boolean;
  /** Lifted at P5-D-N-010 when GU-02 gateway guard opens. */
  readonly gatewayActivationEnabled: boolean;
};

export type ClubPspSurfaceStatus =
  | "offline_receipt"
  | "gateway_blocked"
  | "provider_not_configured"
  | "webhook_not_configured"
  | "ready";

export function resolveClubPspSurfaceStatus(input: {
  readonly workspaceType: string;
  readonly paymentMode: "offline_receipt" | "gateway";
  readonly gatewayProvider: "zibal" | "stripe" | null;
  readonly integrationsPlane: IntegrationsPlaneStatus;
}): ClubPspSurfaceStatus {
  if (input.paymentMode !== "gateway") {
    return "offline_receipt";
  }

  if (!input.integrationsPlane.gatewayActivationEnabled) {
    return "gateway_blocked";
  }

  if (input.gatewayProvider === "zibal" && !input.integrationsPlane.zibalConfigured) {
    return "provider_not_configured";
  }
  if (input.gatewayProvider === "stripe" && !input.integrationsPlane.stripeConfigured) {
    return "provider_not_configured";
  }
  if (!input.integrationsPlane.webhookConfigured) {
    return "webhook_not_configured";
  }

  return "ready";
}

export function clubPspSurfaceStatusLabel(status: ClubPspSurfaceStatus): string {
  switch (status) {
    case "offline_receipt":
      return "Offline receipt — no live PSP";
    case "gateway_blocked":
      return "Gateway blocked until P5-D exit";
    case "provider_not_configured":
      return "PSP credentials not configured on platform";
    case "webhook_not_configured":
      return "Webhook signing secret not configured";
    case "ready":
      return "PSP path ready";
  }
}
