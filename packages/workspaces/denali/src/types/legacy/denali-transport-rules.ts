export type DenaliCanonicalTransportMode =
  | "organizer_vehicle"
  | "bus"
  | "minibus"
  | "train"
  | "shared_cars"
  | "none";

export function isDenaliOrganizedTransportMode(
  mode: DenaliCanonicalTransportMode | undefined
): boolean {
  return mode === "organizer_vehicle" || mode === "bus" || mode === "minibus" || mode === "train";
}

export function isDenaliOrganizedTransportWithPersonalCarOption(
  mode: DenaliCanonicalTransportMode | undefined
): boolean {
  return mode === "bus" || mode === "minibus" || mode === "train";
}

export function isDenaliAllowPersonalCarVisible(
  mode: DenaliCanonicalTransportMode | undefined
): boolean {
  return isDenaliOrganizedTransportWithPersonalCarOption(mode);
}

export function isDenaliTransportCostVisible(
  mode: DenaliCanonicalTransportMode | undefined
): boolean {
  return isDenaliOrganizedTransportMode(mode);
}

export function isDenaliTransportDongAmountVisible(input: {
  mode: DenaliCanonicalTransportMode;
  allowPersonalCar?: boolean;
}): boolean {
  if (input.mode === "shared_cars") return true;
  return (
    isDenaliOrganizedTransportWithPersonalCarOption(input.mode) && input.allowPersonalCar === true
  );
}

export function isDenaliTransportDongAmountRequired(input: {
  mode: DenaliCanonicalTransportMode;
  allowPersonalCar?: boolean;
}): boolean {
  return isDenaliTransportDongAmountVisible(input);
}

export function isDenaliAdminCapacityApprovalVisible(input: {
  mode: DenaliCanonicalTransportMode;
  allowPersonalCar?: boolean;
}): boolean {
  return (
    isDenaliOrganizedTransportWithPersonalCarOption(input.mode) && input.allowPersonalCar === true
  );
}

export function isDenaliSeatPreferenceVisible(
  mode: DenaliCanonicalTransportMode | undefined
): boolean {
  return mode === "train";
}

export function isDenaliSeatPreferenceRequired(
  mode: DenaliCanonicalTransportMode | undefined
): boolean {
  return isDenaliSeatPreferenceVisible(mode);
}
