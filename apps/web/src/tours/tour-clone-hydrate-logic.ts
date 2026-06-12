import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import type { DenaliPhotoRemintPlanEntry, TourCloneHydrator } from "@app-tour/workspace-sdk";

import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

export const TOUR_CLONE_HYDRATE_TEST_IDS = {
  loading: "operator-tour-clone-loading",
  error: "operator-tour-clone-error",
} as const;

export type TourCloneHydrateStatus = "idle" | "loading" | "ready" | "error";

export function resolveCloneTourId(cloneParam: string | null | undefined): string | null {
  if (cloneParam == null) {
    return null;
  }
  const trimmed = cloneParam.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Denali duplicate flow skips template prefill; other plugins ignore `?clone=`. */
export function shouldSkipWizardTemplatePrefill(
  cloneTourId: string | null,
  pluginId: string
): boolean {
  return cloneTourId !== null && pluginId === "denali";
}

/** Remote draft GET is disabled while Denali clone hydrate is in flight. */
export function shouldHydrateDraftFromRemote(
  cloneTourId: string | null,
  pluginId: string
): boolean {
  return !shouldSkipWizardTemplatePrefill(cloneTourId, pluginId);
}

export function buildCloneTourDetailUrl(tourId: string): string {
  return `/api/tours/${encodeURIComponent(tourId)}`;
}

export function readActiveEquipmentIds(
  items: readonly { readonly id: string; readonly isActive?: boolean }[]
): readonly string[] {
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}

export function resolveTourCloneHydrator(pluginId: string): TourCloneHydrator | null {
  if (pluginId !== "denali") {
    return null;
  }
  return getDenaliWorkspacePlugin().tourClone ?? null;
}

export type TourCloneHydrateOptions = {
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
  readonly wizardSessionId?: string;
  readonly tenantId?: string;
};

export type TourCloneHydrateResult = {
  readonly draft: TourWizardDraft;
  readonly photoRemintPlan?: readonly DenaliPhotoRemintPlanEntry[];
};

export function hydrateTourCloneDraft(
  pluginId: string,
  detail: OperatorTourDetailResponse,
  options?: TourCloneHydrateOptions
): TourCloneHydrateResult | null {
  const hydrator = resolveTourCloneHydrator(pluginId);
  if (hydrator == null) {
    return null;
  }
  const hydrated = hydrator.hydrateWizardDraft({
    canonicalData: detail.canonical.data,
    ...(options?.activeEquipmentIds !== undefined
      ? { activeEquipmentIds: options.activeEquipmentIds }
      : {}),
    ...(options?.activeDestinationIds !== undefined
      ? { activeDestinationIds: options.activeDestinationIds }
      : {}),
    ...(options?.wizardSessionId !== undefined ? { wizardSessionId: options.wizardSessionId } : {}),
    ...(options?.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
  });
  return {
    draft: { data: hydrated.data as TourWizardDraft["data"] },
    ...(hydrated.photoRemintPlan !== undefined ? { photoRemintPlan: hydrated.photoRemintPlan } : {}),
  };
}

export async function executeTourClonePhotoRemintPlan(
  plan: readonly DenaliPhotoRemintPlanEntry[]
): Promise<void> {
  if (plan.length === 0) {
    return;
  }
  const response = await fetch("/api/tours/clone-photo-remint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (response.status === 503) {
    return;
  }
  if (!response.ok) {
    throw new Error(`TOUR_CLONE_PHOTO_REMINT_HTTP_${response.status}`);
  }
}

/** @deprecated Prefer {@link hydrateTourCloneDraft} — kept for existing specs. */
export function hydrateDenaliTourCloneDraft(
  detail: OperatorTourDetailResponse,
  options?: TourCloneHydrateOptions
): TourWizardDraft {
  const result = hydrateTourCloneDraft("denali", detail, options);
  if (result == null) {
    throw new Error("DENALI_TOUR_CLONE_HYDRATOR_MISSING");
  }
  return result.draft;
}
