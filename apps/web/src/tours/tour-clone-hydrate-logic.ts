import type { WizardPhotoRemintPlanEntry, TourCloneHydrator } from "@app-tour/workspace-sdk";

import { parseLocationsResponse } from "@/features/settings/locations-logic";
import type { DestinationResource } from "@/features/settings/settings-module-types";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { loadWorkspacePluginById } from "@/wizard/load-workspace-plugin";
import { resolveWizardCloneRemintBffPath } from "@/wizard/resolve-wizard-clone-remint-bff-path";

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

/** Duplicate flow skips template prefill when workspace exposes tourClone hydrator. */
export function shouldSkipWizardTemplatePrefill(
  cloneTourId: string | null,
  supportsTourClone: boolean
): boolean {
  return cloneTourId !== null && supportsTourClone;
}

/** Remote draft GET is disabled while clone hydrate is in flight. */
export function shouldHydrateDraftFromRemote(
  cloneTourId: string | null,
  supportsTourClone: boolean
): boolean {
  return !shouldSkipWizardTemplatePrefill(cloneTourId, supportsTourClone);
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

export function readActiveDestinationIds(
  items: readonly Pick<DestinationResource, "id" | "isActive">[]
): readonly string[] {
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}

export async function loadTourCloneHydrator(pluginId: string): Promise<TourCloneHydrator | null> {
  const plugin = await loadWorkspacePluginById(pluginId);
  return plugin.tourClone ?? null;
}

/** @deprecated Use {@link loadTourCloneHydrator} */
export function resolveTourCloneHydrator(pluginId: string): TourCloneHydrator | null {
  void pluginId;
  return null;
}

export type TourCloneHydrateOptions = {
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
  readonly wizardSessionId?: string;
  readonly tenantId?: string;
};

export type TourCloneHydrateResult = {
  readonly draft: TourWizardDraft;
  readonly photoRemintPlan?: readonly WizardPhotoRemintPlanEntry[];
};

export function hydrateTourCloneDraft(
  hydrator: TourCloneHydrator,
  detail: OperatorTourDetailResponse,
  options?: TourCloneHydrateOptions
): TourCloneHydrateResult {
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
  plan: readonly WizardPhotoRemintPlanEntry[]
): Promise<void> {
  if (plan.length === 0) {
    return;
  }
  const response = await fetch(resolveWizardCloneRemintBffPath(), {
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

export type HydrateCreateTourFromCloneInput = {
  readonly cloneTourId: string;
  readonly pluginId: string;
  readonly wizardSessionId: string;
};

/** Phase 15.2 P15-W-B1b — fetch tour detail + catalogs, hydrate clone draft, remint photos. */
export async function hydrateCreateTourFromClone(
  input: HydrateCreateTourFromCloneInput
): Promise<TourCloneHydrateResult> {
  const [tourResponse, equipmentResponse, locationsResponse] = await Promise.all([
    fetch(buildCloneTourDetailUrl(input.cloneTourId), { cache: "no-store" }),
    fetch("/api/settings/resources/equipment", { cache: "no-store" }),
    fetch("/api/settings/resources/locations", { cache: "no-store" }),
  ]);
  if (!tourResponse.ok) {
    throw new Error(`TOUR_CLONE_HTTP_${tourResponse.status}`);
  }
  const detail = (await tourResponse.json()) as OperatorTourDetailResponse;
  let activeEquipmentIds: readonly string[] | undefined;
  let activeDestinationIds: readonly string[] | undefined;
  if (equipmentResponse.ok) {
    const equipmentPayload = (await equipmentResponse.json()) as {
      items?: Array<{ id: string; isActive?: boolean }>;
    };
    activeEquipmentIds = readActiveEquipmentIds(equipmentPayload.items ?? []);
  }
  if (locationsResponse.ok) {
    const locationsPayload = parseLocationsResponse(await locationsResponse.json());
    activeDestinationIds = readActiveDestinationIds(locationsPayload.destinations);
  }
  const hydrator = await loadTourCloneHydrator(input.pluginId);
  if (hydrator == null) {
    throw new Error("TOUR_CLONE_HYDRATOR_UNAVAILABLE");
  }
  const hydrated = hydrateTourCloneDraft(hydrator, detail, {
    activeEquipmentIds,
    activeDestinationIds,
    wizardSessionId: input.wizardSessionId,
    tenantId: detail.tenantId,
  });
  if (hydrated.photoRemintPlan !== undefined) {
    await executeTourClonePhotoRemintPlan(hydrated.photoRemintPlan);
  }
  return hydrated;
}
