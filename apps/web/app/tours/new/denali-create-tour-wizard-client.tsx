"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";

import {
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  createDenaliDraftSchemaGate,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  type DenaliWizardDraftMeta,
} from "@app-tour/workspace-denali/draft";
import type { DraftSchemaGate } from "@app-tour/draft-engine";
import { Button } from "@/components/ui/button";

import { DraftSyncChrome } from "@/draft/draft-sync-chrome";
import {
  createDenaliDraftOnPushSuccess,
  resolveDenaliDraftConflictStrategy,
  resolveDenaliDraftMerge,
} from "@/draft/draft-unification-v3-options";
import { useWorkspaceDraftIndex } from "@/draft/use-workspace-draft-index";
import { WorkspaceDraftIndexSummary } from "@/draft/workspace-draft-index-summary";
import {
  isDenaliFreshStartEnvelope,
  type NewTourWizardDraftEnvelope,
} from "@/draft/denali-wizard-draft-merge";
import { isDraftEssentiallyEmpty } from "@/draft/denali-wizard-resume-step";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { useDenaliWizardClearDraft } from "@/draft/use-denali-wizard-clear-draft";
import { applyDenaliDefaultTourKind } from "@/wizard/denali/denali-default-tour-kind";
import { persistDenaliWizardDraftChange } from "@/wizard/denali/denali-wizard-draft-persist";
import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import { emptyTourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue } from "@/tours/tour-wizard-draft-path";
import {
  buildCloneTourDetailUrl,
  hydrateTourCloneDraft,
  readActiveEquipmentIds,
  executeTourClonePhotoRemintPlan,
  resolveCloneTourId,
  shouldHydrateDraftFromRemote,
  shouldSkipWizardTemplatePrefill,
  TOUR_CLONE_HYDRATE_TEST_IDS,
  type TourCloneHydrateStatus,
} from "@/tours/tour-clone-hydrate-logic";
import {
  applyTourPresetToDraft,
  findActiveTourPreset,
  resolvePresetId,
  TOUR_PRESET_PREFILL_TEST_IDS,
} from "@/tours/tour-preset-prefill-logic";
import {
  resolveWizardTemplateGateState,
  WIZARD_TEMPLATE_GATE_TEST_IDS,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import {
  applyWizardTemplatePrefillToDraft,
  WIZARD_TEMPLATE_PREFILL_TEST_IDS,
} from "@/tours/wizard-template-prefill-logic";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type {
  GuideLanguageResource,
  TourPresetResource,
  TourThemeResource,
} from "@/features/settings/settings-module-types";
import type { UsersListResponse } from "@/features/users/users-directory-types";
import { loadDenaliWizardRulesModule, type DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import {
  buildFieldStepResolverFromTemplate,
  validateDenaliPublishTransitionSync,
  validateDenaliWizardDraftSync,
} from "@/wizard/denali/denali-wizard-validation";
import { parseLocationsResponse } from "@/features/settings/locations-logic";
import {
  readActiveDestinationIds,
  readActiveGuideLanguageIds,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
  resolveMainThemeFormProfileFromCatalog,
} from "@/wizard/denali/denali-catalog-sanitize";
import { buildDenaliWizardRuleEvalContext, type DenaliWizardRuleEvalContext } from "@/wizard/denali/denali-wizard-ui-context";
import type { CreateTourPayload } from "@app-tour/workspace-sdk";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";
import {
  createWizardAssetSessionId,
  normalizeWizardRemoteEnvelope,
  prepareWizardDraftEnvelope,
} from "@/wizard/wizard-draft-envelope-hooks";

const INITIAL_GATE_STATE: WizardTemplateGateState = {
  loading: true,
  published: false,
  allowedCanonicalPaths: [],
  templateSteps: [],
  fieldOverlays: new Map(),
  seedLabel: "",
  fieldRulesOverlay: {},
  workspaceFormProfile: "denali_pilot",
};

function buildPrefilledForm(gate: WizardTemplateGateState): ReturnType<typeof emptyTourWizardDraft> {
  const base = applyDenaliDefaultTourKind(emptyTourWizardDraft());
  return applyWizardTemplatePrefillToDraft(base, gate.seedLabel, gate.fieldOverlays, "denali");
}

export function DenaliCreateTourWizardClient() {
  const t = useTranslations("wizard");
  const searchParams = useSearchParams();
  const session = useAppSession();
  const cloneTourId = useMemo(
    () => resolveCloneTourId(searchParams.get("clone")),
    [searchParams]
  );
  const presetId = useMemo(() => resolvePresetId(searchParams.get("preset")), [searchParams]);
  const [gate, setGate] = useState<WizardTemplateGateState>(INITIAL_GATE_STATE);
  const [cloneStatus, setCloneStatus] = useState<TourCloneHydrateStatus>("idle");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftResumeEpoch, setDraftResumeEpoch] = useState(0);
  const [submitValidationIssues, setSubmitValidationIssues] = useState<
    readonly ValidationIssue[] | null
  >(null);
  const [createdTourId, setCreatedTourId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const denaliPlugin = useMemo(() => getDenaliWorkspacePlugin(), []);
  const wizardSessionId = useMemo(
    () => createWizardAssetSessionId(denaliPlugin, createDenaliWizardDraftSessionId),
    [denaliPlugin]
  );
  const prepareEnvelope = useCallback(
    (form: ReturnType<typeof emptyTourWizardDraft>, meta: DenaliWizardDraftMeta) =>
      prepareWizardDraftEnvelope(denaliPlugin, form, meta, denaliPrepareDraftEnvelope),
    [denaliPlugin]
  );
  const normalizeRemoteEnvelope = useCallback(
    (envelope: NewTourWizardDraftEnvelope) =>
      normalizeWizardRemoteEnvelope(denaliPlugin, envelope, (remote) =>
        denaliHydrateDraftEnvelope(remote, remote.form, remote.meta)
      ),
    [denaliPlugin]
  );
  const [denaliRules, setDenaliRules] = useState<DenaliWizardRulesModule | null>(null);
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
  const [themeCatalog, setThemeCatalog] = useState<readonly TourThemeResource[]>([]);
  const [presetApplied, setPresetApplied] = useState(false);
  const appliedPresetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDenaliWizardRulesModule().then((rules) => {
      if (!cancelled) {
        setDenaliRules(rules);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gate.published) {
      setThemeCatalog([]);
      return;
    }
    let cancelled = false;
    void fetch("/api/settings/resources/tour_themes", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_THEMES_HTTP_${response.status}`);
        }
        return (await response.json()) as { items?: readonly TourThemeResource[] };
      })
      .then((payload) => {
        if (!cancelled) {
          setThemeCatalog(payload.items ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThemeCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gate.published]);

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: session.workspaceId,
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
    conflictStrategy: resolveDenaliDraftConflictStrategy(),
    merge: resolveDenaliDraftMerge(),
    onPushSuccess: createDenaliDraftOnPushSuccess(),
    hydrateFromRemote: shouldHydrateDraftFromRemote(cloneTourId, session.pluginId),
    schemaGate: denaliSchemaGate,
    normalizeRemote: normalizeRemoteEnvelope,
    shouldBypassServerVersionAdoption: isDenaliFreshStartEnvelope,
  });

  const draftSyncDataRef = useRef(draftSync.data);
  draftSyncDataRef.current = draftSync.data;

  const draftIndex = useWorkspaceDraftIndex(session.workspaceId, DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE);

  const buildClearResetEnvelope = useCallback(
    () =>
      prepareEnvelope(buildPrefilledForm(gate), {
        currentStepIndex: 0,
        wizardSessionId,
        freshStart: true,
      }),
    [gate, wizardSessionId, prepareEnvelope]
  );

  const {
    clearDraftPending,
    clearDraftError,
    requestClearDraft,
    clearDraftConfirmDialog,
  } = useDenaliWizardClearDraft({
    draftSync,
    buildResetEnvelope: buildClearResetEnvelope,
    onAfterClear: () => setDraftResumeEpoch((epoch) => epoch + 1),
  });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/tour-wizard-template", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setGate(resolveWizardTemplateGateState(payload, session.pluginId));
      })
      .catch(() => {
        if (!cancelled) {
          setGate({
            loading: false,
            published: false,
            allowedCanonicalPaths: [],
            templateSteps: [],
            fieldOverlays: new Map(),
            seedLabel: "",
            fieldRulesOverlay: {},
            workspaceFormProfile: "denali_pilot",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  useEffect(() => {
    if (!cloneTourId || !gate.published) {
      setCloneStatus("idle");
      setCloneError(null);
      return;
    }

    let cancelled = false;
    setCloneStatus("loading");
    setCloneError(null);

    void (async () => {
      try {
        const [tourResponse, equipmentResponse, locationsResponse] = await Promise.all([
          fetch(buildCloneTourDetailUrl(cloneTourId), { cache: "no-store" }),
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
        const hydrated = hydrateTourCloneDraft(session.pluginId, detail, {
          activeEquipmentIds,
          activeDestinationIds,
          wizardSessionId,
          tenantId: detail.tenantId,
        });
        if (hydrated == null) {
          throw new Error("TOUR_CLONE_HYDRATOR_UNAVAILABLE");
        }
        if (hydrated.photoRemintPlan !== undefined) {
          await executeTourClonePhotoRemintPlan(hydrated.photoRemintPlan);
        }
        if (cancelled) {
          return;
        }
        await draftSync.clearDraft();
        if (cancelled) {
          return;
        }
        draftSync.setData(
          prepareEnvelope(hydrated.draft, {
            currentStepIndex: 0,
            wizardSessionId,
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
    cloneTourId,
    gate.published,
    wizardSessionId,
    session.pluginId,
    draftSync.clearDraft,
    draftSync.setData,
  ]);

  useEffect(() => {
    if (!gate.published) {
      return;
    }
    if (shouldSkipWizardTemplatePrefill(cloneTourId, session.pluginId)) {
      return;
    }
    if (draftSync.data !== null) {
      return;
    }
    if (clearDraftPending) {
      return;
    }
    if (draftSync.status === "SYNCING" || draftSync.status === "CONFLICT_RESOLVING") {
      return;
    }
    draftSync.setData(
      prepareEnvelope(buildPrefilledForm(gate), {
        currentStepIndex: 0,
        wizardSessionId,
        freshStart: true,
      })
    );
  }, [
    gate,
    session.pluginId,
    wizardSessionId,
    draftSync.data,
    draftSync.status,
    draftSync.setData,
    cloneTourId,
    clearDraftPending,
  ]);

  useEffect(() => {
    if (!presetId || !gate.published || cloneTourId !== null) {
      appliedPresetIdRef.current = null;
      setPresetApplied(false);
      return;
    }
    if (appliedPresetIdRef.current === presetId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetch("/api/settings/resources/tour_presets", { cache: "no-store" }),
      fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
    ])
      .then(async ([presetsRes, themesRes]) => {
        if (!presetsRes.ok) {
          return null;
        }
        const presetsPayload = (await presetsRes.json()) as { items?: readonly TourPresetResource[] };
        const themesPayload =
          themesRes.ok
            ? ((await themesRes.json()) as { items?: readonly TourThemeResource[] })
            : { items: [] as readonly TourThemeResource[] };
        const preset = findActiveTourPreset(presetsPayload.items ?? [], presetId);
        if (preset == null) {
          return null;
        }
        const activeThemeIds = readActiveThemeIds(themesPayload.items ?? []);
        return { preset, activeThemeIds };
      })
      .then((resolved) => {
        if (cancelled || resolved == null) {
          return;
        }
        appliedPresetIdRef.current = presetId;
        const applyPreset = (base: ReturnType<typeof emptyTourWizardDraft>) =>
          applyTourPresetToDraft(base, resolved.preset, resolved.activeThemeIds);
        const currentEnvelope = draftSyncDataRef.current;
        if (currentEnvelope !== null) {
          draftSync.setData(
            prepareEnvelope(applyPreset(currentEnvelope.form), currentEnvelope.meta)
          );
        } else {
          draftSync.setData(
            prepareEnvelope(applyPreset(buildPrefilledForm(gate)), {
              currentStepIndex: 0,
              wizardSessionId,
            })
          );
        }
        setPresetApplied(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPresetApplied(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [presetId, gate, cloneTourId, wizardSessionId, draftSync.setData]);

  const denaliEnvelope = draftSync.data;
  const denaliEnvelopeRef = useRef(denaliEnvelope);
  denaliEnvelopeRef.current = denaliEnvelope;

  const denaliDraftReady =
    draftSync.data !== null ||
    clearDraftPending ||
    draftSync.status === "ERROR";

  const showSeedBanner =
    gate.seedLabel.length > 0 &&
    !shouldSkipWizardTemplatePrefill(cloneTourId, session.pluginId);

  const denaliDraftHydrated =
    draftSync.data !== null &&
    draftSync.status !== "SYNCING" &&
    draftSync.status !== "CONFLICT_RESOLVING";

  const emptyDraftResetRef = useRef(false);

  useEffect(() => {
    if (!gate.published || cloneTourId !== null || !denaliDraftHydrated) {
      emptyDraftResetRef.current = false;
      return;
    }
    const envelope = draftSync.data;
    if (envelope == null) {
      return;
    }
    if (!isDraftEssentiallyEmpty(envelope.form as Record<string, unknown>)) {
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
    draftSync.setData(
      prepareEnvelope(envelope.form, {
        currentStepIndex: 0,
        wizardSessionId: envelope.meta.wizardSessionId ?? wizardSessionId,
        freshStart: true,
      })
    );
  }, [
    gate.published,
    cloneTourId,
    denaliDraftHydrated,
    draftSync.data,
    draftSync.setData,
    wizardSessionId,
  ]);

  const draft = denaliEnvelope?.form ?? emptyTourWizardDraft();
  const activeStepIndex = denaliEnvelope?.meta.currentStepIndex ?? 0;

  const wizardRuleEvalContext = useMemo(() => {
    const build = denaliPlugin.wizardHost?.buildRuleEvalContext;
    const input = {
      workspaceFormProfile: gate.workspaceFormProfile,
      fieldRulesOverlay: gate.fieldRulesOverlay,
      mainThemeFormProfile: resolveMainThemeFormProfileFromCatalog(
        getCanonicalValue(draft, "program.themeIds"),
        themeCatalog
      ),
    };
    const context =
      build != null ? build(input) : buildDenaliWizardRuleEvalContext(input);
    return context as DenaliWizardRuleEvalContext;
  }, [denaliPlugin, gate.workspaceFormProfile, gate.fieldRulesOverlay, draft, themeCatalog]);

  denaliSchemaGateRef.current =
    denaliRules != null && wizardRuleEvalContext !== undefined
      ? createDenaliDraftSchemaGate(denaliRules, wizardRuleEvalContext)
      : null;

  const onDraftChange = useCallback(
    (next: ReturnType<typeof emptyTourWizardDraft>) => {
      if (denaliEnvelopeRef.current !== null) {
        persistDenaliWizardDraftChange(next, {
          getEnvelope: () => denaliEnvelopeRef.current,
          setEnvelope: (prepared) => draftSync.setData(prepared),
          denaliRules,
          denaliPlugin,
          wizardRuleEvalContext: wizardRuleEvalContext as DenaliWizardRuleEvalContext | undefined,
        });
      }
    },
    [draftSync, denaliRules, denaliPlugin, wizardRuleEvalContext]
  );

  const onActiveStepIndexChange = useCallback(
    (index: number) => {
      if (denaliEnvelope === null) {
        return;
      }
      if (denaliEnvelope.meta.currentStepIndex === index) {
        return;
      }
      draftSync.setData(
        prepareEnvelope(denaliEnvelope.form, {
          ...denaliEnvelope.meta,
          currentStepIndex: index,
        })
      );
    },
    [denaliEnvelope, draftSync]
  );

  const onSubmit = () => {
    setSubmitError(null);
    setSubmitValidationIssues(null);
    startTransition(async () => {
      if (denaliRules == null) {
        setSubmitError(t("submit.errorGeneric", { status: 0, code: "DENALI_RULES_NOT_READY" }));
        return;
      }
      const plugin = getDenaliWorkspacePlugin();
      const publishStatus = getCanonicalStringValue(draft, "publishStatus");
      let validation;
      if (publishStatus === "active") {
        if (wizardRuleEvalContext === undefined) {
          setSubmitError(
            t("submit.errorGeneric", { status: 0, code: "DENALI_RULES_NOT_READY" })
          );
          return;
        }
        validation = validateDenaliPublishTransitionSync(
          plugin,
          draft,
          denaliRules,
          session.tenantId,
          wizardRuleEvalContext
        );
      } else {
        validation = validateDenaliWizardDraftSync(plugin, draft, denaliRules, session.tenantId);
      }
      if (!validation.ok) {
        const resolveStepId = buildFieldStepResolverFromTemplate(gate.templateSteps);
        setSubmitValidationIssues(
          mapValidationResultToIssues(validation, { resolveStepId })
        );
        setSubmitError(t("submit.validationFailed"));
        return;
      }
      let activeEquipmentIds: readonly string[] | undefined;
      let activeThemeIds: readonly string[] | undefined;
      let activeGuideLanguageIds: readonly string[] | undefined;
      let activeDestinationIds: readonly string[] | undefined;
      let selectableLeaderIds: readonly string[] | undefined;
      try {
        const [equipmentResponse, themesResponse, guideLanguagesResponse, locationsResponse, usersResponse] =
          await Promise.all([
            fetch("/api/settings/resources/equipment", { cache: "no-store" }),
            fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
            fetch("/api/settings/resources/guide_languages", { cache: "no-store" }),
            fetch("/api/settings/resources/locations", { cache: "no-store" }),
            fetch("/api/users?role=all&status=active", { cache: "no-store" }),
          ]);
        if (equipmentResponse.ok) {
          const equipmentPayload = (await equipmentResponse.json()) as {
            items?: Array<{ id: string; isActive?: boolean }>;
          };
          activeEquipmentIds = readActiveEquipmentIds(equipmentPayload.items ?? []);
        }
        if (themesResponse.ok) {
          const themesPayload = (await themesResponse.json()) as {
            items?: readonly TourThemeResource[];
          };
          activeThemeIds = readActiveThemeIds(themesPayload.items ?? []);
        }
        if (guideLanguagesResponse.ok) {
          const guideLanguagesPayload = (await guideLanguagesResponse.json()) as {
            items?: readonly GuideLanguageResource[];
          };
          activeGuideLanguageIds = readActiveGuideLanguageIds(guideLanguagesPayload.items ?? []);
        }
        if (locationsResponse.ok) {
          const locationsPayload = parseLocationsResponse(await locationsResponse.json());
          activeDestinationIds = readActiveDestinationIds(locationsPayload.destinations);
        }
        if (usersResponse.ok) {
          const usersPayload = (await usersResponse.json()) as UsersListResponse;
          selectableLeaderIds = readSelectableLeaderUserIds(usersPayload.items ?? []);
        }
      } catch {
        activeEquipmentIds = undefined;
        activeThemeIds = undefined;
        activeGuideLanguageIds = undefined;
        activeDestinationIds = undefined;
        selectableLeaderIds = undefined;
      }
      const prepare = plugin.wizardHost?.prepareSubmitPayload;
      if (prepare == null) {
        setSubmitError(t("submit.errorGeneric", { status: 0, code: "WIZARD_SUBMIT_NOT_CONFIGURED" }));
        return;
      }
      const payload = prepare({
        plugin,
        draft: draft as unknown as Record<string, unknown>,
        rulesModule: denaliRules,
        evalContext: wizardRuleEvalContext,
        catalog: {
          activeEquipmentIds,
          activeThemeIds,
          activeGuideLanguageIds,
          activeDestinationIds,
          selectableLeaderIds,
        },
      }) as CreateTourPayload;
      const result = await createTourAction(payload);
      if (!result.ok) {
        setSubmitError(t("submit.errorGeneric", { status: result.status, code: result.code }));
        return;
      }
      await draftSync.clearDraft();
      setCreatedTourId(result.record.id);
    });
  };

  if (gate.loading || (cloneTourId !== null && cloneStatus === "loading")) {
    return (
      <div data-new-tour-wizard>
        <p
          className="new-tour-wizard-page__loading"
          data-workspace-wizard-loading
          data-testid={
            cloneTourId !== null ? TOUR_CLONE_HYDRATE_TEST_IDS.loading : undefined
          }
        >
          {cloneTourId !== null ? t("clone.loading") : t("loading")}
        </p>
      </div>
    );
  }

  if (cloneTourId !== null && cloneStatus === "error") {
    return (
      <div data-new-tour-wizard>
        <p
          className="new-tour-wizard-page__empty-desc"
          role="alert"
          data-testid={TOUR_CLONE_HYDRATE_TEST_IDS.error}
        >
          {t("clone.error", { error: cloneError ?? "TOUR_CLONE_FAILED" })}
        </p>
      </div>
    );
  }

  if (!gate.published) {
    return (
      <div data-new-tour-wizard>
        <section className="new-tour-wizard-page__empty" data-testid={WIZARD_TEMPLATE_GATE_TEST_IDS.emptyState}>
          <h1 className="new-tour-wizard-page__empty-title">{t("notConfigured.title")}</h1>
          <p className="new-tour-wizard-page__empty-desc">{t("notConfigured.description")}</p>
          <Button asChild data-testid={WIZARD_TEMPLATE_GATE_TEST_IDS.configureLink}>
            <Link href="/settings/tour-wizard-template">{t("notConfigured.configureLink")}</Link>
          </Button>
        </section>
      </div>
    );
  }

  if (!denaliDraftReady) {
    return (
      <div data-new-tour-wizard>
        <p
          className="new-tour-wizard-page__loading"
          data-workspace-wizard-loading
          data-testid="wizard-draft-hydrate-loading"
        >
          {t("loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="new-tour-wizard-page" data-new-tour-wizard>
      <header className="new-tour-wizard-page__header">
        <div className="new-tour-wizard-page__header-main">
          <div className="new-tour-wizard-page__header-copy">
            <h1 className="new-tour-wizard-page__title">{t("pageTitle")}</h1>
            <p className="new-tour-wizard-page__subtitle">{t("pageSubtitle")}</p>
          </div>
          <div className="new-tour-wizard-page__header-actions">
            <DraftSyncChrome
              status={draftSync.status}
              schemaIssues={draftSync.schemaIssues}
              navLocked={draftSync.navLocked}
              pendingDraft={draftSync.pendingDraft}
              conflictReloadNotice={draftSync.conflictReloadNotice}
              onRetry={() => void draftSync.retry()}
              onFlush={() => void draftSync.flush()}
              onApplyPending={draftSync.applyDraft}
              onDiscardPending={() => {
                if (draftSync.pendingDraft != null) {
                  draftSync.setData(draftSync.pendingDraft.data, { source: "remote" });
                }
              }}
              clearDraftPending={clearDraftPending}
              canRevertQuarantine={draftSync.canRevertQuarantine}
              onRevertQuarantine={draftSync.revertToLastValid}
              rowClassName="new-tour-wizard-page__header-actions flex flex-wrap items-center gap-2"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="wizard-clear-draft"
              disabled={
                clearDraftPending ||
                draftSync.navLocked ||
                draftSync.status === "SYNCING"
              }
              onClick={requestClearDraft}
            >
              {clearDraftPending ? t("clearingDraft") : t("clearDraft")}
            </Button>
          </div>
        </div>
        {clearDraftConfirmDialog}
        <WorkspaceDraftIndexSummary
          items={draftIndex.items}
          loading={draftIndex.loading}
          currentDraftKey={DENALI_CREATE_TOUR_DRAFT_KEY}
        />
        {clearDraftError ? (
          <p
            className="new-tour-wizard-page__clear-draft-error"
            role="alert"
            data-testid="wizard-clear-draft-error"
          >
            {clearDraftError}
          </p>
        ) : null}
      </header>
      {showSeedBanner ? (
        <p
          className="new-tour-wizard-page__seed-banner"
          data-testid={WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedApplied}
          data-seed-label={gate.seedLabel}
        >
          {t("seedApplied", { label: gate.seedLabel })}
        </p>
      ) : null}
      {presetApplied && presetId ? (
        <p
          className="new-tour-wizard-page__seed-banner"
          data-testid={TOUR_PRESET_PREFILL_TEST_IDS.applied}
          data-preset-id={presetId}
        >
          {t("presetApplied")}
        </p>
      ) : null}
      <WorkspaceWizardHost
        pluginId={session.pluginId}
        tenantId={session.tenantId}
        workspaceId={session.workspaceId}
        authz={session.authz}
        draft={draft}
        onDraftChange={onDraftChange}
        allowedCanonicalPaths={gate.allowedCanonicalPaths}
        templateSteps={gate.templateSteps}
        wizardSessionId={wizardSessionId}
        activeStepIndex={activeStepIndex}
        onActiveStepIndexChange={onActiveStepIndexChange}
        navLocked={draftSync.navLocked || clearDraftPending}
        draftSyncStatus={draftSync.status}
        submitValidationIssues={submitValidationIssues}
        onSubmitValidationHandled={() => setSubmitValidationIssues(null)}
        wizardRuleEvalContext={wizardRuleEvalContext}
        draftHydrated={denaliDraftHydrated}
        draftResumeEpoch={draftResumeEpoch}
        suppressDraftStepInference={denaliEnvelope?.meta.freshStart === true}
        renderFooter={() => (
          <div data-wizard-footer>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? t("creating") : t("createButton")}
            </Button>
            {submitError ? (
              <p role="alert" data-tour-create-error>
                {submitError}
              </p>
            ) : null}
            {createdTourId ? (
              <p data-tour-created>
                {t("created", { id: createdTourId })}
              </p>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
