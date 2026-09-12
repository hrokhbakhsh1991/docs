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

/** Organized transport requires an explicit acknowledgement when personal-car details are not selected. */
export function requiresDenaliNonPersonalCarAcknowledgement(
  transport: PublicCatalogTransportSnapshot | undefined
): boolean {
  return transport !== undefined && isPublicCatalogOrganizedTransportMode(transport.mode);
}

export function isDenaliIntakeDongOffered(
  transport: PublicCatalogTransportSnapshot | undefined
): boolean {
  const amount = transport?.dongAmount;
  return typeof amount === "number" && amount > 0;
}

function buildPayload(
  transport: PublicCatalogTransportSnapshot | undefined,
  state: PublicCatalogTransportIntakeState
):
  | {
      readonly kind: PublicCatalogRegistrationTransportKind;
      readonly personalCarOccupants?: 0 | 1 | 2 | 3;
    }
  | undefined {
  const nonPersonalCarAcknowledgementRequired =
    requiresDenaliNonPersonalCarAcknowledgement(transport) && !state.optInPersonalCar;

  if (nonPersonalCarAcknowledgementRequired && !state.nonPersonalCarAcknowledged) {
    return undefined;
  }

  if (!showTransportFollowUp(transport, state)) {
    return nonPersonalCarAcknowledgementRequired ? { kind: "primary" } : undefined;
  }

  if (state.hasPersonalCar === null && nonPersonalCarAcknowledgementRequired) {
    return { kind: "primary" };
  }

  if (state.hasPersonalCar === true) {
    if (
      state.personalCarOccupants !== 0 &&
      state.personalCarOccupants !== 1 &&
      state.personalCarOccupants !== 2 &&
      state.personalCarOccupants !== 3
    ) {
      return undefined;
    }
    return { kind: "personal_car", personalCarOccupants: state.personalCarOccupants };
  }

  if (state.hasPersonalCar === false) {
    if (!state.nonPersonalCarAcknowledged) {
      return undefined;
    }
    if (!isDenaliIntakeDongOffered(transport)) {
      return { kind: "no_car_acquaintance" };
    }
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
      nonPersonalCarAcknowledged: false,
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
      if (
        requiresDenaliNonPersonalCarAcknowledgement(transport) &&
        !state.optInPersonalCar &&
        !state.nonPersonalCarAcknowledged
      ) {
        return false;
      }
      if (!showTransportFollowUp(transport, state)) {
        return true;
      }
      return buildPayload(transport, state) !== undefined;
    },
    computePricePerPerson,
  });
