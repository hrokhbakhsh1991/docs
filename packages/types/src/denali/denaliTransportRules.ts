import type { DenaliCanonicalTransportMode } from "./denaliCanonicalTourModel";

/** Organizer-arranged transport (not participant-only shared cars). */
export function isDenaliOrganizedTransportMode(
  mode: DenaliCanonicalTransportMode | undefined,
): boolean {
  return (
    mode === "organizer_vehicle" ||
    mode === "bus" ||
    mode === "minibus" ||
    mode === "train"
  );
}

/** Bus, minibus, or train — optional personal-car permission checkbox. */
export function isDenaliOrganizedTransportWithPersonalCarOption(
  mode: DenaliCanonicalTransportMode | undefined,
): boolean {
  return mode === "bus" || mode === "minibus" || mode === "train";
}

/** @deprecated Use {@link isDenaliOrganizedTransportWithPersonalCarOption} */
export const isDenaliOrganizedBusTransportMode = isDenaliOrganizedTransportWithPersonalCarOption;

export function isDenaliAllowPersonalCarVisible(
  mode: DenaliCanonicalTransportMode | undefined,
): boolean {
  return isDenaliOrganizedTransportWithPersonalCarOption(mode);
}

/** Organizer transport fee (هزینه حمل‌ونقل) — not دنگ. */
export function isDenaliTransportCostVisible(
  mode: DenaliCanonicalTransportMode | undefined,
): boolean {
  return isDenaliOrganizedTransportMode(mode);
}

export function isDenaliTransportDongAmountVisible(input: {
  mode: DenaliCanonicalTransportMode;
  allowPersonalCar?: boolean;
}): boolean {
  if (input.mode === "shared_cars") return true;
  return (
    isDenaliOrganizedTransportWithPersonalCarOption(input.mode) &&
    input.allowPersonalCar === true
  );
}

export function isDenaliTransportDongAmountRequired(input: {
  mode: DenaliCanonicalTransportMode;
  allowPersonalCar?: boolean;
}): boolean {
  return isDenaliTransportDongAmountVisible(input);
}

/** Train-only: seat preference intake (window / aisle / any). */
export function isDenaliSeatPreferenceVisible(
  mode: DenaliCanonicalTransportMode | undefined,
): boolean {
  return mode === "train";
}

export function isDenaliSeatPreferenceRequired(
  mode: DenaliCanonicalTransportMode | undefined,
): boolean {
  return isDenaliSeatPreferenceVisible(mode);
}
