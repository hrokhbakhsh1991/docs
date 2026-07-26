import type { WorkspaceIntegrationSurface } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../../workspace/resolve-workspace-plugin";

export async function resolveIntegrationSurfaceForWorkspaceType(
  workspaceType: string | null
): Promise<WorkspaceIntegrationSurface | null> {
  if (workspaceType === null || workspaceType.trim().length === 0) {
    return null;
  }
  try {
    const plugin = await resolveWorkspacePluginForType(workspaceType);
    return plugin.integrationSurface ?? null;
  } catch {
    return null;
  }
}

export async function resolveIntegrationProviderSurface(input: {
  readonly workspaceType: string | null;
  readonly providerId: string;
}) {
  const surface = await resolveIntegrationSurfaceForWorkspaceType(input.workspaceType);
  if (surface === null) {
    return null;
  }
  return surface.providers.find((provider) => provider.id === input.providerId) ?? null;
}

export async function isDefaultIntegrationEventEnabled(input: {
  readonly workspaceType: string | null;
  readonly providerId: string;
  readonly eventType: string;
}): Promise<boolean> {
  const providerSurface = await resolveIntegrationProviderSurface({
    workspaceType: input.workspaceType,
    providerId: input.providerId,
  });
  if (providerSurface === null) {
    return false;
  }
  const policy = providerSurface.defaultEventPolicies.find(
    (entry) => entry.eventType === input.eventType
  );
  return policy?.enabled === true;
}

export async function defaultIntegrationEventTypesForProvider(input: {
  readonly workspaceType: string | null;
  readonly providerId: string;
}): Promise<readonly string[]> {
  const providerSurface = await resolveIntegrationProviderSurface({
    workspaceType: input.workspaceType,
    providerId: input.providerId,
  });
  if (providerSurface === null) {
    return [];
  }
  return providerSurface.defaultEventPolicies
    .filter((policy) => policy.enabled)
    .map((policy) => policy.eventType);
}
