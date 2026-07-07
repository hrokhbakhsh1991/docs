"use client";

export type ClubCommerceBadgeProps = {
  readonly workspaceType: string;
  readonly paymentMode?: "offline_receipt" | "gateway";
  readonly gatewayProvider?: "zibal" | "stripe" | null;
};

export function isDenaliWorkspaceType(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() === "denali";
}

export function shouldShowClubCommerceGatewayUi(workspaceType: string): boolean {
  return !isDenaliWorkspaceType(workspaceType);
}

/**
 * P5-C-N-006 — Super Admin commerce badge on club workspace tab.
 * Denali clubs: read-only offline_receipt (UI-02). Non-Denali: show payment mode badge.
 */
export function ClubCommerceBadge({
  workspaceType,
  paymentMode = "offline_receipt",
  gatewayProvider = null,
}: ClubCommerceBadgeProps) {
  const denaliFrozen = isDenaliWorkspaceType(workspaceType);
  const resolvedMode = denaliFrozen ? "offline_receipt" : paymentMode;
  const gatewayUi = shouldShowClubCommerceGatewayUi(workspaceType) ? "visible" : "hidden";

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
      data-testid="platform-club-commerce-badge"
      data-commerce-payment-mode={resolvedMode}
      data-commerce-gateway-ui={gatewayUi}
      data-commerce-denali-frozen={denaliFrozen ? "true" : "false"}
    >
      <span className="text-muted-foreground">Club payment</span>
      <span className="font-medium">{resolvedMode.replace("_", " ")}</span>
      {denaliFrozen ? (
        <span className="text-muted-foreground" data-commerce-readonly-note>
          Denali clubs use offline receipt review only.
        </span>
      ) : null}
      {gatewayUi === "visible" && resolvedMode === "gateway" && gatewayProvider ? (
        <span className="text-muted-foreground" data-commerce-gateway-provider>
          Provider: {gatewayProvider}
        </span>
      ) : null}
      {gatewayUi === "hidden" ? (
        <span className="sr-only" data-commerce-gateway-hidden>
          Gateway configuration hidden for Denali workspace type.
        </span>
      ) : null}
    </div>
  );
}
