import type { PublicCatalogTransportMode } from "@app-tour/workspace-sdk";

const TRANSPORT_LABEL_KEYS: Record<PublicCatalogTransportMode, string> = {
  organizer_vehicle: "detail.transport.modes.organizerVehicle",
  bus: "detail.transport.modes.bus",
  minibus: "detail.transport.modes.minibus",
  train: "detail.transport.modes.train",
  shared_cars: "detail.transport.modes.sharedCars",
  none: "detail.transport.modes.none",
};

export function resolveCatalogTransportLabelKey(mode: PublicCatalogTransportMode): string {
  return TRANSPORT_LABEL_KEYS[mode];
}
