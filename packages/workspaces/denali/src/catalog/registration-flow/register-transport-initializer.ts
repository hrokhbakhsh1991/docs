import { registerCatalogRegistrationTransportInitializer } from "@app-tour/catalog-registration-flow-ui";

import { denaliCatalogTransportIntakeSurface } from "../denali-catalog-transport-intake";

export function registerDenaliCatalogRegistrationTransportInitializer(): void {
  registerCatalogRegistrationTransportInitializer("denali", (context) =>
    denaliCatalogTransportIntakeSurface.initialState(context.tourTransport)
  );
}
