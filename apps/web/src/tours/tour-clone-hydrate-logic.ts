import type { WizardPhotoRemintPlanEntry, TourCloneHydrator } from "@app-tour/workspace-sdk";

import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { loadWorkspacePluginById } from "@/wizard/load-workspace-plugin";
import { resolveWizardCloneRemintBffPath } from "@/wizard/resolve-wizard-clone-remint-bff-path";
import {
  readActiveDestinationIds,
  readActiveEquipmentIds,
  resolveActiveCatalogIdsFromResourcePayloads,
} from "@/wizard/wizard-host-adapter-registry";

export {
  readActiveDestinationIds,
  readActiveEquipmentIds,
  resolveActiveCatalogIdsFromResourcePayloads,
};

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
  /** True when a remint plan was attempted and at least one batch failed (non-blocking). */
  readonly photoRemintFailed?: boolean;
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

export const TOUR_CLONE_PHOTO_REMINT_BATCH_SIZE = 10;

export function chunkTourClonePhotoRemintPlan(
  plan: readonly WizardPhotoRemintPlanEntry[],
  batchSize = TOUR_CLONE_PHOTO_REMINT_BATCH_SIZE,
): WizardPhotoRemintPlanEntry[][] {
  if (plan.length === 0) {
    return [];
  }
  const chunks: WizardPhotoRemintPlanEntry[][] = [];
  for (let index = 0; index < plan.length; index += batchSize) {
    chunks.push(plan.slice(index, index + batchSize));
  }
  return chunks;
}

export type TourClonePhotoRemintResult = {
  readonly ok: boolean;
  readonly attempted: number;
  readonly failed: number;
};

/**
 * Best-effort MinIO copy for wizard clone — failures must not block draft hydration.
 * API accepts at most {@link TOUR_CLONE_PHOTO_REMINT_BATCH_SIZE} entries per request.
 * Callers may surface a non-blocking warning when `ok` is false.
 */
export async function executeTourClonePhotoRemintPlan(
  plan: readonly WizardPhotoRemintPlanEntry[]
): Promise<TourClonePhotoRemintResult> {
  if (plan.length === 0) {
    return { ok: true, attempted: 0, failed: 0 };
  }
  let attempted = 0;
  let failed = 0;
  for (const batch of chunkTourClonePhotoRemintPlan(plan)) {
    attempted += 1;
    try {
      const response = await fetch(resolveWizardCloneRemintBffPath(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: batch }),
      });
      if (response.status === 503 || response.status === 401 || !response.ok) {
        failed += 1;
        console.warn(
          `[tour-clone] photo remint skipped for batch of ${batch.length}: HTTP ${response.status}`,
        );
        if (response.status === 503 || response.status === 401) {
          break;
        }
        continue;
      }
    } catch (error: unknown) {
      failed += 1;
      console.warn(
        `[tour-clone] photo remint skipped for batch of ${batch.length}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { ok: failed === 0, attempted, failed };
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
  const catalogIds = resolveActiveCatalogIdsFromResourcePayloads(input.pluginId, {
    ...(equipmentResponse.ok
      ? { equipmentPayload: await equipmentResponse.json() }
      : {}),
    ...(locationsResponse.ok
      ? { locationsPayload: await locationsResponse.json() }
      : {}),
  });
  const activeEquipmentIds = catalogIds.activeEquipmentIds;
  const activeDestinationIds = catalogIds.activeDestinationIds;
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
  if (hydrated.photoRemintPlan !== undefined && hydrated.photoRemintPlan.length > 0) {
    const remint = await executeTourClonePhotoRemintPlan(hydrated.photoRemintPlan);
    return {
      ...hydrated,
      ...(remint.ok ? {} : { photoRemintFailed: true }),
    };
  }
  return hydrated;
}
