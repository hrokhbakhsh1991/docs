import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
} from "@/integrations/integrations-types";

/** Event types exposed in exposure UI for a connection (policies, intents, provider defaults). */
export function buildExposureEventTypeList(
  connection: IntegrationConnectionPublic,
  providerSurface: IntegrationProviderSurfaceMeta | null,
): readonly string[] {
  const seen = new Set<string>();
  for (const policy of providerSurface?.defaultEventPolicies ?? []) {
    if (policy.eventType.length > 0) {
      seen.add(policy.eventType);
    }
  }
  for (const policy of connection.eventPolicies) {
    if (policy.eventType.length > 0) {
      seen.add(policy.eventType);
    }
  }
  for (const intent of connection.exposureIntents) {
    if (intent.eventType.length > 0) {
      seen.add(intent.eventType);
    }
    if (intent.trigger.length > 0) {
      seen.add(intent.trigger);
    }
  }
  if (seen.size === 0 && connection.provider === "telegram") {
    seen.add("TourCreated");
  }
  return [...seen].sort((left, right) => left.localeCompare(right));
}
