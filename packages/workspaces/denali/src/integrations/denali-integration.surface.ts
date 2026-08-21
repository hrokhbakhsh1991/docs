import {
  validateIntegrationSurface,
  type WorkspaceCanonicalDeliveryProjectionInput,
  type WorkspaceIntegrationSurface,
} from "@app-tour/workspace-sdk";
import { getCanonicalValue } from "@app-tour/platform-core";

const DENALI_LOCATION_ZONES_FIELD_ID = "denali.location-zones";
const DENALI_LOCATION_ZONE_PATHS = ["startPoint", "summitPoint", "campPoint", "endPoint"] as const;
const DENALI_LOCATION_ZONE_OVERVIEW_PREFIX = "tripDetails.overview";

function coerceLocationDataToDeliveryString(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (label.length > 0) {
    return label;
  }
  const address = typeof record.address === "string" ? record.address.trim() : "";
  return address.length > 0 ? address : undefined;
}

function projectDenaliLocationZones(input: WorkspaceCanonicalDeliveryProjectionInput): Readonly<Record<string, string>> {
  if (!input.eligibleFieldIds.includes(DENALI_LOCATION_ZONES_FIELD_ID)) {
    return {};
  }
  const labels: string[] = [];
  for (const zonePath of DENALI_LOCATION_ZONE_PATHS) {
    const fromRoot = coerceLocationDataToDeliveryString(getCanonicalValue(input.payload, zonePath));
    const value =
      fromRoot ??
      coerceLocationDataToDeliveryString(
        getCanonicalValue(input.payload, `${DENALI_LOCATION_ZONE_OVERVIEW_PREFIX}.${zonePath}`)
      );
    if (value !== undefined && !labels.includes(value)) {
      labels.push(value);
    }
  }
  return labels.length === 0 ? {} : { [DENALI_LOCATION_ZONES_FIELD_ID]: labels.join("، ") };
}

export const denaliIntegrationSurface = Object.freeze({
  manifestVersion: 1 as const,
  providers: [
    {
      id: "telegram",
      configFields: [{ id: "channelId", kind: "string" as const, requiredOnCreate: true }],
      credentialFields: [{ id: "botToken", kind: "secret" as const, requiredOnCreate: true }],
      defaultCapabilities: ["message.send"] as const,
      defaultEventPolicies: [{ eventType: "TourPublished", enabled: true }],
      eventMappings: [{ eventType: "TourPublished", capability: "message.send" }],
    },
  ],
  messageTemplates: {
    TourPublished: "Tour published: {{title}}",
  },
  projectCanonicalDeliveryFields: projectDenaliLocationZones,
}) satisfies WorkspaceIntegrationSurface;

validateIntegrationSurface(denaliIntegrationSurface);

export function getDenaliIntegrationSurface(): WorkspaceIntegrationSurface {
  return denaliIntegrationSurface;
}
