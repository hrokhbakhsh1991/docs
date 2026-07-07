import type { PublicCatalogTransportSnapshot } from "@app-tour/workspace-sdk";
import { isPublicCatalogOrganizedTransportMode } from "@app-tour/workspace-sdk";

import type {
  DenaliRegistrationTransportIntake,
  DenaliRegistrationTransportKind,
} from "./schemas/denali-registration-transport.schema";

export type DenaliRegistrationTransportContext = {
  readonly transport: PublicCatalogTransportSnapshot | undefined;
};

export function defaultDenaliRegistrationTransportKind(
  _transport: PublicCatalogTransportSnapshot | undefined
): DenaliRegistrationTransportKind {
  return "primary";
}

export function normalizeDenaliRegistrationTransportIntake(
  input: DenaliRegistrationTransportIntake | undefined,
  context: DenaliRegistrationTransportContext
): DenaliRegistrationTransportIntake {
  const transport = context.transport;
  const mode = transport?.mode ?? "none";
  const allowPersonalCar = transport?.allowPersonalCar === true;

  if (mode === "shared_cars") {
    if (input === undefined) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
    if (input.kind === "primary") {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
  } else if (!allowPersonalCar) {
    return { kind: "primary" };
  } else if (input === undefined || input.kind === "primary") {
    return { kind: "primary" };
  }

  const kind = input?.kind;
  if (kind === undefined) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }

  if (kind === "personal_car") {
    const occupants = input.personalCarOccupants;
    if (occupants !== 1 && occupants !== 2 && occupants !== 3) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
    return { kind: "personal_car", personalCarOccupants: occupants };
  }

  if (kind === "no_car_dong") {
    const dongAmount = transport?.dongAmount;
    if (dongAmount === null || dongAmount === undefined || dongAmount <= 0) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
    return { kind: "no_car_dong" };
  }

  if (kind === "no_car_acquaintance") {
    return { kind: "no_car_acquaintance" };
  }

  throw new Error("DENALI_REGISTRATION_INVALID");
}

export function requiresDenaliRegistrationTransportDeclaration(
  transport: PublicCatalogTransportSnapshot | undefined
): boolean {
  if (transport === undefined) {
    return false;
  }
  if (transport.mode === "shared_cars") {
    return true;
  }
  return transport.allowPersonalCar === true;
}

export function estimateDenaliRegistrationPricePerPerson(input: {
  readonly basePrice: number | null;
  readonly transport: PublicCatalogTransportSnapshot | undefined;
  readonly intake: DenaliRegistrationTransportIntake;
}): number | null {
  if (input.basePrice === null) {
    return null;
  }
  const base = input.basePrice;
  const transport = input.transport;
  const transportCost = transport?.transportCostAmount ?? 0;
  const dongAmount = transport?.dongAmount ?? 0;

  switch (input.intake.kind) {
    case "primary":
      if (
        transport !== undefined &&
        isPublicCatalogOrganizedTransportMode(transport.mode)
      ) {
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
