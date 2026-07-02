import type { PublicCatalogTransportSnapshot } from "../tour/public-catalog-transport";

export type PublicCatalogRegistrationTransportKind =
  | "primary"
  | "personal_car"
  | "no_car_dong"
  | "no_car_acquaintance";

export const PUBLIC_CATALOG_REGISTRATION_TRANSPORT_KINDS = [
  "primary",
  "personal_car",
  "no_car_dong",
  "no_car_acquaintance",
] as const;

export type PublicCatalogTransportIntakeState = {
  readonly optInPersonalCar: boolean;
  readonly hasPersonalCar: boolean | null;
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly paysDong: boolean | null;
};

/** Workspace-owned transport intake helpers (optional on catalogIntake). */
export type WorkspaceCatalogIntakeTransportSurface = {
  readonly initialState: (
    transport: PublicCatalogTransportSnapshot | undefined
  ) => PublicCatalogTransportIntakeState;
  readonly showPersonalCarOptIn: (
    transport: PublicCatalogTransportSnapshot | undefined
  ) => boolean;
  readonly showTransportFollowUp: (
    transport: PublicCatalogTransportSnapshot | undefined,
    state: PublicCatalogTransportIntakeState
  ) => boolean;
  readonly buildPayload: (
    transport: PublicCatalogTransportSnapshot | undefined,
    state: PublicCatalogTransportIntakeState
  ) =>
    | {
        readonly kind: PublicCatalogRegistrationTransportKind;
        readonly personalCarOccupants?: 1 | 2 | 3;
      }
    | undefined;
  readonly isComplete: (
    transport: PublicCatalogTransportSnapshot | undefined,
    state: PublicCatalogTransportIntakeState
  ) => boolean;
  readonly computePricePerPerson: (input: {
    readonly basePrice: number | null;
    readonly transport: PublicCatalogTransportSnapshot | undefined;
    readonly transportKind: PublicCatalogRegistrationTransportKind;
  }) => number | null;
};
