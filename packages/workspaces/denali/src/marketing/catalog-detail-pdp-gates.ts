import { isDenaliMarketingPlugin } from "./is-denali-plugin";

export type DenaliMarketingCatalogTour = {
  readonly gearItems?: readonly unknown[] | null;
  readonly includedServices?: readonly unknown[] | null;
  readonly excludedServices?: readonly unknown[] | null;
  readonly includesTourInsurance?: boolean | null;
  readonly gatheringPoint?: { readonly label?: string | null } | null;
  readonly meetingPointText?: string | null;
  readonly approximateReturnTime?: string | null;
  readonly transport?: {
    readonly mode?: string | null;
    readonly transportCostAmount?: number | null;
    readonly dongAmount?: number | null;
    readonly allowPersonalCar?: boolean | null;
  } | null;
  readonly hikingHoursApprox?: number | null;
  readonly hikingGoHours?: number | null;
  readonly hikingReturnHours?: number | null;
  readonly peakHeightMeters?: number | null;
  readonly trailDistanceKm?: number | null;
  readonly elevationGainMeters?: number | null;
  readonly minimumAge?: number | null;
  readonly maximumAge?: number | null;
  readonly fitnessPrerequisiteText?: string | null;
};

export type CatalogDetailDenaliPdpGates = {
  readonly showHeroGallery: boolean;
  readonly showReadiness: boolean;
  readonly showLogistics: boolean;
  readonly showGear: boolean;
  readonly showGalleryNav: boolean;
  readonly showRegisterPreview: boolean;
  readonly showFaq: boolean;
};

export type ResolveDenaliCatalogDetailPdpGatesInput = {
  readonly tour: DenaliMarketingCatalogTour;
  readonly hasOverflowGallery: boolean;
  readonly hasRegisterPreview: boolean;
};

function tourHasGearOrServices(tour: DenaliMarketingCatalogTour): boolean {
  return (
    (tour.gearItems?.length ?? 0) > 0 ||
    (tour.includedServices?.length ?? 0) > 0 ||
    (tour.excludedServices?.length ?? 0) > 0 ||
    tour.includesTourInsurance === true
  );
}

function tourHasLogistics(tour: DenaliMarketingCatalogTour): boolean {
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

function tourHasReadinessData(tour: DenaliMarketingCatalogTour): boolean {
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
export function resolveDenaliCatalogDetailPdpGates(
  pluginId: string,
  input: ResolveDenaliCatalogDetailPdpGatesInput,
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

  const { tour, hasOverflowGallery, hasRegisterPreview } = input;

  return Object.freeze({
    showHeroGallery: true,
    showReadiness: tourHasReadinessData(tour),
    showLogistics: tourHasLogistics(tour),
    showGear: tourHasGearOrServices(tour),
    showGalleryNav: hasOverflowGallery,
    showRegisterPreview: hasRegisterPreview,
    showFaq: true,
  });
}
