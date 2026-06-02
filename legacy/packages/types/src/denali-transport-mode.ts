/**
 * Denali wizard MVP transport modes (form + validation).
 * Maps to API `logistics` / `transportModes` in the web mapper — no RHF side effects.
 */

export const DENALI_TRANSPORT_MODE_VALUES = [
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
] as const;

export type DenaliTransportMode = (typeof DENALI_TRANSPORT_MODE_VALUES)[number];

const DENALI_TRANSPORT_MODE_SET = new Set<string>(DENALI_TRANSPORT_MODE_VALUES);

export function isDenaliTransportMode(value: unknown): value is DenaliTransportMode {
  return typeof value === "string" && DENALI_TRANSPORT_MODE_SET.has(value);
}

/** Legacy wizard / preset JSON before transport MVP simplification. */
export type LegacyDenaliTransportFormFields = {
  primaryTransportMode?: string;
  primaryTransportDescription?: string;
  privateCarAllowed?: boolean;
  privateCarMode?: string;
  dongAmountPerSeat?: number;
  transportNotes?: string;
  /** New shape (passthrough). */
  transportMode?: DenaliTransportMode;
  transportCost?: number;
  allowPersonalCar?: boolean;
  dongAmount?: number;
};

export type DenaliTransportFormFields = {
  transportMode: DenaliTransportMode;
  transportCost?: number;
  allowPersonalCar?: boolean;
  dongAmount?: number;
  transportNotes?: string;
};

/**
 * Normalizes transport section from draft/preset/clone — accepts legacy or new keys.
 */
export function normalizeDenaliTransportForm(
  raw: LegacyDenaliTransportFormFields | null | undefined,
): DenaliTransportFormFields {
  if (raw != null && isDenaliTransportMode(raw.transportMode)) {
    const dongAmount = raw.dongAmount ?? raw.dongAmountPerSeat ?? undefined;
    const allowPersonalCar = raw.allowPersonalCar ?? raw.privateCarAllowed ?? undefined;
    const hasPersonalCarOption =
      raw.transportMode === "bus" ||
      raw.transportMode === "minibus" ||
      raw.transportMode === "train";
    return {
      transportMode: raw.transportMode,
      transportCost: raw.transportCost,
      allowPersonalCar: hasPersonalCarOption
        ? allowPersonalCar === true
          ? true
          : undefined
        : undefined,
      dongAmount:
        raw.transportMode === "shared_cars"
          ? dongAmount
          : hasPersonalCarOption && allowPersonalCar === true
            ? dongAmount
            : undefined,
      transportNotes: trimOptional(raw.transportNotes),
    };
  }
  return migrateLegacyDenaliTransportForm(raw ?? {});
}

/**
 * Maps pre-MVP wizard transport fields → {@link DenaliTransportFormFields}.
 */
function legacyPrimaryToWizardMode(primary: string): DenaliTransportMode {
  if (primary === "bus") return "bus";
  if (primary === "midibus" || primary === "minibus") return "minibus";
  if (primary === "train") return "train";
  if (primary === "none") return "none";
  return "organizer_vehicle";
}

export function migrateLegacyDenaliTransportForm(
  legacy: LegacyDenaliTransportFormFields,
): DenaliTransportFormFields {
  if (legacy.primaryTransportMode === "none") {
    return {
      transportMode: "none",
      transportNotes: trimOptional(legacy.transportNotes ?? legacy.primaryTransportDescription),
    };
  }

  const dong = legacy.dongAmountPerSeat ?? legacy.dongAmount;
  const primary = typeof legacy.primaryTransportMode === "string"
    ? legacy.primaryTransportMode.trim()
    : "";
  const wantsPersonalCar =
    legacy.privateCarAllowed === true ||
    legacy.primaryTransportMode === "private_car" ||
    legacy.privateCarMode === "car_share_fixed_dong" ||
    legacy.privateCarMode === "driver_gets_dong" ||
    (dong != null && dong > 0);

  if (
    primary === "bus" ||
    primary === "midibus" ||
    primary === "minibus" ||
    primary === "train"
  ) {
    const transportMode = legacyPrimaryToWizardMode(primary);
    return {
      transportMode,
      allowPersonalCar: wantsPersonalCar ? true : undefined,
      dongAmount: wantsPersonalCar ? dong : undefined,
      transportNotes: trimOptional(legacy.transportNotes ?? legacy.primaryTransportDescription),
    };
  }

  if (
    wantsPersonalCar &&
    primary !== "bus" &&
    primary !== "midibus" &&
    primary !== "minibus" &&
    primary !== "train"
  ) {
    return {
      transportMode: "shared_cars",
      dongAmount: dong,
      transportNotes: trimOptional(legacy.transportNotes ?? legacy.primaryTransportDescription),
    };
  }

  return {
    transportMode: "organizer_vehicle",
    transportNotes: trimOptional(legacy.transportNotes ?? legacy.primaryTransportDescription),
  };
}

/** API / tripDetails logistics → MVP form transport. */
export function inferDenaliTransportModeFromApiLogistics(input: {
  primaryTransportMode?: string | null;
  privateCarMode?: string | null;
  fuelShareToman?: number | null;
  transportationNotes?: string | null;
  rootTransportModes?: readonly string[] | null;
}): DenaliTransportFormFields {
  const primary = typeof input.primaryTransportMode === "string" ? input.primaryTransportMode.trim() : "";
  const modes = input.rootTransportModes ?? [];
  const hasPrivateCar =
    primary === "private_car" ||
    modes.includes("private_car") ||
    input.privateCarMode === "car_share_fixed_dong" ||
    input.privateCarMode === "driver_gets_dong";
  const fuel =
    typeof input.fuelShareToman === "number" && Number.isFinite(input.fuelShareToman)
      ? input.fuelShareToman
      : undefined;
  const notes = trimOptional(input.transportationNotes);

  if (primary === "none" || (modes.length === 0 && !primary)) {
    return { transportMode: "none", transportNotes: notes };
  }
  if (primary === "bus" || primary === "midibus" || primary === "train") {
    const transportMode =
      primary === "midibus" ? "minibus" : primary === "train" ? "train" : "bus";
    const allowPersonalCar = hasPrivateCar || fuel != null;
    return {
      transportMode,
      allowPersonalCar: allowPersonalCar ? true : undefined,
      dongAmount: allowPersonalCar ? fuel : undefined,
      transportNotes: notes,
    };
  }

  if (hasPrivateCar || fuel != null) {
    return { transportMode: "shared_cars", dongAmount: fuel, transportNotes: notes };
  }
  return { transportMode: "organizer_vehicle", transportNotes: notes };
}

function trimOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t === "" ? undefined : t;
}

/**
 * Submit/publish gate value for classic path `logistics.primaryTransportMode`.
 * Denali `transportMode === "none"` (or empty root modes with no primary) satisfies the requirement.
 */
export function denaliPrimaryTransportSubmitValue(input: {
  primaryTransportMode?: string | null;
  rootTransportModes?: readonly string[] | null;
  denaliTransportMode?: DenaliTransportMode | null;
}): string | undefined {
  if (input.denaliTransportMode === "none") {
    return "none";
  }
  const primary =
    typeof input.primaryTransportMode === "string" ? input.primaryTransportMode.trim() : "";
  if (primary !== "") {
    return primary;
  }
  const modes = input.rootTransportModes ?? [];
  if (modes.length === 0) {
    return "none";
  }
  return undefined;
}
