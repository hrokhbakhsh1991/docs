import type { PublicCatalogRegistrationTransportKind } from "../../catalog/public-catalog-transport-intake";

export type RegistrationRegistrantTarget = "self" | "other";

export type RegistrationIntakeTransport = {
  readonly kind: PublicCatalogRegistrationTransportKind;
  readonly personalCarOccupants?: 1 | 2 | 3;
};

export type RegistrationIntakeRecord = {
  readonly registrantTarget: RegistrationRegistrantTarget | null;
  readonly transportKind: PublicCatalogRegistrationTransportKind | null;
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly nationalId: string | null;
};

function readTransportKind(
  transport: unknown
): PublicCatalogRegistrationTransportKind | null {
  if (typeof transport !== "object" || transport === null) {
    return null;
  }
  const kind = (transport as Record<string, unknown>).kind;
  if (
    kind === "primary" ||
    kind === "personal_car" ||
    kind === "no_car_dong" ||
    kind === "no_car_acquaintance"
  ) {
    return kind;
  }
  return null;
}

function readPersonalCarOccupants(transport: unknown): 1 | 2 | 3 | null {
  if (typeof transport !== "object" || transport === null) {
    return null;
  }
  const occupants = (transport as Record<string, unknown>).personalCarOccupants;
  if (occupants === 1 || occupants === 2 || occupants === 3) {
    return occupants;
  }
  return null;
}

export function parseRegistrationIntakeRecord(
  raw: Readonly<Record<string, unknown>> | undefined
): RegistrationIntakeRecord {
  if (raw === undefined) {
    return {
      registrantTarget: null,
      transportKind: null,
      personalCarOccupants: null,
      nationalId: null,
    };
  }
  const registrantTarget =
    raw.registrantTarget === "self" || raw.registrantTarget === "other"
      ? raw.registrantTarget
      : null;
  const nationalIdRaw = raw.nationalId;
  const nationalId =
    typeof nationalIdRaw === "string" && nationalIdRaw.trim().length > 0
      ? nationalIdRaw.trim()
      : null;
  const transport = raw.transport;
  return {
    registrantTarget,
    transportKind: readTransportKind(transport),
    personalCarOccupants: readPersonalCarOccupants(transport),
    nationalId,
  };
}

export function formatRegistrationIntakeTransportLabel(
  summary: RegistrationIntakeRecord,
  labels: {
    readonly primary: string;
    readonly personalCar: string;
    readonly noCarDong: string;
    readonly noCarAcquaintance: string;
    readonly occupants: (count: 1 | 2 | 3) => string;
  }
): string | null {
  if (summary.transportKind === null) {
    return null;
  }
  switch (summary.transportKind) {
    case "primary":
      return labels.primary;
    case "personal_car": {
      const base = labels.personalCar;
      if (summary.personalCarOccupants === null) {
        return base;
      }
      return `${base} · ${labels.occupants(summary.personalCarOccupants)}`;
    }
    case "no_car_dong":
      return labels.noCarDong;
    case "no_car_acquaintance":
      return labels.noCarAcquaintance;
    default:
      return null;
  }
}
