"use client";

import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";
import type { ValidationIssue } from "@app-tour/wizard-navigation";
import type { DraftSchemaGate } from "@app-tour/draft-engine";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createDenaliDraftSchemaGate } from "../../draft/create-denali-draft-schema-gate";
import type { DenaliWizardDraftEnvelope, DenaliWizardDraftMeta } from "../../draft/denali-wizard-draft-binding";
import {
  emptyDenaliTourWizardDraft,
  type DenaliTourWizardDraft,
} from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRulesModule as StrictDenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import { runDenaliCreateTourSubmit } from "./create-submit-logic";
import type { DenaliTemplateGatePrefill } from "./draft-binding";
import {
  DENALI_CREATE_TOUR_CLONE_TEST_IDS,
  resolveDenaliCreateTourWizardScreen,
  type DenaliCreateTourWizardScreen,
  type TourCloneHydrateStatus,
} from "./create-tour-wizard-screen";
import {
  useDenaliThemeCatalog,
  useDenaliWizardRuleSync,
  useDenaliWizardRules,
} from "../hooks/use-wizard-rule-sync";

export type DenaliCreateTourWizardDraftEnvelope = DenaliWizardDraftEnvelope<DenaliTourWizardDraft>;

export type DenaliCreateTourWizardGate = DenaliTemplateGatePrefill & {
  readonly published: boolean;
  readonly loading: boolean;
  readonly workspaceFormProfile: string;
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly allowedCanonicalPaths: readonly string[];
  readonly templateSteps: readonly {
    readonly stepId: string;
    readonly enabled?: boolean;
    readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[];
  }[];
};

export type DenaliCreateTourWizardSession = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly pluginId: string;
};

export type DenaliCreateTourDraftSync = {
  readonly data: DenaliCreateTourWizardDraftEnvelope | null;
  readonly status: string;
  readonly navLocked: boolean;
  readonly setData: (envelope: DenaliCreateTourWizardDraftEnvelope) => void;
  readonly clearDraft: () => Promise<void>;
};

export type DenaliWizardClearDraftHandle = {
  readonly clearDraftPending: boolean;
  readonly clearDraftError: string | null;
  readonly requestClearDraft: () => void;
  readonly clearDraftConfirmDialog: ReactNode;
};

export type DenaliCreateTourWizardCoreInput = {
  readonly cloneTourId: string | null;
  readonly presetId: string | null;
  readonly presetApplied: boolean;
  readonly session: DenaliCreateTourWizardSession;
  readonly gate: DenaliCreateTourWizardGate;
  readonly denaliPlugin: WorkspacePlugin;
  readonly draftSync: DenaliCreateTourDraftSync;
  readonly draftIndex: unknown;
  readonly clearDraft: DenaliWizardClearDraftHandle;
  readonly wizardSessionId: string;
  readonly prepareEnvelope: (
    form: DenaliTourWizardDraft,
    meta: DenaliWizardDraftMeta
  ) => DenaliCreateTourWizardDraftEnvelope;
  readonly denaliSchemaGateRef: React.MutableRefObject<
    DraftSchemaGate<DenaliCreateTourWizardDraftEnvelope> | null
  >;
  readonly hydrateCreateTourFromClone: (input: {
    readonly cloneTourId: string;
    readonly pluginId: string;
    readonly wizardSessionId: string;
  }) => Promise<{ readonly draft: DenaliTourWizardDraft }>;
  readonly createTourAction: (
    payload: CreateTourPayload
  ) => Promise<
    | { readonly ok: true; readonly record: { readonly id: string } }
    | { readonly ok: false; readonly status: number; readonly code: string }
  >;
  readonly isDraftEssentiallyEmpty: (form: Record<string, unknown>) => boolean;
  readonly draftResumeEpoch: number;
};

