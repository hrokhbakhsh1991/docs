"use client";

import { isWorkspaceCommerceFrozen } from "@app-tour/workspace-sdk/metadata";

export type ClubCommerceBadgeProps = {
  readonly workspaceType: string;
  readonly paymentMode?: "offline_receipt" | "gateway";
  readonly gatewayProvider?: "zibal" | "stripe" | null;
};

export function shouldShowClubCommerceGatewayUi(workspaceType: string): boolean {
  return !isWorkspaceCommerceFrozen(workspaceType);
}

/**
 * P5-C-N-006 — Super Admin commerce badge on club workspace tab.
 * Frozen commerce workspaces (manifest): read-only offline_receipt (UI-02 · Wave H.f neutral copy).
 */
export function ClubCommerceBadge({
  workspaceType,
  paymentMode = "offline_receipt",
  gatewayProvider = null,
}: ClubCommerceBadgeProps) {
  const commerceFrozen = isWorkspaceCommerceFrozen(workspaceType);
  const resolvedMode = commerceFrozen ? "offline_receipt" : paymentMode;
  const gatewayUi = shouldShowClubCommerceGatewayUi(workspaceType) ? "visible" : "hidden";

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
      data-testid="platform-club-commerce-badge"
      data-commerce-payment-mode={resolvedMode}
      data-commerce-gateway-ui={gatewayUi}
      data-commerce-frozen={commerceFrozen ? "true" : "false"}
    >
      <span className="text-muted-foreground">Club payment</span>
      <span className="font-medium">{resolvedMode.replace("_", " ")}</span>
      {commerceFrozen ? (
        <span className="text-muted-foreground" data-commerce-readonly-note>
          Frozen commerce workspaces use offline receipt review only.
        </span>
      ) : null}
      {gatewayUi === "visible" && resolvedMode === "gateway" && gatewayProvider ? (
        <span className="text-muted-foreground" data-commerce-gateway-provider>
          Provider: {gatewayProvider}
        </span>
      ) : null}
      {gatewayUi === "hidden" ? (
        <span className="sr-only" data-commerce-gateway-hidden>
          Gateway configuration hidden for frozen-commerce workspace type.
        </span>
      ) : null}
    </div>
  );
}
