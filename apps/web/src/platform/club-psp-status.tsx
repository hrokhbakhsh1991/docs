"use client";

import {
  clubPspSurfaceStatusLabel,
  resolveClubPspSurfaceStatus,
  type IntegrationsPlaneStatus,
} from "./integrations-plane-status";

export type ClubPspStatusProps = {
  readonly workspaceType: string;
  readonly paymentMode: "offline_receipt" | "gateway";
  readonly gatewayProvider: "zibal" | "stripe" | null;
  readonly integrationsPlane: IntegrationsPlaneStatus;
};

/**
 * P5-D-N-008 — Super Admin PSP / integrations plane status (UI-03).
 */
export function ClubPspStatus({
  workspaceType,
  paymentMode,
  gatewayProvider,
  integrationsPlane,
}: ClubPspStatusProps) {
  const surfaceStatus = resolveClubPspSurfaceStatus({
    workspaceType,
    paymentMode,
    gatewayProvider,
    integrationsPlane,
  });
  const surfaceLabel = clubPspSurfaceStatusLabel(surfaceStatus);

  return (
    <div
      className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2"
      data-testid="platform-club-psp-status"
      data-psp-surface-status={surfaceStatus}
      data-psp-workspace-type={workspaceType}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">PSP status</span>
        <span className="font-medium">{surfaceLabel}</span>
        {paymentMode === "gateway" && gatewayProvider ? (
          <span className="text-muted-foreground" data-psp-gateway-provider>
            Provider: {gatewayProvider}
          </span>
        ) : null}
      </div>

      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2" data-psp-plane-checklist>
        <li data-psp-check="egress">Egress guard: ready</li>
        <li data-psp-check="zibal" data-psp-check-state={integrationsPlane.zibalConfigured ? "ok" : "missing"}>
          Zibal: {integrationsPlane.zibalConfigured ? "configured" : "not configured"}
        </li>
        <li
          data-psp-check="stripe"
          data-psp-check-state={integrationsPlane.stripeConfigured ? "ok" : "missing"}
        >
          Stripe v2: {integrationsPlane.stripeConfigured ? "configured" : "not configured"}
        </li>
        <li
          data-psp-check="webhook"
          data-psp-check-state={integrationsPlane.webhookConfigured ? "ok" : "missing"}
        >
          Webhook ingress: {integrationsPlane.webhookConfigured ? "configured" : "not configured"}
        </li>
        <li
          data-psp-check="gateway-activation"
          data-psp-check-state={integrationsPlane.gatewayActivationEnabled ? "ok" : "blocked"}
        >
          Gateway activation:{" "}
          {integrationsPlane.gatewayActivationEnabled ? "enabled" : "blocked (GU-02)"}
        </li>
      </ul>
    </div>
  );
}