/** Phase 15.2 P15-W-B1e — Denali create wizard orchestration (workspace package). */
export function useDenaliCreateTourWizardCore(input: DenaliCreateTourWizardCoreInput) {
  const [cloneStatus, setCloneStatus] = useState<TourCloneHydrateStatus>("idle");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitValidationIssues, setSubmitValidationIssues] = useState<
    readonly ValidationIssue[] | null
  >(null);
  const [createdTourId, setCreatedTourId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const denaliRules = useDenaliWizardRules();
  const themeCatalog = useDenaliThemeCatalog(input.gate.published);

  useEffect(() => {
    if (!input.cloneTourId || !input.gate.published) {
      setCloneStatus("idle");
      setCloneError(null);
      return;
    }
    let cancelled = false;
    setCloneStatus("loading");
    setCloneError(null);
    void (async () => {
      try {
        const hydrated = await input.hydrateCreateTourFromClone({
          cloneTourId: input.cloneTourId!,
          pluginId: input.session.pluginId,
          wizardSessionId: input.wizardSessionId,
        });
        if (cancelled) {
          return;
        }
        await input.draftSync.clearDraft();
        if (cancelled) {
          return;
        }
        input.draftSync.setData(
          input.prepareEnvelope(hydrated.draft, {
            currentStepIndex: 0,
            wizardSessionId: input.wizardSessionId,
          })
        );
        setCloneStatus("ready");
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setCloneStatus("error");
        setCloneError(error instanceof Error ? error.message : "TOUR_CLONE_FAILED");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    input.cloneTourId,
    input.gate.published,
    input.wizardSessionId,
    input.session.pluginId,
    input.draftSync,
    input.prepareEnvelope,
    input.hydrateCreateTourFromClone,
  ]);

  const denaliEnvelope = input.draftSync.data;
  const denaliEnvelopeRef = useRef(denaliEnvelope);
  denaliEnvelopeRef.current = denaliEnvelope;

  const denaliDraftReady =
    input.draftSync.data !== null ||
    input.clearDraft.clearDraftPending ||
    input.draftSync.status === "ERROR";
  const showSeedBanner =
    input.gate.seedLabel.length > 0 && input.cloneTourId === null;
  const denaliDraftHydrated =
    input.draftSync.data !== null &&
    input.draftSync.status !== "SYNCING" &&
    input.draftSync.status !== "CONFLICT_RESOLVING";

  const emptyDraftResetRef = useRef(false);
  useEffect(() => {
    if (!input.gate.published || input.cloneTourId !== null || !denaliDraftHydrated) {
      emptyDraftResetRef.current = false;
      return;
    }
    const envelope = input.draftSync.data;
    if (envelope == null || !input.isDraftEssentiallyEmpty(envelope.form as Record<string, unknown>)) {
      emptyDraftResetRef.current = false;
      return;
    }
    if (envelope.meta.currentStepIndex === 0 && envelope.meta.freshStart === true) {
      return;
    }
    if (emptyDraftResetRef.current) {
      return;
    }
    emptyDraftResetRef.current = true;
    input.draftSync.setData(
      input.prepareEnvelope(envelope.form, {
        currentStepIndex: 0,
        wizardSessionId: envelope.meta.wizardSessionId ?? input.wizardSessionId,
        freshStart: true,
      })
    );
  }, [
    input.gate.published,
    input.cloneTourId,
    denaliDraftHydrated,
    input.draftSync,
    input.wizardSessionId,
    input.prepareEnvelope,
    input.isDraftEssentiallyEmpty,
  ]);

  const draft = denaliEnvelope?.form ?? emptyDenaliTourWizardDraft();
  const activeStepIndex = denaliEnvelope?.meta.currentStepIndex ?? 0;
  const getEnvelope = useCallback(() => denaliEnvelopeRef.current, []);
  const setEnvelope = useCallback(
    (prepared: DenaliCreateTourWizardDraftEnvelope) => {
      input.draftSync.setData(prepared);
    },
    [input.draftSync]
  );

  const { wizardRuleEvalContext, onDraftChange } = useDenaliWizardRuleSync({
    plugin: input.denaliPlugin,
    draft,
    getEnvelope,
    setEnvelope,
    denaliRules,
    gate: input.gate,
    themeCatalog,
  });

  input.denaliSchemaGateRef.current =
    denaliRules != null && wizardRuleEvalContext !== undefined
      ? createDenaliDraftSchemaGate(
          denaliRules as unknown as StrictDenaliWizardRulesModule,
          wizardRuleEvalContext
        )
      : null;

  const onActiveStepIndexChange = useCallback(
    (index: number) => {
      if (denaliEnvelope === null || denaliEnvelope.meta.currentStepIndex === index) {
        return;
      }
      input.draftSync.setData(
        input.prepareEnvelope(denaliEnvelope.form, {
          ...denaliEnvelope.meta,
          currentStepIndex: index,
        })
      );
    },
    [denaliEnvelope, input.draftSync, input.prepareEnvelope]
  );

  const onSubmit = useCallback(() => {
    setSubmitError(null);
    setSubmitValidationIssues(null);
    startTransition(async () => {
      const outcome = await runDenaliCreateTourSubmit({
        plugin: input.denaliPlugin,
        draft,
        denaliRules: denaliRules as unknown as StrictDenaliWizardRulesModule | null,
        wizardRuleEvalContext,
        tenantId: input.session.tenantId,
        gate: input.gate,
      });
      if (!outcome.ok) {
        if (outcome.failure.kind === "validation") {
          setSubmitValidationIssues(outcome.failure.validationIssues ?? null);
          setSubmitError("VALIDATION_FAILED");
          return;
        }
        if (outcome.failure.kind === "rules-not-ready") {
          setSubmitError("DENALI_RULES_NOT_READY");
          return;
        }
        setSubmitError(outcome.failure.code);
        return;
      }
      const result = await input.createTourAction(outcome.result.payload);
      if (!result.ok) {
        setSubmitError(`ACTION:${result.status}:${result.code}`);
        return;
      }
      await input.draftSync.clearDraft();
      setCreatedTourId(result.record.id);
    });
  }, [
    input.denaliPlugin,
    input.session.tenantId,
    input.gate,
    input.draftSync,
    input.createTourAction,
    draft,
    denaliRules,
    wizardRuleEvalContext,
  ]);

  const screen = useMemo(
    (): DenaliCreateTourWizardScreen =>
      resolveDenaliCreateTourWizardScreen({
        gateLoading: input.gate.loading,
        gatePublished: input.gate.published,
        cloneTourId: input.cloneTourId,
        cloneStatus,
        denaliDraftReady,
      }),
    [
      input.gate.loading,
      input.gate.published,
      input.cloneTourId,
      cloneStatus,
      denaliDraftReady,
    ]
  );

  return {
    screen,
    cloneTourId: input.cloneTourId,
    cloneError,
    cloneLoadingTestId: DENALI_CREATE_TOUR_CLONE_TEST_IDS.loading,
    cloneErrorTestId: DENALI_CREATE_TOUR_CLONE_TEST_IDS.error,
    gate: input.gate,
    presetId: input.presetId,
    presetApplied: input.presetApplied,
    showSeedBanner,
    session: input.session,
    draft,
    draftSync: input.draftSync,
    draftIndex: input.draftIndex,
    wizardSessionId: input.wizardSessionId,
    activeStepIndex,
    onDraftChange,
    onActiveStepIndexChange,
    wizardRuleEvalContext,
    denaliDraftHydrated,
    draftResumeEpoch: input.draftResumeEpoch,
    suppressDraftStepInference: denaliEnvelope?.meta.freshStart === true,
    clearDraft: input.clearDraft,
    submitError,
    submitValidationIssues,
    setSubmitValidationIssues,
    createdTourId,
    pending,
    onSubmit,
  };
}

export type DenaliCreateTourWizardCoreState = ReturnType<typeof useDenaliCreateTourWizardCore>;

export type {
  DenaliCreateTourWizardScreen,
  TourCloneHydrateStatus,
} from "./create-tour-wizard-screen";
