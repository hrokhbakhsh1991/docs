"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";

import {
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "@app-tour/workspace-denali/draft";
import { Button } from "@app-tour/ui-primitives/button";

import { DraftConflictBanner } from "@/draft/draft-conflict-banner";
import { DraftSyncIndicator } from "@/draft/draft-sync-indicator";
import { useWorkspaceDraftEvents } from "@/draft/use-workspace-draft-events";
import { useWorkspaceDraftIndex } from "@/draft/use-workspace-draft-index";
import { WorkspaceDraftEventsTimeline } from "@/draft/workspace-draft-events-timeline";
import { WorkspaceDraftIndexSummary } from "@/draft/workspace-draft-index-summary";
import {
  mergeDenaliWizardDraftEnvelope,
  type NewTourWizardDraftEnvelope,
} from "@/draft/denali-wizard-draft-merge";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import { emptyTourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue } from "@/tours/tour-wizard-draft-path";
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
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type { TourPresetResource, TourThemeResource } from "@/features/settings/settings-module-types";
import { loadDenaliWizardRulesModule, type DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import { sanitizeDenaliWizardDraft } from "@/wizard/denali/denali-draft-form-adapter";
import {
  buildFieldStepResolverFromTemplate,
  validateDenaliPublishTransitionSync,
  validateDenaliWizardDraftSync,
} from "@/wizard/denali/denali-wizard-validation";
import {
  readActiveGuideLanguageIds,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
  resolveMainThemeFormProfileFromCatalog,
} from "@/wizard/denali/denali-catalog-sanitize";
import { buildDenaliWizardRuleEvalContext, type DenaliWizardRuleEvalContext } from "@/wizard/denali/denali-wizard-ui-context";
import type { CreateTourPayload } from "@app-tour/workspace-sdk";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";

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

function buildPrefilledForm(
  gate: WizardTemplateGateState,
  pluginId: string
): ReturnType<typeof emptyTourWizardDraft> {
  return applyWizardTemplatePrefillToDraft(
    emptyTourWizardDraft(),
    gate.seedLabel,
    gate.fieldOverlays,
    pluginId
  );
}

export function NewTourWizardClient() {
  const t = useTranslations("wizard");
  const searchParams = useSearchParams();
  const session = useAppSession();
  const isDenali = session.pluginId === "denali";
  const cloneTourId = useMemo(
    () => resolveCloneTourId(searchParams.get("clone")),
    [searchParams]
  );
  const presetId = useMemo(() => resolvePresetId(searchParams.get("preset")), [searchParams]);
  const [localDraft, setLocalDraft] = useState(() => emptyTourWizardDraft());
  const [localStepIndex, setLocalStepIndex] = useState(0);
  const [gate, setGate] = useState<WizardTemplateGateState>(INITIAL_GATE_STATE);
  const [cloneStatus, setCloneStatus] = useState<TourCloneHydrateStatus>("idle");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitValidationIssues, setSubmitValidationIssues] = useState<
    readonly ValidationIssue[] | null
  >(null);
  const [createdTourId, setCreatedTourId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wizardSessionId = useMemo(() => createDenaliWizardDraftSessionId(), []);
  const [denaliRules, setDenaliRules] = useState<DenaliWizardRulesModule | null>(null);
  const [themeCatalog, setThemeCatalog] = useState<readonly TourThemeResource[]>([]);
  const [presetApplied, setPresetApplied] = useState(false);

  useEffect(() => {
    if (!isDenali) {
      setDenaliRules(null);
      return;
    }
    let cancelled = false;
    void loadDenaliWizardRulesModule().then((rules) => {
      if (!cancelled) {
        setDenaliRules(rules);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isDenali]);

  useEffect(() => {
    if (!isDenali || !gate.published) {
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
  }, [isDenali, gate.published]);

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: session.workspaceId,
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
    conflictStrategy: "REFETCH_REAPPLY",
    merge: mergeDenaliWizardDraftEnvelope,
    hydrateFromRemote: shouldHydrateDraftFromRemote(cloneTourId, session.pluginId),
  });

  const draftIndex = useWorkspaceDraftIndex(
    isDenali ? session.workspaceId : undefined,
    DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE
  );

  const draftEvents = useWorkspaceDraftEvents(
    isDenali ? session.workspaceId : undefined,
    DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    DENALI_CREATE_TOUR_DRAFT_KEY,
    draftSync.version
  );

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
    if (!cloneTourId || !isDenali || !gate.published) {
      setCloneStatus("idle");
      setCloneError(null);
      return;
    }

    let cancelled = false;
    setCloneStatus("loading");
    setCloneError(null);

    void (async () => {
      try {
        const [tourResponse, equipmentResponse] = await Promise.all([
          fetch(buildCloneTourDetailUrl(cloneTourId), { cache: "no-store" }),
          fetch("/api/settings/resources/equipment", { cache: "no-store" }),
        ]);
        if (!tourResponse.ok) {
          throw new Error(`TOUR_CLONE_HTTP_${tourResponse.status}`);
        }
        const detail = (await tourResponse.json()) as OperatorTourDetailResponse;
        let activeEquipmentIds: readonly string[] | undefined;
        if (equipmentResponse.ok) {
          const equipmentPayload = (await equipmentResponse.json()) as {
            items?: Array<{ id: string; isActive?: boolean }>;
          };
          activeEquipmentIds = readActiveEquipmentIds(equipmentPayload.items ?? []);
        }
        const hydrated = hydrateTourCloneDraft(session.pluginId, detail, {
          activeEquipmentIds,
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
          denaliPrepareDraftEnvelope(hydrated.draft, {
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
    isDenali,
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
    const prefilled = buildPrefilledForm(gate, session.pluginId);
    if (!isDenali) {
      setLocalDraft(prefilled);
      return;
    }
    if (draftSync.data !== null) {
      return;
    }
    if (draftSync.status === "SYNCING" || draftSync.status === "CONFLICT_RESOLVING") {
      return;
    }
    draftSync.setData(
      denaliPrepareDraftEnvelope(prefilled, {
        currentStepIndex: 0,
        wizardSessionId,
      })
    );
  }, [
    gate,
    isDenali,
    session.pluginId,
    wizardSessionId,
    draftSync.data,
    draftSync.status,
    draftSync.setData,
    cloneTourId,
  ]);

  useEffect(() => {
    if (!presetId || !isDenali || !gate.published || cloneTourId !== null) {
      setPresetApplied(false);
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
        const applyPreset = (base: ReturnType<typeof emptyTourWizardDraft>) =>
          applyTourPresetToDraft(base, resolved.preset, resolved.activeThemeIds);
        if (!isDenali) {
          setLocalDraft((current) => applyPreset(current));
          setPresetApplied(true);
          return;
        }
        if (draftSync.data !== null) {
          draftSync.setData(
            denaliPrepareDraftEnvelope(applyPreset(draftSync.data.form), draftSync.data.meta)
          );
        } else {
          const prefilled = applyPreset(buildPrefilledForm(gate, session.pluginId));
          draftSync.setData(
            denaliPrepareDraftEnvelope(prefilled, {
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
  }, [
    presetId,
    isDenali,
    gate,
    cloneTourId,
    session.pluginId,
    wizardSessionId,
    draftSync.data,
    draftSync.setData,
  ]);

  const denaliEnvelope = useMemo(() => {
    if (!isDenali) {
      return null;
    }
    if (draftSync.data !== null) {
      return draftSync.data;
    }
    if (shouldSkipWizardTemplatePrefill(cloneTourId, session.pluginId)) {
      return null;
    }
    if (!gate.published) {
      return null;
    }
    return denaliHydrateDraftEnvelope(
      null,
      buildPrefilledForm(gate, session.pluginId),
      { currentStepIndex: 0, wizardSessionId }
    );
  }, [isDenali, draftSync.data, gate, session.pluginId, wizardSessionId, cloneTourId]);

  const showSeedBanner =
    gate.seedLabel.length > 0 &&
    !shouldSkipWizardTemplatePrefill(cloneTourId, session.pluginId);

  const draft = isDenali ? (denaliEnvelope?.form ?? emptyTourWizardDraft()) : localDraft;
  const activeStepIndex = isDenali ? (denaliEnvelope?.meta.currentStepIndex ?? 0) : localStepIndex;

  const denaliPlugin = useMemo(() => (isDenali ? getDenaliWorkspacePlugin() : null), [isDenali]);

  const wizardRuleEvalContext = useMemo(() => {
    if (denaliPlugin == null) {
      return undefined;
    }
    const build = denaliPlugin.wizardHost?.buildRuleEvalContext;
    const input = {
      workspaceFormProfile: gate.workspaceFormProfile,
      fieldRulesOverlay: gate.fieldRulesOverlay,
      mainThemeFormProfile: resolveMainThemeFormProfileFromCatalog(
        getCanonicalValue(draft, "program.themeIds"),
        themeCatalog
      ),
    };
    return build != null ? build(input) : buildDenaliWizardRuleEvalContext(input);
  }, [denaliPlugin, gate.workspaceFormProfile, gate.fieldRulesOverlay, draft, themeCatalog]);

  const onDraftChange = useCallback(
    (next: ReturnType<typeof emptyTourWizardDraft>) => {
      const sanitized =
        isDenali && denaliRules != null && denaliPlugin?.wizardHost?.sanitizeWizardDraft != null
          ? (denaliPlugin.wizardHost.sanitizeWizardDraft({
              draft: next as unknown as Record<string, unknown>,
              rulesModule: denaliRules,
              evalContext: wizardRuleEvalContext,
            }) as ReturnType<typeof emptyTourWizardDraft>)
          : isDenali && denaliRules != null
            ? sanitizeDenaliWizardDraft(next, denaliRules, wizardRuleEvalContext as DenaliWizardRuleEvalContext)
            : next;
      if (isDenali && denaliEnvelope !== null) {
        draftSync.setData(denaliPrepareDraftEnvelope(sanitized, denaliEnvelope.meta));
        return;
      }
      setLocalDraft(sanitized);
    },
    [isDenali, denaliEnvelope, draftSync, denaliRules, denaliPlugin, wizardRuleEvalContext]
  );

  const onActiveStepIndexChange = useCallback(
    (index: number) => {
      if (isDenali && denaliEnvelope !== null) {
        draftSync.setData(
          denaliPrepareDraftEnvelope(denaliEnvelope.form, {
            ...denaliEnvelope.meta,
            currentStepIndex: index,
          })
        );
        return;
      }
      setLocalStepIndex(index);
    },
    [isDenali, denaliEnvelope, draftSync]
  );

  const onSubmit = () => {
    setSubmitError(null);
    setSubmitValidationIssues(null);
    startTransition(async () => {
      if (isDenali) {
        if (denaliRules == null) {
          setSubmitError(t("submit.errorGeneric", { status: 0, code: "DENALI_RULES_NOT_READY" }));
          return;
        }
        const plugin = getDenaliWorkspacePlugin();
        const publishStatus = getCanonicalStringValue(draft, "publishStatus");
        const validation =
          publishStatus === "active"
            ? validateDenaliPublishTransitionSync(
                plugin,
                draft,
                denaliRules,
                session.tenantId,
                wizardRuleEvalContext
              )
            : validateDenaliWizardDraftSync(plugin, draft, denaliRules, session.tenantId);
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
        let selectableLeaderIds: readonly string[] | undefined;
        try {
          const [equipmentResponse, themesResponse, guideLanguagesResponse, usersResponse] =
            await Promise.all([
            fetch("/api/settings/resources/equipment", { cache: "no-store" }),
            fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
            fetch("/api/settings/resources/guide_languages", { cache: "no-store" }),
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
              items?: Array<{ id: string; isActive?: boolean }>;
            };
            activeGuideLanguageIds = readActiveGuideLanguageIds(guideLanguagesPayload.items ?? []);
          }
          if (usersResponse.ok) {
            const usersPayload = (await usersResponse.json()) as UsersListResponse;
            selectableLeaderIds = readSelectableLeaderUserIds(usersPayload.items ?? []);
          }
        } catch {
          activeEquipmentIds = undefined;
          activeThemeIds = undefined;
          activeGuideLanguageIds = undefined;
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
        return;
      }
      const result = await createTourAction({ data: draft.data });
      if (!result.ok) {
        setSubmitError(t("submit.errorGeneric", { status: result.status, code: result.code }));
        return;
      }
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

  return (
    <div className="new-tour-wizard-page" data-new-tour-wizard>
      <header className="new-tour-wizard-page__header">
        <h1 className="new-tour-wizard-page__title">{t("pageTitle")}</h1>
        <p className="new-tour-wizard-page__subtitle">{t("pageSubtitle")}</p>
        {isDenali ? (
          <div className="new-tour-wizard-page__draft-sync">
            <WorkspaceDraftIndexSummary
              items={draftIndex.items}
              loading={draftIndex.loading}
              currentDraftKey={DENALI_CREATE_TOUR_DRAFT_KEY}
            />
            <DraftSyncIndicator status={draftSync.status} onRetry={() => void draftSync.retry()} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="wizard-save-draft"
              disabled={
                draftSync.navLocked ||
                draftSync.status === "SYNCING" ||
                (draftSync.status !== "DIRTY" && draftSync.status !== "ERROR")
              }
              onClick={() => void draftSync.flush()}
            >
              {draftSync.status === "SYNCING" ? t("savingDraft") : t("saveDraft")}
            </Button>
            <DraftConflictBanner
              status={draftSync.status}
              pendingDraft={draftSync.pendingDraft}
              onApplyPending={draftSync.applyDraft}
              onDiscardPending={() => {
                if (draftSync.pendingDraft != null) {
                  draftSync.setData(draftSync.pendingDraft.data, { source: "remote" });
                }
              }}
            />
            <WorkspaceDraftEventsTimeline
              items={draftEvents.items}
              loading={draftEvents.loading}
            />
          </div>
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
        navLocked={isDenali ? draftSync.navLocked : false}
        submitValidationIssues={submitValidationIssues}
        onSubmitValidationHandled={() => setSubmitValidationIssues(null)}
        wizardRuleEvalContext={isDenali ? wizardRuleEvalContext : undefined}
        renderFooter={() => (
          <div data-wizard-footer>
            <Button type="button" variant="primary" onClick={onSubmit} disabled={pending}>
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
