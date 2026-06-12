import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";

import type { TourWizardDraft } from "./tour-wizard-draft";

export const TOUR_EDIT_HYDRATE_TEST_IDS = {
  loading: "operator-tour-edit-wizard-loading",
  error: "operator-tour-edit-wizard-error",
} as const;

export type TourEditHydrateStatus = "idle" | "loading" | "ready" | "error";

export function hydrateTourEditDraft(
  plugin: WorkspacePlugin,
  detail: OperatorTourDetailResponse,
  options?: { readonly activeEquipmentIds?: readonly string[] }
): TourWizardDraft | null {
  const hydrate = plugin.wizardHost?.hydrateEditDraft;
  if (hydrate == null) {
    return null;
  }
  const data = hydrate({
    canonicalData: detail.canonical.data,
    ...(options?.activeEquipmentIds !== undefined
      ? { activeEquipmentIds: options.activeEquipmentIds }
      : {}),
  });
  return { data: data as TourWizardDraft["data"] };
}
