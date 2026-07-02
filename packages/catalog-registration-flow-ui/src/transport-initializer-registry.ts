import type {
  PublicCatalogTransportIntakeState,
  RegistrationFlowContext,
} from "@app-tour/workspace-sdk";

export type CatalogRegistrationTransportInitializer = (
  context: RegistrationFlowContext
) => PublicCatalogTransportIntakeState;

const initializers = new Map<string, CatalogRegistrationTransportInitializer>();

export function registerCatalogRegistrationTransportInitializer(
  pluginId: string,
  initializer: CatalogRegistrationTransportInitializer
): void {
  initializers.set(pluginId, initializer);
}

export function resolveCatalogRegistrationTransportInitialState(
  context: RegistrationFlowContext
): PublicCatalogTransportIntakeState {
  const initializer = initializers.get(context.pluginId);
  if (initializer === undefined) {
    return {
      optInPersonalCar: false,
      hasPersonalCar: null,
      personalCarOccupants: null,
      paysDong: null,
    };
  }
  return initializer(context);
}

/** Test-only reset — never call from production code paths. */
export function clearCatalogRegistrationTransportInitializersForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  initializers.clear();
}
