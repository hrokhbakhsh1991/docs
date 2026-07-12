import { integrationMappingsForEvent } from "./integration-event-mapping";
import type { IntegrationProviderId } from "./integration-provider.types";
import {
  resolveIntegrationDeprecatedEventSupersededBy,
} from "./workspace-integration-capabilities.generated.ts";
import {
  resolveIntegrationProviderSurface,
} from "./resolve-integration-surface";

export type PersistedIntegrationEventPolicy = {
  readonly eventType: string;
  readonly enabled: boolean;
};

export type EffectiveIntegrationEventCatalogEntry = {
  readonly eventType: string;
  readonly declaredOnSurface: boolean;
  readonly enabled: boolean;
  readonly deprecated: boolean;
  readonly supersededBy?: string;
  readonly routingActive: boolean;
};

export type IntegrationConnectionPublicEventPolicy = {
  readonly eventType: string;
  readonly enabled: boolean;
  readonly deprecated?: boolean;
  readonly supersededBy?: string;
};

function isDeprecatedIntegrationEvent(input: {
  readonly eventType: string;
  readonly workspaceType: string | null;
  readonly providerId: string;
}): string | undefined {
  const supersededBy = resolveIntegrationDeprecatedEventSupersededBy(
    input.workspaceType,
    input.providerId,
    input.eventType
  );
  if (supersededBy === undefined) {
    return undefined;
  }
  if (integrationMappingsForEvent(input.eventType, input.workspaceType).length > 0) {
    return undefined;
  }
  return supersededBy;
}

function routingActiveForEvent(
  eventType: string,
  workspaceType: string | null,
): boolean {
  return integrationMappingsForEvent(eventType, workspaceType).length > 0;
}

/**
 * Stripe-style effective catalog: surface declares product events; persisted policies
 * override enablement. Deprecated persisted rows remain visible for migration UX.
 */
export function resolveEffectiveIntegrationEventCatalog(input: {
  readonly workspaceType: string | null;
  readonly providerId: IntegrationProviderId | string;
  readonly persistedPolicies: readonly PersistedIntegrationEventPolicy[];
}): readonly EffectiveIntegrationEventCatalogEntry[] {
  const providerSurface = resolveIntegrationProviderSurface({
    workspaceType: input.workspaceType,
    providerId: input.providerId,
  });

  const persistedByEvent = new Map<string, PersistedIntegrationEventPolicy>();
  for (const policy of input.persistedPolicies) {
    const eventType = policy.eventType.trim();
    if (eventType.length === 0) {
      continue;
    }
    persistedByEvent.set(eventType, {
      eventType,
      enabled: policy.enabled,
    });
  }

  const entries = new Map<string, EffectiveIntegrationEventCatalogEntry>();

  for (const declared of providerSurface?.defaultEventPolicies ?? []) {
    const eventType = declared.eventType.trim();
    if (eventType.length === 0) {
      continue;
    }
    const persisted = persistedByEvent.get(eventType);
    const supersededBy = isDeprecatedIntegrationEvent({
      eventType,
      workspaceType: input.workspaceType,
      providerId: input.providerId,
    });
    entries.set(eventType, {
      eventType,
      declaredOnSurface: true,
      enabled: persisted?.enabled ?? declared.enabled,
      deprecated: supersededBy !== undefined,
      ...(supersededBy === undefined ? {} : { supersededBy }),
      routingActive: routingActiveForEvent(eventType, input.workspaceType),
    });
  }

  for (const persisted of persistedByEvent.values()) {
    if (entries.has(persisted.eventType)) {
      continue;
    }
    const supersededBy = isDeprecatedIntegrationEvent({
      eventType: persisted.eventType,
      workspaceType: input.workspaceType,
      providerId: input.providerId,
    });
    entries.set(persisted.eventType, {
      eventType: persisted.eventType,
      declaredOnSurface: false,
      enabled: persisted.enabled,
      deprecated: supersededBy !== undefined,
      ...(supersededBy === undefined ? {} : { supersededBy }),
      routingActive: routingActiveForEvent(persisted.eventType, input.workspaceType),
    });
  }

  return [...entries.values()].sort((left, right) =>
    left.eventType.localeCompare(right.eventType),
  );
}

export function mapEffectiveCatalogToPublicEventPolicies(
  catalog: readonly EffectiveIntegrationEventCatalogEntry[],
): readonly IntegrationConnectionPublicEventPolicy[] {
  return catalog.map((entry) => ({
    eventType: entry.eventType,
    enabled: entry.enabled,
    ...(entry.deprecated
      ? {
          deprecated: true,
          ...(entry.supersededBy === undefined ? {} : { supersededBy: entry.supersededBy }),
        }
      : {}),
  }));
}

/** Active delivery routes for admin UI tabs (declared + non-deprecated persisted). */
export function listActiveIntegrationEventTypes(
  catalog: readonly EffectiveIntegrationEventCatalogEntry[],
): readonly string[] {
  const active = catalog.filter((entry) => !entry.deprecated && entry.routingActive);
  if (active.length > 0) {
    return active.map((entry) => entry.eventType);
  }
  return catalog
    .filter((entry) => entry.declaredOnSurface && !entry.deprecated)
    .map((entry) => entry.eventType);
}
