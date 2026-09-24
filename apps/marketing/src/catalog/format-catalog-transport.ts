import type { PublicCatalogTransportSnapshot } from "@app-tour/workspace-sdk";

import { resolveCatalogTransportLabelKey } from "./resolve-catalog-transport-label-key";

type CatalogTranslate = (key: string) => string;

/** Returns the public-facing transport mode, including the personal-car option. */
export function formatCatalogTransportMode(
  transport: PublicCatalogTransportSnapshot | null | undefined,
  translate: CatalogTranslate
): string | null {
  if (transport == null) {
    return null;
  }

  const modeLabel = translate(resolveCatalogTransportLabelKey(transport.mode));
  if (transport.allowPersonalCar !== true) {
    return modeLabel;
  }

  return `${modeLabel} · ${translate("detail.logistics.personalCar")}`;
}

/**
 * Resolves the one transport amount relevant to the public tour summary.
 * Organized transport uses transportCost; shared cars use the fuel-share amount.
 */
export function resolveCatalogTransportCostAmount(
  transport: PublicCatalogTransportSnapshot | null | undefined
): number | null {
  if (transport == null) {
    return null;
  }

  if (
    transport.mode === "organizer_vehicle" ||
    transport.mode === "bus" ||
    transport.mode === "minibus" ||
    transport.mode === "train"
  ) {
    return transport.transportCostAmount ?? null;
  }

  if (transport.mode === "shared_cars") {
    return transport.dongAmount ?? null;
  }

  return null;
}
