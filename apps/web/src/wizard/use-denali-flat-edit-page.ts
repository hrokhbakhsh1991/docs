"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DraftSchemaGate } from "@app-tour/draft-engine";
import type { UpdateTourPayload } from "@app-tour/workspace-sdk";

import { isOwnerRole, type OperatorSessionContext } from "@/admin/require-operator-session";
import { resolveSyncWorkspacePluginFromRegistry } from "@/bootstrap/workspace-plugin-loaders.generated";
import {
  createDenaliDraftSchemaGate,
  createDenaliWizardDraftSessionId,
  denaliEditTourDraftKey,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  resolveDenaliDraftMerge,
} from "@/bootstrap/workspace-wizard-draft-shell-bindings.generated";
import {
  loadDenaliSubmitCatalogIds,
  useDenaliFlatEditPageCore,
  type DenaliFlatEditTourDetail,
  type DenaliFlatEditTourLoadResult,
} from "@/bootstrap/workspace-wizard-flat-edit-chrome-bindings.generated";
import { normalizeDenaliRemoteEnvelope } from "@/draft/denali-draft-normalize-remote";
import type { NewTourWizardDraftEnvelope } from "@/draft/denali-wizard-draft-types";
import type { DenaliFlatEditPageCoreState } from "@app-tour/workspace-denali/host/ui/chrome/use-flat-edit-page-core";
import { resolveDraftUnificationV3Mode } from "@/draft/draft-unification-v3";
import {
  createDenaliDraftOnPushSuccess,
  resolveDenaliDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { parseLocationsResponse } from "@/features/settings/locations-logic";
import { readActiveDestinationIds, readActiveEquipmentIds } from "@/tours/tour-clone-hydrate-logic";
import { hydrateTourEditDraft } from "@/tours/tour-edit-hydrate-logic";
import { updateTourAction } from "@/tours/update-tour.server";
import {
  resolveInitialWorkspaceFormProfile,
  resolveWizardTemplateGateState,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import { useAppSession } from "@/providers/app-session-context";
import { useWorkspaceIntegrationRuntimeState } from "@/integrations/use-workspace-integration-runtime-state";

const INITIAL_GATE: WizardTemplateGateState = {
  loading: true,
  published: false,
  allowedCanonicalPaths: [],
  templateSteps: [],
  fieldOverlays: new Map(),
  seedLabel: "",
  fieldRulesOverlay: {},
  workspaceFormProfile: resolveInitialWorkspaceFormProfile(
    resolveSyncWorkspacePluginFromRegistry("denali")
  ),
};

function toFlatEditTourDetail(detail: OperatorTourDetailResponse): DenaliFlatEditTourDetail {
  return {
    projection: {
      title: detail.projection.title,
      uiStatus: detail.projection.uiStatus,
      priceAmount: detail.projection.priceAmount,
      priceCurrency: detail.projection.priceCurrency,
      departureAt: detail.projection.departureAt,
      acceptedSeats: detail.projection.acceptedCount,
      capacity: detail.projection.totalCapacity,
    },
  };
}

export type UseDenaliFlatEditPageInput = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
};

/** Phase 15.2 P15-W-B1f — Denali flat-edit page orchestration hook (shell wiring). */
export function useDenaliFlatEditPage({ session, tourId }: UseDenaliFlatEditPageInput): DenaliFlatEditPageCoreState & {
  readonly draftSyncEngine: ReturnType<typeof useWorkspaceDraft<NewTourWizardDraftEnvelope>>;
} {
  const appSession = useAppSession();
  const router = useRouter();
  const plugin = useMemo(() => resolveSyncWorkspacePluginFromRegistry("denali"), []);
  const wizardSessionId = useMemo(() => createDenaliWizardDraftSessionId(), []);
  const editDraftKey = useMemo(() => denaliEditTourDraftKey(tourId), [tourId]);
  const envelopeMeta = useMemo(() => ({ currentStepIndex: 0, wizardSessionId }), [wizardSessionId]);
  const denaliSchemaGateRef = useRef<DraftSchemaGate<NewTourWizardDraftEnvelope> | null>(null);
  const denaliSchemaGate = useMemo(
    (): DraftSchemaGate<NewTourWizardDraftEnvelope> => (candidate, ctx) => {
      const active = denaliSchemaGateRef.current;
      if (active == null) {
        return { ok: true, value: candidate };
      }
      return active(candidate, ctx);
    },
    []
  );

  const denaliMergeFn = resolveDenaliDraftMerge(
    resolveDraftUnificationV3Mode() as "off" | "shadow" | "on"
  );

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: appSession.workspaceId,
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: editDraftKey,
    conflictStrategy: resolveDenaliDraftConflictStrategy(),
    merge: denaliMergeFn
      ? (local, server) =>
          denaliMergeFn(local as never, server as never) as NewTourWizardDraftEnvelope
      : undefined,
    onPushSuccess: createDenaliDraftOnPushSuccess(),
    schemaGate: denaliSchemaGate,
    normalizeRemote: normalizeDenaliRemoteEnvelope,
  });

  const [gate, setGate] = useState<WizardTemplateGateState>(INITIAL_GATE);
  const integrationRuntime = useWorkspaceIntegrationRuntimeState(appSession.workspaceId);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/tour-wizard-template", { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as unknown) : null))
      .then((payload) => {
        if (!cancelled) {
          setGate(resolveWizardTemplateGateState(payload, session.pluginId));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGate({ ...INITIAL_GATE, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  const loadTourBaseline = useCallback(
    async (loadTourId: string): Promise<DenaliFlatEditTourLoadResult> => {
      const [tourResponse, equipmentResponse, locationsResponse] = await Promise.all([
        fetch(`/api/tours/${encodeURIComponent(loadTourId)}`, { cache: "no-store" }),
        fetch("/api/settings/resources/equipment", { cache: "no-store" }),
        fetch("/api/settings/resources/locations", { cache: "no-store" }),
      ]);
      if (tourResponse.status === 404) {
        return { ok: false, kind: "not-found", code: "TOUR_NOT_FOUND" };
      }
      if (!tourResponse.ok) {
        return { ok: false, kind: "error", code: `TOUR_EDIT_HTTP_${tourResponse.status}` };
      }
      const tourDetail = (await tourResponse.json()) as OperatorTourDetailResponse;
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
      const hydrated = hydrateTourEditDraft(plugin, tourDetail, {
        activeEquipmentIds,
        activeDestinationIds,
      });
      if (hydrated == null) {
        return { ok: false, kind: "error", code: "TOUR_EDIT_HYDRATOR_UNAVAILABLE" };
      }
      return {
        ok: true,
        detail: toFlatEditTourDetail(tourDetail),
        baseline: hydrated,
        rowVersion: tourDetail.rowVersion,
      };
    },
    [plugin]
  );

  const updateTour = useCallback(
    async (payload: UpdateTourPayload) => {
      const result = await updateTourAction(tourId, payload);
      if (!result.ok) {
        return {
          ok: false as const,
          status: result.status,
          code: result.code,
          message: result.message,
        };
      }
      return { ok: true as const, rowVersion: result.rowVersion };
    },
    [tourId]
  );

  const onAfterPatchSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const core = useDenaliFlatEditPageCore({
    tourId,
    tenantId: session.tenantId,
    canPublish: isOwnerRole(session.role),
    gate,
    runtimeGates: integrationRuntime,
    plugin,
    draftSync,
    denaliSchemaGateRef,
    envelopeMeta,
    wizardSessionId,
    loadTourBaseline,
    updateTour,
    loadSubmitCatalog: loadDenaliSubmitCatalogIds,
    onAfterPatchSuccess,
  } as unknown as Parameters<typeof useDenaliFlatEditPageCore>[0]);

  return { ...core, draftSyncEngine: draftSync };
}

export { createDenaliDraftSchemaGate };
