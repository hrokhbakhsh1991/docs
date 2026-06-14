"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  createDenaliWizardDraftSessionId,
  denaliEditTourDraftKey,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "@app-tour/workspace-denali/draft";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import type { UpdateTourPayload } from "@app-tour/workspace-sdk";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";

import { isOwnerRole, type OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DraftConflictBanner } from "@/draft/draft-conflict-banner";
import { DraftSyncIndicator } from "@/draft/draft-sync-indicator";
import {
  mergeDenaliWizardDraftEnvelope,
  type NewTourWizardDraftEnvelope,
} from "@/draft/denali-wizard-draft-merge";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { loadDenaliWizardRulesModule, type DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "@/features/tours/tour-list-formatters";
import type { AppLocale } from "@/i18n/routing";
import { resolveDenaliStepLabel } from "@/i18n/denali-wizard-labels";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import { useAppSession } from "@/providers/app-session-context";
import type { TourThemeResource } from "@/features/settings/settings-module-types";
import { parseLocationsResponse } from "@/features/settings/locations-logic";
import { readActiveEquipmentIds } from "@/tours/tour-clone-hydrate-logic";
import { hydrateTourEditDraft } from "@/tours/tour-edit-hydrate-logic";
import { mapTourPatchErrorCode } from "@/tours/tour-edit-error-logic";
import { emptyTourWizardDraft, type TourWizardDraft } from "@/tours/tour-wizard-draft";
import { updateTourAction } from "@/tours/update-tour.server";
import {
  resolveWizardTemplateGateState,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import { resolveWizardStepLabel } from "@/wizard/wizard-step-shell-logic";
import { useWizardStepValidation } from "@/wizard/use-wizard-step-validation";
import {
  readActiveDestinationIds,
  readActiveGuideLanguageIds,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
} from "@/wizard/denali/denali-catalog-sanitize";
import { DenaliFlatEditForm } from "@/wizard/denali/denali-flat-edit-form";
import { createDenaliFieldFocusRegistry } from "@/wizard/denali/denali-field-focus-registry";
import { DenaliReviewValidationSummary } from "@/wizard/denali/denali-review-validation-summary";
import { DenaliWizardCatalogPrefetchProvider } from "@/wizard/denali/denali-wizard-catalog-prefetch-context";
import {
  buildFieldStepResolverFromTemplate,
  validateDenaliPublishTransitionSync,
  validateDenaliWizardDraftSync,
} from "@/wizard/denali/denali-wizard-validation";
import { useDenaliFlatEditRuleSync } from "@/wizard/denali/use-denali-flat-edit-rule-sync";

import { TourStatusBadge } from "../../tour-status-badge";

const INITIAL_GATE: WizardTemplateGateState = {
  loading: true,
  published: false,
  allowedCanonicalPaths: [],
  templateSteps: [],
  fieldOverlays: new Map(),
  seedLabel: "",
  fieldRulesOverlay: {},
  workspaceFormProfile: "denali_pilot",
};

type DenaliFlatEditPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly initialLocationsResponse?: unknown | null;
};

export function DenaliFlatEditPageClient({
  session,
  tourId,
  initialLocationsResponse = null,
}: DenaliFlatEditPageClientProps) {
  const locale = useLocale() as AppLocale;
  const appSession = useAppSession();
  const t = useTranslations("tours.edit");
  const tErrors = useTranslations("tours.edit.errors");
  const tNav = useTranslations("tours.nav");
  const tFormat = useTranslations("tours.format");
  const tWizard = useTranslations("wizard");
  const tDenali = useTranslations("denali");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const plugin = useMemo(() => getDenaliWorkspacePlugin(), []);
  const wizardSessionId = useMemo(() => createDenaliWizardDraftSessionId(), []);
  const editDraftKey = useMemo(() => denaliEditTourDraftKey(tourId), [tourId]);
  const envelopeMeta = useMemo(
    () => ({ currentStepIndex: 0, wizardSessionId }),
    [wizardSessionId]
  );

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: appSession.workspaceId,
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: editDraftKey,
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 800,
    merge: mergeDenaliWizardDraftEnvelope,
  });

  const [detail, setDetail] = useState<OperatorTourDetailResponse | null>(null);
  const [tourBaseline, setTourBaseline] = useState<TourWizardDraft | null>(null);
  const [rowVersion, setRowVersion] = useState<number | null>(null);
  const [gate, setGate] = useState<WizardTemplateGateState>(INITIAL_GATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitValidationIssues, setSubmitValidationIssues] = useState<
    readonly ValidationIssue[] | null
  >(null);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [unpublished, setUnpublished] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [pending, startTransition] = useTransition();
  const [denaliRules, setDenaliRules] = useState<DenaliWizardRulesModule | null>(null);
  const [themeCatalog, setThemeCatalog] = useState<readonly TourThemeResource[]>([]);

  const flatEditStepDescriptors = useMemo(
    () =>
      gate.templateSteps
        .filter((step) => step.enabled !== false)
        .map((step) => ({
          stepId: step.stepId,
          label: resolveWizardStepLabel(step.stepId, gate.templateSteps, (stepId) =>
            resolveDenaliStepLabel(tDenali, stepId)
          ),
        })),
    [gate.templateSteps, tDenali]
  );

  const scrollToFlatEditStep = useCallback(async (stepId: string) => {
    const section = document.querySelector(`[data-denali-flat-edit-section="${stepId}"]`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const denaliFocusRegistry = useMemo(() => createDenaliFieldFocusRegistry(), []);
  const { focusIssue } = useWizardStepValidation({
    registry: denaliFocusRegistry,
    goToStep: scrollToFlatEditStep,
    focusOptions: { scrollBehavior: "smooth", scrollBlock: "center", highlight: true },
  });

  const handleFocusValidationIssue = useCallback(
    (stepId: string, path: string) => {
      void (async () => {
        await scrollToFlatEditStep(stepId);
        await focusIssue({ path, message: "", stepId });
      })();
    },
    [scrollToFlatEditStep, focusIssue]
  );

  const envelope = useMemo((): NewTourWizardDraftEnvelope | null => {
    if (draftSync.data !== null) {
      return draftSync.data;
    }
    if (tourBaseline === null) {
      return null;
    }
    return denaliHydrateDraftEnvelope(null, tourBaseline, envelopeMeta);
  }, [draftSync.data, tourBaseline, envelopeMeta]);

  const draft = envelope?.form ?? emptyTourWizardDraft();

  const persistDraft = useCallback(
    (next: TourWizardDraft) => {
      const meta = envelope?.meta ?? envelopeMeta;
      draftSync.setData(denaliPrepareDraftEnvelope(next, meta));
    },
    [draftSync, envelope, envelopeMeta]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rules, templateResponse, tourResponse, equipmentResponse, locationsResponse, themesResponse] =
          await Promise.all([
            loadDenaliWizardRulesModule(),
            fetch("/api/settings/tour-wizard-template", { cache: "no-store" }),
            fetch(`/api/tours/${encodeURIComponent(tourId)}`, { cache: "no-store" }),
            fetch("/api/settings/resources/equipment", { cache: "no-store" }),
            fetch("/api/settings/resources/locations", { cache: "no-store" }),
            fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
          ]);

        if (cancelled) {
          return;
        }

        setDenaliRules(rules);

        const templatePayload = templateResponse.ok
          ? ((await templateResponse.json()) as unknown)
          : null;
        const nextGate = resolveWizardTemplateGateState(templatePayload, session.pluginId);
        setGate(nextGate);

        if (themesResponse.ok) {
          const themesPayload = (await themesResponse.json()) as {
            items?: readonly TourThemeResource[];
          };
          setThemeCatalog(themesPayload.items ?? []);
        } else {
          setThemeCatalog([]);
        }

        if (tourResponse.status === 404) {
          setDetail(null);
          setError("TOUR_NOT_FOUND");
          return;
        }
        if (!tourResponse.ok) {
          throw new Error(`TOUR_EDIT_HTTP_${tourResponse.status}`);
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
          throw new Error("TOUR_EDIT_HYDRATOR_UNAVAILABLE");
        }
        setDetail(tourDetail);
        setTourBaseline(hydrated);
        setRowVersion(tourDetail.rowVersion);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "TOUR_EDIT_LOAD_FAILED");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plugin, session.pluginId, tourId]);

  const loadTour = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tourResponse, equipmentResponse, locationsResponse] = await Promise.all([
        fetch(`/api/tours/${encodeURIComponent(tourId)}`, { cache: "no-store" }),
        fetch("/api/settings/resources/equipment", { cache: "no-store" }),
        fetch("/api/settings/resources/locations", { cache: "no-store" }),
      ]);
      if (tourResponse.status === 404) {
        setDetail(null);
        setError("TOUR_NOT_FOUND");
        return;
      }
      if (!tourResponse.ok) {
        throw new Error(`TOUR_EDIT_HTTP_${tourResponse.status}`);
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
        throw new Error("TOUR_EDIT_HYDRATOR_UNAVAILABLE");
      }
      setDetail(tourDetail);
      setTourBaseline(hydrated);
      setRowVersion(tourDetail.rowVersion);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "TOUR_EDIT_LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, [plugin, tourId]);

  useEffect(() => {
    if (!gate.published || tourBaseline === null) {
      return;
    }
    if (draftSync.data !== null) {
      return;
    }
    if (draftSync.status === "SYNCING" || draftSync.status === "CONFLICT_RESOLVING") {
      return;
    }
    draftSync.setData(denaliPrepareDraftEnvelope(tourBaseline, envelopeMeta));
  }, [
    gate.published,
    tourBaseline,
    draftSync.data,
    draftSync.status,
    draftSync.setData,
    envelopeMeta,
  ]);

  const { wizardRuleEvalContext, onDraftChange } = useDenaliFlatEditRuleSync({
    plugin,
    draft,
    setDraft: persistDraft,
    denaliRules,
    gate,
    themeCatalog,
  });

  const handlePatch = (patchIntent: "save" | "publish" | "unpublish") => {
    setSubmitError(null);
    setSubmitValidationIssues(null);
    setSaved(false);
    setPublished(false);
    setUnpublished(false);
    setPendingIntent(patchIntent);
    startTransition(async () => {
      if (denaliRules == null || rowVersion == null) {
        setSubmitError("TOUR_EDIT_NOT_READY");
        setPendingIntent(null);
        return;
      }
      const validation =
        patchIntent === "publish"
          ? validateDenaliPublishTransitionSync(
              plugin,
              draft,
              denaliRules,
              session.tenantId,
              wizardRuleEvalContext
            )
          : validateDenaliWizardDraftSync(
              plugin,
              draft,
              denaliRules,
              session.tenantId,
              undefined,
              wizardRuleEvalContext
            );
      if (!validation.ok) {
        const resolveStepId = buildFieldStepResolverFromTemplate(gate.templateSteps);
        setSubmitValidationIssues(mapValidationResultToIssues(validation, { resolveStepId }));
        setSubmitError("TOUR_EDIT_VALIDATION_FAILED");
        setPendingIntent(null);
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
            items?: Array<{ id: string; isActive?: boolean }>;
          };
          activeThemeIds = readActiveThemeIds(themesPayload.items ?? []);
        }
        if (guideLanguagesResponse.ok) {
          const guideLanguagesPayload = (await guideLanguagesResponse.json()) as {
            items?: Array<{ id: string; isActive?: boolean }>;
          };
          activeGuideLanguageIds = readActiveGuideLanguageIds(guideLanguagesPayload.items ?? []);
        }
        if (locationsResponse.ok) {
          const locationsPayload = parseLocationsResponse(await locationsResponse.json());
          activeDestinationIds = readActiveDestinationIds(locationsPayload.destinations);
        }
        if (usersResponse.ok) {
          const usersPayload = (await usersResponse.json()) as {
            items?: Array<{ userId: string; role: string; status: string }>;
          };
          selectableLeaderIds = readSelectableLeaderUserIds(usersPayload.items ?? []);
        }
      } catch {
        activeEquipmentIds = undefined;
        activeThemeIds = undefined;
        activeGuideLanguageIds = undefined;
        activeDestinationIds = undefined;
        selectableLeaderIds = undefined;
      }
      const preparePatch = plugin.wizardHost?.prepareTourPatchPayload;
      if (preparePatch == null) {
        setSubmitError("TOUR_EDIT_PATCH_NOT_CONFIGURED");
        setPendingIntent(null);
        return;
      }
      const payload = preparePatch({
        plugin,
        draft: draft as unknown as Record<string, unknown>,
        rulesModule: denaliRules,
        evalContext: wizardRuleEvalContext,
        rowVersion,
        patchIntent,
        catalog: {
          activeEquipmentIds,
          activeThemeIds,
          activeGuideLanguageIds,
          activeDestinationIds,
          selectableLeaderIds,
        },
      }) as UpdateTourPayload;
      const result = await updateTourAction(tourId, payload);
      if (!result.ok) {
        const code = mapTourPatchErrorCode(result.code, result.status);
        setSubmitError(code);
        setPendingIntent(null);
        if (code === "TOUR_EDIT_AUTH_TOKEN_REVOKED") {
          router.replace(`/auth/login?returnTo=${encodeURIComponent(`/tours/${tourId}/edit`)}`);
        }
        return;
      }
      setRowVersion(result.rowVersion);
      if (patchIntent === "publish") {
        setPublished(true);
      } else if (patchIntent === "unpublish") {
        setUnpublished(true);
      } else {
        setSaved(true);
      }
      setPendingIntent(null);
      await draftSync.clearDraft();
      router.refresh();
      void loadTour();
    });
  };

  const canPublish = isOwnerRole(session.role);
  const canUnpublish = canPublish && detail?.projection.uiStatus === "active";
  const formReady = envelope !== null;

  const localizedLoadError = resolveTourErrorMessage(tErrors, error);
  const localizedSubmitError = resolveTourErrorMessage(tErrors, submitError);

  if (gate.loading || loading) {
    return (
      <div className="space-y-4" data-testid={TOUR_EDIT_TEST_IDS.page}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!gate.published) {
    return (
      <Card data-testid={TOUR_EDIT_TEST_IDS.page}>
        <CardContent className="py-8 text-center text-muted-foreground">
          {tWizard("notConfigured.description")}
        </CardContent>
      </Card>
    );
  }

  if (error === "TOUR_NOT_FOUND" || detail === null) {
    return (
      <Card data-testid={TOUR_EDIT_TEST_IDS.page}>
        <CardContent className="py-10 text-center text-muted-foreground">
          {localizedLoadError ?? t("notFound")}
        </CardContent>
      </Card>
    );
  }

  if (localizedLoadError !== null) {
    return (
      <Card data-testid={TOUR_EDIT_TEST_IDS.page}>
        <CardContent className="py-10 text-center text-destructive">{localizedLoadError}</CardContent>
      </Card>
    );
  }

  if (!formReady) {
    return (
      <div className="space-y-4" data-testid={TOUR_EDIT_TEST_IDS.page}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const priceLabel = formatTourPrice(
    detail.projection.priceAmount,
    detail.projection.priceCurrency,
    locale
  );
  const departureLabel = formatTourDeparture(detail.projection.departureAt, locale);
  const seatsLabel = formatTourSeats(detail.projection, {
    withCapacity: (accepted, capacity) => tFormat("seatsWithCapacity", { accepted, capacity }),
    open: (accepted) => tFormat("seatsOpen", { accepted }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid={TOUR_EDIT_TEST_IDS.page} data-new-tour-wizard>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/tours">
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {tNav("tours")}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(tourId)}/workspace`}>
          <Button type="button" variant="outline" size="sm" data-testid={TOUR_EDIT_TEST_IDS.workspace}>
            {tNav("workspace")}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(tourId)}/register`}>
          <Button type="button" variant="default" size="sm" data-testid={TOUR_EDIT_TEST_IDS.register}>
            {tNav("registerGuest")}
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid={TOUR_EDIT_TEST_IDS.draftSync}
        >
          <DraftSyncIndicator status={draftSync.status} onRetry={() => void draftSync.retry()} />
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
        </div>
        <TourStatusBadge status={detail.projection.uiStatus} />
        <h1 className="text-2xl font-semibold">{detail.projection.title}</h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {departureLabel ? <span>{departureLabel}</span> : null}
          {priceLabel ? <span>{priceLabel}</span> : null}
          <span>{seatsLabel}</span>
        </div>
      </div>

      <DenaliWizardCatalogPrefetchProvider initialLocationsResponse={initialLocationsResponse}>
        <DenaliFlatEditForm
          tenantId={session.tenantId}
          draft={draft}
          onDraftChange={onDraftChange}
          templateSteps={gate.templateSteps}
          allowedCanonicalPaths={gate.allowedCanonicalPaths}
          wizardRuleEvalContext={wizardRuleEvalContext}
          wizardSessionId={wizardSessionId}
          denaliRulesModule={denaliRules}
          footer={
          <div className="space-y-3 pt-2">
            {submitValidationIssues != null && submitValidationIssues.length > 0 ? (
              <DenaliReviewValidationSummary
                issues={submitValidationIssues}
                stepDescriptors={flatEditStepDescriptors}
                onFocusIssue={handleFocusValidationIssue}
                fieldLabelSurfaceId="denali"
                translateWorkspaceMessage={(key) => tDenali(key)}
              />
            ) : null}
            {localizedSubmitError ? (
              <p role="alert" className="text-sm text-destructive">
                {localizedSubmitError}
              </p>
            ) : null}
            {saved ? <p className="text-sm text-muted-foreground">{t("saved")}</p> : null}
            {published ? <p className="text-sm text-muted-foreground">{t("published")}</p> : null}
            {unpublished ? <p className="text-sm text-muted-foreground">{t("unpublished")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Link href="/tours">
                <Button
                  type="button"
                  variant="ghost"
                  data-testid={TOUR_EDIT_TEST_IDS.cancel}
                  disabled={pending}
                >
                  {t("cancelEdits")}
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                data-testid={TOUR_EDIT_TEST_IDS.save}
                disabled={pending || draftSync.navLocked}
                onClick={() => void handlePatch("save")}
              >
                {pending && pendingIntent === "save" ? tCommon("saving") : t("saveChanges")}
              </Button>
              {canPublish ? (
                <Button
                  type="button"
                  data-testid={TOUR_EDIT_TEST_IDS.publish}
                  disabled={pending || draftSync.navLocked}
                  onClick={() => void handlePatch("publish")}
                >
                  {pending && pendingIntent === "publish" ? t("publishing") : t("publishChanges")}
                </Button>
              ) : null}
              {canUnpublish ? (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid={TOUR_EDIT_TEST_IDS.unpublish}
                  disabled={pending || draftSync.navLocked}
                  onClick={() => void handlePatch("unpublish")}
                >
                  {pending && pendingIntent === "unpublish" ? t("unpublishing") : t("unpublishChanges")}
                </Button>
              ) : null}
            </div>
          </div>
        }
        />
      </DenaliWizardCatalogPrefetchProvider>
    </div>
  );
}
