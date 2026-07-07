import type {
  IntegrationProviderAdapter,
  IntegrationProviderId,
} from "./integration-provider.types";

const adapters = new Map<IntegrationProviderId, IntegrationProviderAdapter>();

export function registerIntegrationProvider(adapter: IntegrationProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getIntegrationProvider(
  providerId: IntegrationProviderId
): IntegrationProviderAdapter | undefined {
  return adapters.get(providerId);
}

export function listIntegrationProviders(): readonly IntegrationProviderAdapter[] {
  return [...adapters.values()];
}

/** Test-only — reset registry between specs. */
export function resetIntegrationProviderRegistryForTests(): void {
  adapters.clear();
}
