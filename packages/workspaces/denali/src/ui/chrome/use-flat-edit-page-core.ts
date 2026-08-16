"use client";

import {
  isWorkspaceUnpublishTransitionAllowed,
  type UpdateTourPayload,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";
import type { DraftSchemaGate, DraftStatus } from "@app-tour/draft-engine";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createDenaliDraftSchemaGate } from "../../draft/create-denali-draft-schema-gate";
import type {
  DenaliWizardDraftEnvelope,
  DenaliWizardDraftMeta,
} from "../../draft/denali-wizard-draft-binding";
import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  type DenaliTourWizardDraft,
} from "../../draft/denali-tour-wizard-draft";
import { DENALI_TOUR_START_CANONICAL_PATH } from "../logic/denali-schedule-date-policy";
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
  prepareDenaliFlatEditSeedEnvelope,
  replaceDenaliFlatEditDraftAfterSuccessfulPatch,
  resolveDenaliFlatEditWorkingEnvelope,
  shouldSeedDenaliFlatEditDraftFromTour,
} from "./flat-edit-draft-authority";
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
  readonly status: DraftStatus;
  readonly setData: (envelope: DenaliFlatEditDraftEnvelope) => void;
  readonly clearDraft: () => Promise<void>;
  readonly clearDraftAndReset: (reset: DenaliFlatEditDraftEnvelope) => Promise<void>;
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
  readonly draftSchemaGateRef: React.MutableRefObject<DraftSchemaGate<DenaliFlatEditDraftEnvelope> | null>;
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
  const suppressTourSeedRef = useRef(false);

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
    return resolveDenaliFlatEditWorkingEnvelope({
      remoteDraft: input.draftSync.data,
      tourBaseline,
      tourRowVersion: rowVersion,
      envelopeMeta: input.envelopeMeta,
    });
  }, [input.draftSync.data, tourBaseline, rowVersion, input.envelopeMeta]);

  const draft = envelope?.form ?? emptyDenaliTourWizardDraft();
  // UX: clear stale submit error/validation after real draft edits.
  const draftDataKey = useMemo(() => {
    try {
      return JSON.stringify((draft as unknown as { data?: unknown }).data ?? null);
    } catch {
      return "";
    }
  }, [draft]);
  const prevDraftDataKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevDraftDataKeyRef.current != null && prevDraftDataKeyRef.current !== draftDataKey) {
      setSubmitError(null);
      setSubmitValidationIssues(null);
    }
    prevDraftDataKeyRef.current = draftDataKey;
  }, [draftDataKey]);

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
    if (suppressTourSeedRef.current) {
      return;
    }
    if (
      !shouldSeedDenaliFlatEditDraftFromTour({
        remoteDraft: input.draftSync.data,
        tourRowVersion: rowVersion,
        draftStatus: input.draftSync.status,
      })
    ) {
      return;
    }
    input.draftSync.setData(
      prepareDenaliFlatEditSeedEnvelope(tourBaseline, input.envelopeMeta, rowVersion)
    );
  }, [input.gate.published, tourBaseline, rowVersion, input.draftSync, input.envelopeMeta]);

  input.draftSchemaGateRef.current =
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
        try {
          const outcome = await runDenaliFlatEditPatch({
            plugin: input.plugin,
            draft,
            denaliRules: denaliRules as unknown as StrictDenaliWizardRulesModule | null,
            wizardRuleEvalContext,
            tenantId: input.tenantId,
            rowVersion,
            patchIntent,
            gate: input.gate,
            scheduleBaselineStartIso:
              tourBaseline != null
                ? getCanonicalStringValue(tourBaseline, DENALI_TOUR_START_CANONICAL_PATH)
                : undefined,
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
          if (outcome.patchIntent === "publish") {
            setPublished(true);
          } else if (outcome.patchIntent === "unpublish") {
            setUnpublished(true);
          } else {
            setSaved(true);
          }
          setPendingIntent(null);
          suppressTourSeedRef.current = true;
          try {
            const reloaded = await input.loadTourBaseline(input.tourId);
            if (reloaded.ok) {
              setDetail(reloaded.detail);
              setTourBaseline(reloaded.baseline);
              setRowVersion(reloaded.rowVersion);
              await replaceDenaliFlatEditDraftAfterSuccessfulPatch({
                baseline: reloaded.baseline,
                envelopeMeta: input.envelopeMeta,
                tourRowVersion: reloaded.rowVersion,
                draftSync: input.draftSync,
              });
            } else {
              setRowVersion(outcome.rowVersion);
              await replaceDenaliFlatEditDraftAfterSuccessfulPatch({
                baseline: draft,
                envelopeMeta: input.envelopeMeta,
                tourRowVersion: outcome.rowVersion,
                draftSync: input.draftSync,
              });
            }
          } catch {
            // Tour PATCH already succeeded. Draft reset is best-effort — do not
            // remap a reset failure to unknown_error (operator would think save failed).
            setRowVersion(outcome.rowVersion);
          } finally {
            suppressTourSeedRef.current = false;
          }
          input.onAfterPatchSuccess();
        } catch {
          setSubmitError(
            encodeTourActionSubmitError({
              status: 500,
              code: "unknown_error",
              message: "unknown_error",
            })
          );
          setPendingIntent(null);
        }
      });
    },
    [input, draft, denaliRules, wizardRuleEvalContext, rowVersion, tourBaseline]
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
