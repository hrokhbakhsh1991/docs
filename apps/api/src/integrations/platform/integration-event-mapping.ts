import type { IntegrationCapability } from "./integration-capability";
import { isIntegrationCapability } from "./integration-capability";
import type { IntegrationProviderId } from "./integration-provider.types";
import { resolveIntegrationSurfaceForWorkspaceType } from "./resolve-integration-surface";

export type IntegrationEventMapping = {
  readonly eventType: string;
  readonly capability: IntegrationCapability;
  readonly providers: readonly IntegrationProviderId[];
};

export function integrationMappingsForEvent(
  eventType: string,
  workspaceType: string | null
): readonly IntegrationEventMapping[] {
  const surface = resolveIntegrationSurfaceForWorkspaceType(workspaceType);
  if (surface === null) {
    return [];
  }

  const grouped = new Map<string, IntegrationEventMapping>();

  for (const provider of surface.providers) {
    const providerId = provider.id as IntegrationProviderId;
    for (const mapping of provider.eventMappings) {
      if (mapping.eventType !== eventType) {
        continue;
      }
      if (!isIntegrationCapability(mapping.capability)) {
        continue;
      }
      const key = `${mapping.eventType}:${mapping.capability}`;
      const existing = grouped.get(key);
      if (existing === undefined) {
        grouped.set(key, {
          eventType: mapping.eventType,
          capability: mapping.capability,
          providers: [providerId],
        });
        continue;
      }
      if (!existing.providers.includes(providerId)) {
        grouped.set(key, {
          ...existing,
          providers: [...existing.providers, providerId],
        });
      }
    }
  }

  return [...grouped.values()];
}
