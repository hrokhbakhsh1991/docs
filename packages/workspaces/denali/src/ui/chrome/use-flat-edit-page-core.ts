"use client";

import {
  isWorkspaceUnpublishTransitionAllowed,
  type UpdateTourPayload,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";
import type { DraftSchemaGate } from "@app-tour/draft-engine";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createDenaliDraftSchemaGate } from "../../draft/create-denali-draft-schema-gate";
import type {
  DenaliWizardDraftEnvelope,
  DenaliWizardDraftMeta,
} from "../../draft/denali-wizard-draft-binding";
import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "../../draft/denali-wizard-draft-binding";
import {
  emptyDenaliTourWizardDraft,
  type DenaliTourWizardDraft,
} from "../../draft/denali-tour-wizard-draft";
import type { DenaliSubmitCatalogIds } from "../../wizard/denali-wizard-catalog-sanitize";
import type { DenaliWizardRulesModule as StrictDenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import { encodeTourActionSubmitError } from "../logic/tour-action-submit-error-codec";
import type {
  DenaliCreateTourWizardGate,
  DenaliWizardRuntimeGates,
} from "./use-create-tour-wizard-core";
import {
  useDenaliThemeCatalog,
  useDenaliWizardRuleSync,
  useDenaliWizardRules,
} from "../hooks/use-wizard-rule-sync";
import { runDenaliFlatEditPatch, type DenaliFlatEditPatchIntent } from "./flat-edit-patch-logic";
import {
  resolveDenaliFlatEditPageScreen,
  type DenaliFlatEditPageScreen,
} from "./flat-edit-page-screen";

export type DenaliFlatEditTourDetail = {
  readonly projection: {
    readonly title: string;
    readonly uiStatus: string;
    readonly priceAmount: number | null;
    readonly priceCurrency: string | null;
    readonly departureAt: string | null;
    readonly acceptedSeats: number;
    readonly capacity: number | null;
  };
};

export type DenaliFlatEditTourLoadResult =
  | {
      readonly ok: true;
      readonly detail: DenaliFlatEditTourDetail;
      readonly baseline: DenaliTourWizardDraft;
      readonly rowVersion: number;
    }
  | { readonly ok: false; readonly kind: "not-found" | "error"; readonly code: string };

export type DenaliFlatEditDraftEnvelope = DenaliWizardDraftEnvelope<DenaliTourWizardDraft>;

export type DenaliFlatEditDraftSync = {
  readonly data: DenaliFlatEditDraftEnvelope | null;
  readonly status: string;
  readonly setData: (envelope: DenaliFlatEditDraftEnvelope) => void;
  readonly clearDraft: () => Promise<void>;
  readonly navLocked: boolean;
};

export type DenaliFlatEditPageCoreInput = {
  readonly tourId: string;
  readonly tenantId: string;
  readonly canPublish: boolean;
  readonly gate: DenaliCreateTourWizardGate;
  readonly runtimeGates?: DenaliWizardRuntimeGates;
  readonly plugin: WorkspacePlugin;
  readonly draftSync: DenaliFlatEditDraftSync;
  readonly denaliSchemaGateRef: React.MutableRefObject<DraftSchemaGate<DenaliFlatEditDraftEnvelope> | null>;
  readonly envelopeMeta: DenaliWizardDraftMeta;
  readonly wizardSessionId: string;
  readonly loadTourBaseline: (tourId: string) => Promise<DenaliFlatEditTourLoadResult>;
  readonly updateTour: (payload: UpdateTourPayload) => Promise<
    | { readonly ok: true; readonly rowVersion: number }
    | {
        readonly ok: false;
        readonly status: number;
        readonly code: string;
        readonly message: string;
      }
  >;
  readonly loadSubmitCatalog: () => Promise<DenaliSubmitCatalogIds>;
  readonly onAfterPatchSuccess: () => void;
};

/** Phase 12.4 — Denali flat edit page orchestration (workspace package). */
export function useDenaliFlatEditPageCore(input: DenaliFlatEditPageCoreInput) {
  const [detail, setDetail] = useState<DenaliFlatEditTourDetail | null>(null);
  const [tourBaseline, setTourBaseline] = useState<DenaliTourWizardDraft | null>(null);
  const [rowVersion, setRowVersion] = useState<number | null>(null);
  const [tourLoading, setTourLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitValidationIssues, setSubmitValidationIssues] = useState<
    readonly ValidationIssue[] | null
  >(null);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [unpublished, setUnpublished] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<DenaliFlatEditPatchIntent | null>(null);
  const [pending, startTransition] = useTransition();

  const denaliRules = useDenaliWizardRules();
  const themeCatalog = useDenaliThemeCatalog(input.gate.published);

  const loadTour = useCallback(async () => {
    setTourLoading(true);
    setError(null);
    try {
      const result = await input.loadTourBaseline(input.tourId);
      if (!result.ok) {
        setDetail(null);
        setTourBaseline(null);
        setRowVersion(null);
        setError(result.kind === "not-found" ? "TOUR_NOT_FOUND" : result.code);
        return;
      }
      setDetail(result.detail);
      setTourBaseline(result.baseline);
      setRowVersion(result.rowVersion);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "TOUR_EDIT_LOAD_FAILED");
      setDetail(null);
      setTourBaseline(null);
      setRowVersion(null);
    } finally {
      setTourLoading(false);
    }
  }, [input.loadTourBaseline, input.tourId]);

  useEffect(() => {
    if (input.gate.published) {
      void loadTour();
    }
  }, [input.gate.published, loadTour]);

  const envelope = useMemo((): DenaliFlatEditDraftEnvelope | null => {
    if (input.draftSync.data !== null) {
      return input.draftSync.data;
    }
    if (tourBaseline === null) {
      return null;
    }
    return denaliHydrateDraftEnvelope(null, tourBaseline, input.envelopeMeta);
  }, [input.draftSync.data, tourBaseline, input.envelopeMeta]);

  const draft = envelope?.form ?? emptyDenaliTourWizardDraft();

  const envelopeRef = useRef(envelope);
  envelopeRef.current = envelope;

  const setEnvelope = useCallback(
    (prepared: DenaliFlatEditDraftEnvelope) => {
      input.draftSync.setData(prepared);
    },
    [input.draftSync]
  );

  const getEnvelope = useCallback(() => envelopeRef.current, []);

  const { wizardRuleEvalContext, onDraftChange } = useDenaliWizardRuleSync({
    plugin: input.plugin,
    draft,
    getEnvelope,
    setEnvelope,
    denaliRules,
    gate: {
      workspaceFormProfile: input.gate.workspaceFormProfile,
      fieldRulesOverlay: input.gate.fieldRulesOverlay,
      ...(input.runtimeGates !== undefined && !input.runtimeGates.loading
        ? { telegramIntegrationActive: input.runtimeGates.telegramIntegrationActive }
        : {}),
    },
    themeCatalog,
  });

  useEffect(() => {
    if (!input.gate.published || tourBaseline === null) {
      return;
    }
    if (input.draftSync.data !== null) {
      return;
    }
    if (input.draftSync.status === "SYNCING" || input.draftSync.status === "CONFLICT_RESOLVING") {
      return;
    }
    input.draftSync.setData(denaliPrepareDraftEnvelope(tourBaseline, input.envelopeMeta));
  }, [input.gate.published, tourBaseline, input.draftSync, input.envelopeMeta]);

  input.denaliSchemaGateRef.current =
    denaliRules != null && wizardRuleEvalContext !== undefined
      ? createDenaliDraftSchemaGate(
          denaliRules as unknown as StrictDenaliWizardRulesModule,
          wizardRuleEvalContext
        )
      : null;

  const handlePatch = useCallback(
    (patchIntent: DenaliFlatEditPatchIntent) => {
      setSubmitError(null);
      setSubmitValidationIssues(null);
      setSaved(false);
      setPublished(false);
      setUnpublished(false);
      setPendingIntent(patchIntent);
      startTransition(async () => {
        const outcome = await runDenaliFlatEditPatch({
          plugin: input.plugin,
          draft,
          denaliRules: denaliRules as unknown as StrictDenaliWizardRulesModule | null,
          wizardRuleEvalContext,
          tenantId: input.tenantId,
          rowVersion,
          patchIntent,
          gate: input.gate,
          loadCatalog: input.loadSubmitCatalog,
          updateTour: input.updateTour,
        });
        if (!outcome.ok) {
          if (outcome.failure.kind === "validation") {
            setSubmitValidationIssues(outcome.failure.validationIssues ?? null);
            setSubmitError("VALIDATION_FAILED");
          } else if (outcome.failure.kind === "update-action") {
            setSubmitError(
              encodeTourActionSubmitError({
                status: outcome.failure.status ?? 400,
                code: outcome.failure.code,
                message: outcome.failure.message ?? outcome.failure.code,
              })
            );
          } else {
            setSubmitError(outcome.failure.code);
          }
          setPendingIntent(null);
          return;
        }
        setRowVersion(outcome.rowVersion);
        if (outcome.patchIntent === "publish") {
          setPublished(true);
        } else if (outcome.patchIntent === "unpublish") {
          setUnpublished(true);
        } else {
          setSaved(true);
        }
        setPendingIntent(null);
        await input.draftSync.clearDraft();
        input.onAfterPatchSuccess();
        void loadTour();
      });
    },
    [input, draft, denaliRules, wizardRuleEvalContext, rowVersion, loadTour]
  );

  const formReady = envelope !== null;
  const canUnpublish =
    input.canPublish &&
    detail?.projection.uiStatus === "active" &&
    isWorkspaceUnpublishTransitionAllowed(input.plugin.lifecycle);

  const screen = useMemo(
    (): DenaliFlatEditPageScreen =>
      resolveDenaliFlatEditPageScreen({
        gateLoading: input.gate.loading,
        integrationRuntimeLoading: input.runtimeGates?.loading,
        gatePublished: input.gate.published,
        tourLoading,
        formReady,
        error,
        hasDetail: detail !== null,
      }),
    [
      input.gate.loading,
      input.runtimeGates?.loading,
      input.gate.published,
      tourLoading,
      formReady,
      error,
      detail,
    ]
  );

  return {
    screen,
    detail,
    draft,
    onDraftChange,
    wizardRuleEvalContext,
    wizardSessionId: input.wizardSessionId,
    draftSync: input.draftSync,
    gate: input.gate,
    error,
    submitError,
    submitValidationIssues,
    saved,
    published,
    unpublished,
    pending,
    pendingIntent,
    canPublish: input.canPublish,
    canUnpublish,
    handlePatch,
    reloadTour: loadTour,
  };
}

export type DenaliFlatEditPageCoreState = ReturnType<typeof useDenaliFlatEditPageCore>;

export type { DenaliFlatEditPageScreen } from "./flat-edit-page-screen";
export type { DenaliFlatEditPatchIntent } from "./flat-edit-patch-logic";
