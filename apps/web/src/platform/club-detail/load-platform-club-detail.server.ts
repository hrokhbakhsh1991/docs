import type { PlatformClubDetail } from "./platform-club-detail.types";
import { resolveIntegrationsPlaneStatusFromEnv } from "../resolve-integrations-plane-status.server";

export async function loadPlatformClubDetailFromResponse(
  response: Response
): Promise<PlatformClubDetail | null> {
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to load club detail");
  }
  const body = (await response.json()) as PlatformClubDetail;
  if (!body?.tenant?.id) {
    throw new Error("Invalid club detail response");
  }
  return {
    ...body,
    siteSurfaces: body.siteSurfaces ?? {
      admin: true,
      marketing: true,
      portal: true,
    },
    offboardingStartedAt: body.offboardingStartedAt ?? null,
    scheduledDeletionAt: body.scheduledDeletionAt ?? null,
    workspaceDefinition: body.workspaceDefinition ?? null,
    workspaceCommerce: body.workspaceCommerce ?? {
      paymentMode: "offline_receipt",
      gatewayProvider: null,
      currency: "",
    },
    integrationsPlane: body.integrationsPlane ?? resolveIntegrationsPlaneStatusFromEnv(),
  };
}
