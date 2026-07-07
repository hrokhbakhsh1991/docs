import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
} from "@/integrations/integrations-types";

function isDeprecatedEventPolicy(
  policy: IntegrationConnectionPublic["eventPolicies"][number],
): boolean {
  return policy.deprecated === true;
}

function deprecatedEventTypes(
  policies: IntegrationConnectionPublic["eventPolicies"],
): ReadonlySet<string> {
  const deprecated = new Set<string>();
  for (const policy of policies) {
    if (isDeprecatedEventPolicy(policy) && policy.eventType.length > 0) {
      deprecated.add(policy.eventType);
    }
  }
  return deprecated;
}

function addRoutableEventType(seen: Set<string>, eventType: string, deprecated: ReadonlySet<string>): void {
  if (eventType.length === 0 || deprecated.has(eventType)) {
    return;
  }
  seen.add(eventType);
}

/** Event types exposed in exposure UI for a connection (policies, intents, provider defaults). */
export function buildExposureEventTypeList(
  connection: IntegrationConnectionPublic,
  providerSurface: IntegrationProviderSurfaceMeta | null,
): readonly string[] {
  const seen = new Set<string>();
  const deprecated = deprecatedEventTypes(connection.eventPolicies);

  for (const policy of providerSurface?.defaultEventPolicies ?? []) {
    addRoutableEventType(seen, policy.eventType, deprecated);
  }

  for (const policy of connection.eventPolicies) {
    if (!isDeprecatedEventPolicy(policy)) {
      addRoutableEventType(seen, policy.eventType, deprecated);
    }
  }

  for (const intent of connection.exposureIntents) {
    addRoutableEventType(seen, intent.eventType, deprecated);
    addRoutableEventType(seen, intent.trigger, deprecated);
  }

  if (seen.size === 0 && connection.provider === "telegram") {
    const surfaceDefault = providerSurface?.defaultEventPolicies.find(
      (policy) => policy.enabled,
    )?.eventType;
    seen.add(surfaceDefault ?? "TourPublished");
  }

  return [...seen].sort((left, right) => left.localeCompare(right));
}
