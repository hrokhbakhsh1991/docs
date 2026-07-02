import type { PublicCatalogTransportSnapshot } from "@app-tour/workspace-sdk";
import {
  isPublicCatalogOrganizedTransportMode,
  type PublicCatalogRegistrationTransportKind,
  type PublicCatalogTransportIntakeState,
  type WorkspaceCatalogIntakeTransportSurface,
} from "@app-tour/workspace-sdk";

function showTransportFollowUp(
  transport: PublicCatalogTransportSnapshot | undefined,
  state: PublicCatalogTransportIntakeState
): boolean {
  if (transport === undefined) {
    return false;
  }
  if (transport.mode === "shared_cars") {
    return true;
  }
  return state.optInPersonalCar;
}

function buildPayload(
  transport: PublicCatalogTransportSnapshot | undefined,
  state: PublicCatalogTransportIntakeState
):
  | {
      readonly kind: PublicCatalogRegistrationTransportKind;
      readonly personalCarOccupants?: 1 | 2 | 3;
    }
  | undefined {
  if (!showTransportFollowUp(transport, state)) {
    return undefined;
  }

  if (state.hasPersonalCar === true) {
    if (
      state.personalCarOccupants !== 1 &&
      state.personalCarOccupants !== 2 &&
      state.personalCarOccupants !== 3
    ) {
      return undefined;
    }
    return { kind: "personal_car", personalCarOccupants: state.personalCarOccupants };
  }

  if (state.hasPersonalCar === false) {
    if (state.paysDong === true) {
      return { kind: "no_car_dong" };
    }
    if (state.paysDong === false) {
      return { kind: "no_car_acquaintance" };
    }
  }

  return undefined;
}

function computePricePerPerson(input: {
  readonly basePrice: number | null;
  readonly transport: PublicCatalogTransportSnapshot | undefined;
  readonly transportKind: PublicCatalogRegistrationTransportKind;
}): number | null {
  if (input.basePrice === null) {
    return null;
  }
  const base = input.basePrice;
  const transport = input.transport;
  const transportCost = transport?.transportCostAmount ?? 0;
  const dongAmount = transport?.dongAmount ?? 0;

  switch (input.transportKind) {
    case "primary":
      if (transport !== undefined && isPublicCatalogOrganizedTransportMode(transport.mode)) {
        return base + transportCost;
      }
      return base;
    case "personal_car":
    case "no_car_acquaintance":
      return base;
    case "no_car_dong":
      return base + dongAmount;
    default:
      return base;
  }
}

export const denaliCatalogTransportIntakeSurface: WorkspaceCatalogIntakeTransportSurface =
  Object.freeze({
    initialState: (transport) => ({
      optInPersonalCar: transport?.mode === "shared_cars",
      hasPersonalCar: transport?.mode === "shared_cars" ? null : null,
      personalCarOccupants: null,
      paysDong: null,
    }),
    showPersonalCarOptIn: (transport) => {
      if (transport === undefined) {
        return false;
      }
      return transport.mode !== "shared_cars" && transport.allowPersonalCar === true;
    },
    showTransportFollowUp: showTransportFollowUp,
    buildPayload,
    isComplete: (transport, state) => {
      if (!showTransportFollowUp(transport, state)) {
        return true;
      }
      return buildPayload(transport, state) !== undefined;
    },
    computePricePerPerson,
  });
