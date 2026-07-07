/** Egress-safe transport snapshot on public catalog cards. */
export type PublicCatalogTransportMode =
  | "organizer_vehicle"
  | "bus"
  | "minibus"
  | "train"
  | "shared_cars"
  | "none";

export type PublicCatalogTransportSnapshot = {
  readonly mode: PublicCatalogTransportMode;
  readonly allowPersonalCar?: boolean;
  readonly transportCostAmount?: number | null;
  readonly dongAmount?: number | null;
};

export function isPublicCatalogOrganizedTransportMode(mode: PublicCatalogTransportMode): boolean {
  return (
    mode === "organizer_vehicle" ||
    mode === "bus" ||
    mode === "minibus" ||
    mode === "train"
  );
}
