"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  createDenaliWizardDraftSessionId,
  createDenaliDraftSchemaGate,
  denaliEditTourDraftKey,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "@app-tour/workspace-denali/draft";
import type { DraftSchemaGate } from "@app-tour/draft-engine";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import type { UpdateTourPayload } from "@app-tour/workspace-sdk";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";

import { isOwnerRole, type OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DraftSyncChrome } from "@/draft/draft-sync-chrome";
import {
  createDenaliDraftOnPushSuccess,
  resolveDenaliDraftConflictStrategy,
  resolveDenaliDraftMerge,
} from "@/draft/draft-unification-v3-options";
import { normalizeDenaliRemoteEnvelope } from "@/draft/denali-draft-normalize-remote";
import {
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
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import { useAppSession } from "@/providers/app-session-context";
import type { TourThemeResource } from "@/features/settings/settings-module-types";
import { parseLocationsResponse } from "@/features/settings/locations-logic";
import { readActiveEquipmentIds } from "@/tours/tour-clone-hydrate-logic";
import { hydrateTourEditDraft } from "@/tours/tour-edit-hydrate-logic";
import { emptyTourWizardDraft, type TourWizardDraft } from "@/tours/tour-wizard-draft";
import { updateTourAction } from "@/tours/update-tour.server";
import {
  resolveWizardTemplateGateState,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import {
  readActiveDestinationIds,
  readActiveGuideLanguageIds,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
} from "@/wizard/denali/denali-catalog-sanitize";
import { DenaliFlatEditForm } from "@/wizard/denali/denali-flat-edit-form";
import { DenaliFlatEditValidationList } from "@/wizard/denali/denali-flat-edit-validation-list";
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
};

export function DenaliFlatEditPageClient({ session, tourId }: DenaliFlatEditPageClientProps) {
  const locale = useLocale() as AppLocale;
  const appSession = useAppSession();
  const t = useTranslations("tours.edit");
  const tErrors = useTranslations("tours.edit.errors");
  const tNav = useTranslations("tours.nav");
  const tFormat = useTranslations("tours.format");
  const tWizard = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const plugin = useMemo(() => getDenaliWorkspacePlugin(), []);
  const wizardSessionId = useMemo(() => createDenaliWizardDraftSessionId(), []);
  const editDraftKey = useMemo(() => denaliEditTourDraftKey(tourId), [tourId]);
  const envelopeMeta = useMemo(
    () => ({ currentStepIndex: 0, wizardSessionId }),
    [wizardSessionId]
  );
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

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: appSession.workspaceId,
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: editDraftKey,
    conflictStrategy: resolveDenaliDraftConflictStrategy(),
    merge: resolveDenaliDraftMerge(),
    onPushSuccess: createDenaliDraftOnPushSuccess(),
    schemaGate: denaliSchemaGate,
    normalizeRemote: normalizeDenaliRemoteEnvelope,
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

  const envelopeRef = useRef(envelope);
  envelopeRef.current = envelope;

  const setEnvelope = useCallback(
    (prepared: NewTourWizardDraftEnvelope) => {
      draftSync.setData(prepared);
    },
    [draftSync]
  );

  const getEnvelope = useCallback(() => envelopeRef.current, []);

  const { wizardRuleEvalContext, onDraftChange } = useDenaliFlatEditRuleSync({
    plugin,
    draft,
    getEnvelope,
    setEnvelope,
    denaliRules,
    gate,
    themeCatalog,
  });

  useEffect(() => {
    void loadDenaliWizardRulesModule().then(setDenaliRules);
  }, []);

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

  useEffect(() => {
    if (!gate.published) {
      return;
    }
    let cancelled = false;
    void fetch("/api/settings/resources/tour_themes", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return { items: [] as readonly TourThemeResource[] };
        }
        return (await response.json()) as {
          items?: readonly TourThemeResource[];
        };
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
    if (gate.published) {
      void loadTour();
    }
  }, [gate.published, loadTour]);

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

  denaliSchemaGateRef.current =
    denaliRules != null && wizardRuleEvalContext !== undefined
      ? createDenaliDraftSchemaGate(denaliRules, wizardRuleEvalContext)
      : null;

  const handlePatch = (patchIntent: "save" | "publish" | "unpublish") => {
    setSubmitError(null);
    setSubmitValidationIssues(null);
    setSaved(false);
    setPublished(false);
    setUnpublished(false);
    setPendingIntent(patchIntent);
    startTransition(async () => {
      if (denaliRules == null || rowVersion == null) {
        setSubmitError(tWizard("submit.errorGeneric", { status: 0, code: "TOUR_EDIT_NOT_READY" }));
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
          : validateDenaliWizardDraftSync(plugin, draft, denaliRules, session.tenantId);
      if (!validation.ok) {
        const resolveStepId = buildFieldStepResolverFromTemplate(gate.templateSteps);
        setSubmitValidationIssues(mapValidationResultToIssues(validation, { resolveStepId }));
        setSubmitError(tWizard("submit.validationFailed"));
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
        setSubmitError(tWizard("submit.errorGeneric", { status: 0, code: "WIZARD_PATCH_NOT_CONFIGURED" }));
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
        setSubmitError(tWizard("submit.errorGeneric", { status: result.status, code: result.code }));
        setPendingIntent(null);
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

  const localizedError = resolveTourErrorMessage(tErrors, error ?? submitError);

  if (gate.loading || loading || !formReady) {
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
          {t("notFound")}
        </CardContent>
      </Card>
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
    <div className="mx-auto max-w-3xl space-y-6" data-testid={TOUR_EDIT_TEST_IDS.page}>
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
      </div>

      <div className="space-y-2">
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
          manualSyncTestId={TOUR_EDIT_TEST_IDS.save}
          rowTestId={TOUR_EDIT_TEST_IDS.draftSync}
          showInlineSoftLockBanner
          canRevertQuarantine={draftSync.canRevertQuarantine}
          onRevertQuarantine={draftSync.revertToLastValid}
        />
        <TourStatusBadge status={detail.projection.uiStatus} />
        <h1 className="text-2xl font-semibold">{detail.projection.title}</h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {departureLabel ? <span>{departureLabel}</span> : null}
          {priceLabel ? <span>{priceLabel}</span> : null}
          <span>{seatsLabel}</span>
        </div>
      </div>

      <DenaliFlatEditForm
        tenantId={session.tenantId}
        draft={draft}
        onDraftChange={onDraftChange}
        navLocked={draftSync.navLocked}
        templateSteps={gate.templateSteps}
        allowedCanonicalPaths={gate.allowedCanonicalPaths}
        wizardRuleEvalContext={wizardRuleEvalContext}
        wizardSessionId={wizardSessionId}
        footer={
          <div className="space-y-3 pt-2">
            {submitValidationIssues != null && submitValidationIssues.length > 0 ? (
              <DenaliFlatEditValidationList issues={submitValidationIssues} />
            ) : null}
            {localizedError ? (
              <p role="alert" className="text-sm text-destructive">
                {localizedError}
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
    </div>
  );
}
