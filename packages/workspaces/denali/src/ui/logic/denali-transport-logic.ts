export type DenaliTransportMode =
  | "organizer_vehicle"
  | "bus"
  | "minibus"
  | "train"
  | "shared_cars"
  | "none";

export const DENALI_TRANSPORT_MODE_VALUES = [
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
] as const satisfies readonly DenaliTransportMode[];

export const DENALI_TRANSPORT_MODE_OPTIONS: readonly { readonly value: DenaliTransportMode }[] =
  DENALI_TRANSPORT_MODE_VALUES.map((value) => ({ value }));

export function parseDenaliTransportMode(value: string): DenaliTransportMode {
  return (DENALI_TRANSPORT_MODE_VALUES as readonly string[]).includes(value)
    ? (value as DenaliTransportMode)
    : "none";
}

export function isDenaliTransportCostVisible(mode: DenaliTransportMode): boolean {
  return mode === "organizer_vehicle" || mode === "bus" || mode === "minibus" || mode === "train";
}

export function isDenaliPersonalCarOptionVisible(mode: DenaliTransportMode): boolean {
  return mode === "bus" || mode === "minibus" || mode === "train";
}

export function isDenaliDongAmountVisible(
  mode: DenaliTransportMode,
  allowPersonalCar = false
): boolean {
  if (mode === "shared_cars") return true;
  return isDenaliPersonalCarOptionVisible(mode) && allowPersonalCar;
}

export function isDenaliDongAmountRequired(
  mode: DenaliTransportMode,
  allowPersonalCar = false
): boolean {
  return isDenaliDongAmountVisible(mode, allowPersonalCar);
}

export function isDenaliSeatPreferenceVisible(mode: DenaliTransportMode): boolean {
  return mode === "train";
}

export function isDenaliAdminCapacityVisible(
  mode: DenaliTransportMode,
  allowPersonalCar: boolean
): boolean {
  return allowPersonalCar && isDenaliPersonalCarOptionVisible(mode);
}
