import { tourHasRegisterPreviewData } from "./build-catalog-register-preview-items";
import { tourHasOverflowGalleryPhotos } from "./build-catalog-tour-photo-set";
import type { MarketingCatalogCard } from "./catalog-types";
import { isDenaliMarketingPlugin } from "./resolve-marketing-denali-plugin";

export type CatalogDetailDenaliPdpGates = {
  readonly showHeroGallery: boolean;
  readonly showReadiness: boolean;
  readonly showLogistics: boolean;
  readonly showGear: boolean;
  readonly showGalleryNav: boolean;
  readonly showRegisterPreview: boolean;
  readonly showFaq: boolean;
};

function tourHasGearOrServices(tour: MarketingCatalogCard): boolean {
  return (
    (tour.gearItems?.length ?? 0) > 0 ||
    (tour.includedServices?.length ?? 0) > 0 ||
    (tour.excludedServices?.length ?? 0) > 0 ||
    tour.includesTourInsurance === true
  );
}

function tourHasLogistics(tour: MarketingCatalogCard): boolean {
  const transport = tour.transport;
  return (
    tour.gatheringPoint?.label?.trim() != null ||
    tour.meetingPointText?.trim() != null ||
    tour.approximateReturnTime?.trim() != null ||
    (transport?.mode != null && transport.mode !== "none") ||
    transport?.transportCostAmount != null ||
    transport?.dongAmount != null ||
    transport?.allowPersonalCar === true
  );
}

function tourHasReadinessData(tour: MarketingCatalogCard): boolean {
  return (
    tour.hikingHoursApprox != null ||
    tour.hikingGoHours != null ||
    tour.hikingReturnHours != null ||
    tour.peakHeightMeters != null ||
    tour.trailDistanceKm != null ||
    tour.elevationGainMeters != null ||
    tour.minimumAge != null ||
    tour.maximumAge != null ||
    (tour.fitnessPrerequisiteText?.trim().length ?? 0) > 0
  );
}

/** PR-D Denali PDP section gates — data-gated; non-Denali plugins get all false. */
export function resolveCatalogDetailDenaliPdpGates(
  pluginId: string,
  tour: MarketingCatalogCard,
): CatalogDetailDenaliPdpGates {
  if (!isDenaliMarketingPlugin(pluginId)) {
    return Object.freeze({
      showHeroGallery: false,
      showReadiness: false,
      showLogistics: false,
      showGear: false,
      showGalleryNav: false,
      showRegisterPreview: false,
      showFaq: false,
    });
  }

  return Object.freeze({
    showHeroGallery: true,
    showReadiness: tourHasReadinessData(tour),
    showLogistics: tourHasLogistics(tour),
    showGear: tourHasGearOrServices(tour),
    showGalleryNav: tourHasOverflowGalleryPhotos(tour),
    showRegisterPreview: tourHasRegisterPreviewData(tour),
    showFaq: true,
  });
}
