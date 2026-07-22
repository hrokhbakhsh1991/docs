import type { OperatorFlatEditPageIo } from "@/wizard/operator-flat-edit-page-io";
import {
  finalizeFlatEditTourLoad,
  mapFlatEditTourHttpStatus,
} from "@/wizard/host-adapter-runtime";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { resolveActiveCatalogIdsFromResourcePayloads } from "@/tours/tour-clone-hydrate-logic";
import { hydrateTourEditDraft } from "@/tours/tour-edit-hydrate-logic";
import { updateTourAction } from "@/tours/update-tour.server";

/**
 * Default web BFF adapter for {@link OperatorFlatEditPageIo} (P2-D4.a).
 */
export const webOperatorFlatEditPageIo: OperatorFlatEditPageIo = Object.freeze({
  async loadWizardTemplatePayload() {
    const response = await fetch("/api/settings/tour-wizard-template", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  },

  async loadTourBaseline({ tourId, plugin }) {
    const [tourResponse, equipmentResponse, locationsResponse] = await Promise.all([
      fetch(`/api/tours/${encodeURIComponent(tourId)}`, { cache: "no-store" }),
      fetch("/api/settings/resources/equipment", { cache: "no-store" }),
      fetch("/api/settings/resources/locations", { cache: "no-store" }),
    ]);
    const httpFailure = mapFlatEditTourHttpStatus(tourResponse.status);
    if (httpFailure != null) {
      return httpFailure;
    }
    const tourDetail = (await tourResponse.json()) as OperatorTourDetailResponse;
    const catalogIds = resolveActiveCatalogIdsFromResourcePayloads({
      ...(equipmentResponse.ok ? { equipmentPayload: await equipmentResponse.json() } : {}),
      ...(locationsResponse.ok ? { locationsPayload: await locationsResponse.json() } : {}),
    });
    const hydrated = hydrateTourEditDraft(plugin, tourDetail, {
      activeEquipmentIds: catalogIds.activeEquipmentIds,
      activeDestinationIds: catalogIds.activeDestinationIds,
    });
    return finalizeFlatEditTourLoad({
      tourDetail,
      baseline: hydrated,
    });
  },

  updateTour: updateTourAction,
});
