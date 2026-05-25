/**
 * @deprecated Classic 9-step create wizard. Import only from {@link ClassicTourCreateWizardRoot}
 * via the modern orchestrator {@link ../TourCreateWizard}.
 */
"use client";

import {
  TOUR_FORM_PROFILE_VERSION,
  type TourFormProfile,
  type TourType,
} from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  FormProvider,
  useForm,
  useFormContext,
  useFormState,
  useWatch,
  type FieldPath,
  type Resolver,
  type UseFormSetError,
} from "react-hook-form";
import { Button, Card, CardBody, LoadingState } from "@tour/ui";

import { BasicInfoStep } from "./steps/BasicInfoStep";
import { CapacityPricingStep } from "./steps/CapacityPricingStep";
import { ItineraryStep } from "./steps/ItineraryStep";
import { LocationDatesStep } from "./steps/LocationDatesStep";
import { LogisticsStep } from "./steps/LogisticsStep";
import { ParticipationStep } from "./steps/ParticipationStep";
import { PoliciesStep } from "./steps/PoliciesStep";
import { ReviewSubmitStep } from "./steps/ReviewSubmitStep";
import { ThemeDetailsStep } from "./steps/ThemeDetailsStep";
import {
  buildTourCreateSchemaForFormProfile,
  type TourCreateFormValues,
} from "./schemas/tourCreateSchema";
import {
  resetTourCreateWizardValidationFlags,
  setTourCreateWizardValidationFlags,
} from "./schemas/tourCreateValidationPolicy";
import { applyWizardDraftRestore } from "@/features/tours/wizard/apply-wizard-draft-restore";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { useTourWizardCreate } from "@/features/tours/wizard/hooks/useTourWizardCreate";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import { clearWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import {
  validateForAutosave,
  validateForStepNavigation,
  validateForSubmit,
  type ValidationResult,
} from "@/features/tours/wizard/profileRules";
import { type TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";
import {
  mergeWizardValidationFlagsWithTenant,
  resolveTenantTourFormContract,
  stripTenantGatedTourCreateGroups,
} from "@/features/tours/contracts/tenant-tour-form-contract";
import { emitTourWizardAnalytics } from "@/features/tours/wizard/tourWizardAnalytics";
import { emitWizardRulesValidationFailure } from "@/features/tours/observability/tourProfileObservability";
import { TourWizardProfileProvider, useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";
import {
  TourWizardProfileDriversProvider,
  type WizardProfileDriverHint,
} from "@/features/tours/wizard/TourWizardProfileDriversContext";
import { useAuth } from "@/lib/auth/auth-context";
import {
  readWizardDraftRecordForScope,
  serializeWizardDraft,
  type ParsedWizardDraft,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import { isTourWizardServerDraftEnabled } from "@/features/tours/wizard/is-tour-wizard-server-draft-enabled";
import { pickWizardDraftForRestore } from "@/features/tours/wizard/pick-wizard-draft-for-restore";
import { syncTourWizardServerDraft } from "@/features/tours/wizard/sync-tour-wizard-server-draft";
import { setServerDraftRowVersion } from "@/features/tours/wizard/tour-wizard-server-draft-state";
import { useTourWizardDraftStorageKey } from "@/features/tours/wizard/useTourWizardDraftStorageKey";
import {
  resolveWorkspaceDraftScope,
  useWorkspaceDraftScope,
  useWorkspaceQueryScope,
} from "@/hooks/use-workspace-query-scope";
import { resolveTenantSlugFromHost } from "@/lib/tenant/runtime-tenant-context";
import { useTenantContext } from "@/lib/tenant/tenant-provider";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { getProfileRulesForWizard } from "@/features/tours/wizard/template/merge-field-rules-overlay";
import { mergeWizardAutosavePatch } from "@/features/tours/wizard/wizardAutosavePatch";
import { wizardStepEngine, type WizardStepKey } from "@/features/tours/wizard/wizardStepEngine";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import { settingsTourThemesKeys } from "@/lib/query-keys";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";
import { useSettingsTourPresets } from "@/hooks/use-settings-tour-presets";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import type { ProfileRules } from "@/features/tours/wizard/profileRules/types";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";

/** Playwright e2e seed allow-list (inline so minified bundles never mis-bind imported `TOUR_TYPES` in this callback). */
const E2E_SEEDABLE_TOUR_TYPES = new Set<string>(["mountain", "city", "desert", "nature", "cultural"]);

function e2eWizardSeedEnabled(): boolean {
  return process.env.NEXT_PUBLIC_E2E_WIZARD_SEED === "true";
}

/** Loopback / init-script tour type seed — read during render so profile resolves before layout `setValue` flushes. */
function readBrowserE2eTourTypeSeed(): TourType | undefined {
  if (!e2eWizardSeedEnabled()) {
    return undefined;
  }
  try {
    const loc = typeof globalThis !== "undefined" && "location" in globalThis ? globalThis.location : undefined;
    if (!loc || typeof (loc as Location).search !== "string") {
      return undefined;
    }
    let raw: string | undefined;
    try {
      raw = new URLSearchParams((loc as Location).search).get("e2eTourType")?.trim() || undefined;
    } catch {
      raw = undefined;
    }
    const w = globalThis as unknown as { __E2E_SEED_TOUR_TYPE?: string };
    raw = raw || w.__E2E_SEED_TOUR_TYPE?.trim();
    if (!raw || !E2E_SEEDABLE_TOUR_TYPES.has(raw)) {
      return undefined;
    }
    return raw as TourType;
  } catch {
    return undefined;
  }
}

function WizardStepper({
  steps,
  currentIndex,
}: {
  steps: readonly TourCreateWizardStepId[];
  currentIndex: number;
}) {
  return (
    <ol
      aria-label="مراحل ایجاد تور"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        listStyle: "none",
        padding: 0,
        margin: 0,
      }}
    >
      {steps.map((step, index) => (
        <li key={step}>
          <span
            aria-current={index === currentIndex ? "step" : undefined}
            style={{
              display: "inline-block",
              padding: "0.2rem 0.65rem",
              borderRadius: 999,
              fontSize: "0.8rem",
              background:
                index === currentIndex ? "var(--color-primary-100, #dbeafe)" : "var(--color-surface-subtle, #eef2f7)",
              color: index === currentIndex ? "var(--color-primary-800, #1e3a8a)" : "#334155",
            }}
          >
            {index + 1}. {wizardStepEngine.getStepTitleFa(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function DirtyBeforeUnloadGate() {
  const { control } = useFormContext<TourCreateFormValues>();
  const { isDirty } = useFormState({ control });
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
  return null;
}

function WizardFormProfileBadge() {
  const t = useTranslations("tours.new");
  const { resolvedProfile } = useTourWizardProfile();
  const displayProfile = resolvedProfile;
  return (
    <p
      suppressHydrationWarning
      data-testid="wizard-form-profile"
      data-form-profile={displayProfile}
      style={{ margin: "0 0 0.35rem", fontSize: "0.8rem", color: "#64748b" }}
    >
      {t("wizardFormProfileBadge", { profile: displayProfile })}
    </p>
  );
}

function WizardAutosave({
  resolvedProfile,
  currentStepKey,
  draftStorageKey,
  tenantFormContract,
  draftScope,
  wizardRules,
  draftWizardMetaRef,
  setDraftWizardMeta,
  serverRestorePending,
  draftRestoreAttempted,
  draftAutosaveUnlocked,
}: {
  resolvedProfile: TourFormProfile;
  currentStepKey: TourCreateWizardStepId;
  draftStorageKey: string;
  tenantFormContract: TenantTourFormContract;
  draftScope: string | null;
  wizardRules: ProfileRules;
  draftWizardMetaRef: MutableRefObject<TourWizardDraftMeta | undefined>;
  setDraftWizardMeta: (meta: TourWizardDraftMeta | undefined) => void;
  serverRestorePending: boolean;
  draftRestoreAttempted: boolean;
  draftAutosaveUnlocked: boolean;
}) {
  const watched = useWatch();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!draftRestoreAttempted || serverRestorePending || !draftAutosaveUnlocked) {
      return;
    }
    let raf = 0;
    let timeoutId: number | undefined;
    raf = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        try {
          const existingDraft = draftScope != null ? readWizardDraftRecordForScope(draftScope) : null;
          const mergedPatch = mergeWizardAutosavePatch(
            existingDraft?.formPatch,
            (watched ?? {}) as TourCreateFormValues,
            currentStepKey,
            resolvedProfile,
            tenantFormContract,
          );
          const existingTitle = existingDraft?.formPatch?.overview?.title;
          const mergedTitle = mergedPatch.overview?.title;
          if (
            typeof existingTitle === "string" &&
            existingTitle.trim() !== "" &&
            (typeof mergedTitle !== "string" || mergedTitle.trim() === "")
          ) {
            return;
          }
          const autoResult = validateForAutosave(resolvedProfile, currentStepKey, mergedPatch, {
            tenantFormContract,
            rules: wizardRules,
          });
          if (!autoResult.isValid) {
            emitWizardRulesValidationFailure({
              level: "autosave",
              form_profile: resolvedProfile,
              step_id: currentStepKey,
              result: autoResult,
            });
          }
          const savedAt = new Date().toISOString();
          if (draftWizardMetaRef.current) {
            draftWizardMetaRef.current = { ...draftWizardMetaRef.current, savedAt };
            setDraftWizardMeta(draftWizardMetaRef.current);
          }
          const payload = serializeWizardDraft(mergedPatch, draftWizardMetaRef.current);
          localStorage.setItem(draftStorageKey, payload);
          if (isTourWizardServerDraftEnabled()) {
            syncTourWizardServerDraft(payload);
          }
        } catch {
          /* ignore */
        }
      }, 600);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    watched,
    resolvedProfile,
    currentStepKey,
    draftStorageKey,
    tenantFormContract,
    draftScope,
    wizardRules,
    draftRestoreAttempted,
    serverRestorePending,
    draftAutosaveUnlocked,
    draftWizardMetaRef,
    setDraftWizardMeta,
  ]);

  return null;
}

/**
 * Surface a profile-rules-layer {@link ValidationResult} into the React Hook Form error map.
 */
function applyRulesIssuesToFormErrors(
  result: ValidationResult,
  setError: UseFormSetError<TourCreateFormValues>,
): boolean {
  if (result.isValid) return true;
  for (const issue of result.issues) {
    setError(issue.path as FieldPath<TourCreateFormValues>, {
      type: "rules-layer-required",
      message: issue.message,
    });
  }
  return false;
}

function TourCreateWizardShell({
  defaultValues,
  profileSchemaRef,
  persistedTourTypeRef,
}: {
  defaultValues: TourCreateFormValues;
  profileSchemaRef: MutableRefObject<TourFormProfile>;
  persistedTourTypeRef: MutableRefObject<TourType | undefined>;
}) {
  const t = useTranslations("tours.new");
  const router = useRouter();
  const { user, isHydrated } = useAuth();
  const tenant = useTenantContext();
  const draftScope = useWorkspaceDraftScope();
  const draftStorageKey = useTourWizardDraftStorageKey();
  const tenantFormContract = useMemo(
    () => resolveTenantTourFormContract(user?.tenantModules),
    [user?.tenantModules],
  );
  const queryClient = useQueryClient();
  const workspaceQueryScope = useWorkspaceQueryScope();
  const themesQuery = useSettingsTourThemes();
  const presetsQuery = useSettingsTourPresets();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftWizardMeta, setDraftWizardMeta] = useState<TourWizardDraftMeta | undefined>(undefined);
  const draftWizardMetaRef = useRef<TourWizardDraftMeta | undefined>(undefined);
  const draftRestoreAttemptedRef = useRef(false);
  const serverRestorePendingRef = useRef(isTourWizardServerDraftEnabled());
  const draftAutosaveUnlockedRef = useRef(!isTourWizardServerDraftEnabled());
  const [storageDraftSnapshot, setStorageDraftSnapshot] = useState<ParsedWizardDraft | null>(null);

  const formMethods = useFormContext<TourCreateFormValues>();
  const { handleSubmit, trigger, reset, getValues, setValue, setError, clearErrors, control } = formMethods;

  const emptyOverviewNormalizedRef = useRef(false);
  const e2eTourTypeSeededRef = useRef(false);
  
  const mainTourThemeId = useWatch({ control, name: "overview.mainTourThemeId" });
  const tourTypeWatch = useWatch({ control, name: "overview.tourType" });
  
  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hostSlug = resolveTenantSlugFromHost(window.location.host);
    if (!hostSlug) {
      return;
    }
    const parsed = readWizardDraftRecordForScope(hostSlug);
    if (parsed?.wizardMeta) {
      draftWizardMetaRef.current = parsed.wizardMeta;
      setDraftWizardMeta(parsed.wizardMeta);
    }
  }, []);

  useLayoutEffect(() => {
    if (emptyOverviewNormalizedRef.current) {
      return;
    }
    emptyOverviewNormalizedRef.current = true;
    if (mainTourThemeId === "") {
      setValue("overview.mainTourThemeId", undefined, { shouldDirty: false, shouldValidate: false });
    }
    if (tourTypeWatch === "") {
      setValue("overview.tourType", undefined, { shouldDirty: false, shouldValidate: false });
    }
  }, [mainTourThemeId, tourTypeWatch, setValue]);

  const storageDraft = storageDraftSnapshot;

  const hostDraftRecordForProfile = useMemo((): ParsedWizardDraft | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const hostSlug = resolveTenantSlugFromHost(window.location.host);
    if (hostSlug) {
      const fromHost = readWizardDraftRecordForScope(hostSlug);
      if (fromHost) {
        return fromHost;
      }
    }
    const scope =
      draftScope?.trim() ||
      resolveWorkspaceDraftScope(tenant, workspaceQueryScope, window.location.host) ||
      "";
    if (!scope) {
      return null;
    }
    return readWizardDraftRecordForScope(scope);
  }, [draftScope, tenant, workspaceQueryScope]);

  const liveStorageWizardMeta = hostDraftRecordForProfile?.wizardMeta;

  const draftMetaForUi = useMemo((): TourWizardDraftMeta | undefined => {
    const candidates = [
      draftWizardMeta,
      liveStorageWizardMeta,
      hostDraftRecordForProfile?.wizardMeta,
      storageDraft?.wizardMeta,
    ];
    for (const meta of candidates) {
      if (meta?.resolvedFormProfile && meta.resolvedFormProfile !== "general") {
        return meta;
      }
    }
    return (
      draftWizardMeta ??
      liveStorageWizardMeta ??
      hostDraftRecordForProfile?.wizardMeta ??
      storageDraft?.wizardMeta
    );
  }, [
    draftWizardMeta,
    liveStorageWizardMeta,
    hostDraftRecordForProfile?.wizardMeta,
    storageDraft?.wizardMeta,
  ]);

  const tourTypeFromStorage = useMemo((): TourType | undefined => {
    const raw =
      storageDraft?.formPatch?.overview?.tourType ??
      hostDraftRecordForProfile?.formPatch?.overview?.tourType;
    if (typeof raw === "string" && raw.trim() !== "") {
      return raw.trim() as TourType;
    }
    return undefined;
  }, [
    storageDraft?.formPatch?.overview?.tourType,
    hostDraftRecordForProfile?.formPatch?.overview?.tourType,
  ]);

  const tourTypeFromWatched =
    typeof tourTypeWatch === "string" && tourTypeWatch.trim() !== ""
      ? (tourTypeWatch as TourType)
      : undefined;

  const tourTypeForResolve: TourType | undefined = useMemo(() => {
    const candidates = [
      tourTypeWatch,
      tourTypeFromWatched,
      tourTypeFromStorage,
      persistedTourTypeRef.current,
      readBrowserE2eTourTypeSeed(),
    ];
    for (const raw of candidates) {
      if (typeof raw === "string" && raw.trim() !== "") {
        return raw.trim() as TourType;
      }
    }
    return undefined;
  }, [tourTypeWatch, tourTypeFromWatched, tourTypeFromStorage, persistedTourTypeRef]);

  const workspaceTemplate = wizardTemplateQuery.data;

  const workspaceFormProfile = useMemo((): TourFormProfile | undefined => {
    if (!workspaceTemplate) {
      return undefined;
    }
    return resolveWorkspaceTourFormProfileFromTemplate(workspaceTemplate);
  }, [workspaceTemplate]);

  const resolvedProfile = workspaceFormProfile ?? profileSchemaRef.current;

  useEffect(() => {
    if (workspaceFormProfile != null) {
      profileSchemaRef.current = workspaceFormProfile;
    }
  }, [workspaceFormProfile, profileSchemaRef]);

  useEffect(() => {
    if (!tourTypeForResolve) {
      return;
    }
    if (persistedTourTypeRef.current === tourTypeForResolve) {
      return;
    }
    persistedTourTypeRef.current = tourTypeForResolve;
  }, [tourTypeForResolve, persistedTourTypeRef]);

  const readThemeCatalogForProfile = useCallback((): SettingsTourThemeDto[] | undefined => {
    if (themesQuery.data?.length) {
      return themesQuery.data;
    }
    const scopeCandidates = [
      workspaceQueryScope?.trim(),
      tenant.tenantSlug?.trim(),
      typeof window !== "undefined" ? resolveTenantSlugFromHost(window.location.host) : "",
    ].filter((scope): scope is string => Boolean(scope));
    for (const scope of scopeCandidates) {
      const cached = queryClient.getQueryData<SettingsTourThemeDto[]>(
        settingsTourThemesKeys.list(scope),
      );
      if (cached?.length) {
        return cached;
      }
    }
    return themesQuery.data;
  }, [queryClient, tenant.tenantSlug, themesQuery.data, workspaceQueryScope]);

  const themeCatalogForProfile = readThemeCatalogForProfile();
  const themeCatalogRef = useRef<SettingsTourThemeDto[] | undefined>(undefined);
  if (themeCatalogForProfile?.length) {
    themeCatalogRef.current = themeCatalogForProfile;
  }
  const notifyProfileDriversChanged = useCallback((hint?: WizardProfileDriverHint) => {
    if (hint?.mainTourThemeId) {
      setValue("overview.mainTourThemeId", hint.mainTourThemeId, { shouldDirty: true, shouldValidate: false });
    }
  }, [setValue]);

  useEffect(() => {
    if (!draftRestoreAttemptedRef.current || workspaceFormProfile == null) {
      return;
    }
    const nextMainThemeId = mainTourThemeId;

    setDraftWizardMeta((prev) => {
      const currentThemeIds = prev?.themeIds ?? {};
      const nextThemeId = nextMainThemeId || currentThemeIds.main;

      if (
        prev?.resolvedFormProfile === workspaceFormProfile &&
        prev?.themeIds?.main === nextThemeId
      ) {
        return prev;
      }

      const nextMeta: TourWizardDraftMeta = {
        ...(prev ?? {
          resolvedFormProfile: workspaceFormProfile,
          formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        }),
        resolvedFormProfile: workspaceFormProfile,
        formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        themeIds: {
          ...currentThemeIds,
          ...(nextThemeId ? { main: nextThemeId } : {}),
        },
      };
      draftWizardMetaRef.current = nextMeta;
      return nextMeta;
    });
  }, [workspaceFormProfile, mainTourThemeId]);

  const activeThemeCount = useMemo(
    () => (themesQuery.data ?? []).filter((row) => row.isActive).length,
    [themesQuery.data],
  );

  const visibleSteps = useMemo(
    () =>
      wizardStepEngine.getVisibleStepsForRuntime(resolvedProfile, {
        themesQueryFinishedLoading: !themesQuery.isLoading,
        activeThemeCount,
        tenantFormContract,
        stepOverrides: wizardTemplateQuery.data?.stepOverrides,
      }),
    [
      resolvedProfile,
      activeThemeCount,
      themesQuery.isLoading,
      tenantFormContract,
      wizardTemplateQuery.data?.stepOverrides,
    ],
  );

  const wizardRules = useMemo(
    () => getProfileRulesForWizard(resolvedProfile, wizardTemplateQuery.data?.fieldRulesOverlay),
    [resolvedProfile, wizardTemplateQuery.data?.fieldRulesOverlay],
  );

  const lastStepKeyRef = useRef<WizardStepKey | undefined>(undefined);

  // Keep the tracked step key aligned with the current index (Next/Back and direct index).
  useEffect(() => {
    const key = visibleSteps[currentStep];
    if (key) {
      lastStepKeyRef.current = key;
    }
  }, [currentStep, visibleSteps]);

  // When the visible step list changes (profile/theme/template), preserve step by key.
  useEffect(() => {
    const prevKey = lastStepKeyRef.current;
    if (!prevKey || visibleSteps.length === 0) {
      return;
    }
    const nextIndex = visibleSteps.indexOf(prevKey);
    if (nextIndex === -1) {
      setCurrentStep((prev) => Math.min(prev, visibleSteps.length - 1));
      return;
    }
    setCurrentStep((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [visibleSteps]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === visibleSteps.length - 1;
  const currentStepKey = visibleSteps[currentStep]!;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const w = window as unknown as {
      __syncTourWizardProfileDrivers?: (hint?: WizardProfileDriverHint) => void;
    };
    w.__syncTourWizardProfileDrivers = (hint?: WizardProfileDriverHint) => {
      const main = hint?.mainTourThemeId?.trim();
      notifyProfileDriversChanged({
        mainTourThemeId: main,
        themeCatalog:
          hint?.themeCatalog?.length
            ? hint.themeCatalog
            : themeCatalogRef.current ?? themesQuery.data,
      });
    };
    return () => {
      delete w.__syncTourWizardProfileDrivers;
    };
  }, [notifyProfileDriversChanged, themesQuery.data]);

  const createMutation = useTourWizardCreate();
  const submitLocked = isWizardSubmitLocked(createMutation);

  const applyParsedDraft = useCallback(
    (
      parsed: ParsedWizardDraft,
      savedAt?: string,
      opts?: { unlockAutosave?: boolean },
    ) => {
      if (!workspaceTemplate || workspaceFormProfile == null) {
        return;
      }
      const { mergedValues } = applyWizardDraftRestore(parsed, defaultValues, workspaceTemplate);
      const restoredValues = stripTenantGatedTourCreateGroups(tenantFormContract, mergedValues);

      const mainFromPatch =
        typeof parsed.formPatch?.overview?.mainTourThemeId === "string"
          ? parsed.formPatch.overview.mainTourThemeId.trim()
          : "";
      const resolvedFormProfileForMeta = workspaceFormProfile;
      profileSchemaRef.current = resolvedFormProfileForMeta;
      const meta: TourWizardDraftMeta = {
        ...(parsed.wizardMeta ?? {
          resolvedFormProfile: resolvedFormProfileForMeta,
          formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        }),
        resolvedFormProfile: resolvedFormProfileForMeta,
        formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        savedAt: savedAt ?? parsed.wizardMeta?.savedAt ?? new Date().toISOString(),
        themeIds: {
          main: mainFromPatch || parsed.wizardMeta?.themeIds?.main,
          secondary: parsed.wizardMeta?.themeIds?.secondary,
        },
      };
      draftWizardMetaRef.current = meta;
      setDraftWizardMeta(meta);
      setStorageDraftSnapshot({ formPatch: parsed.formPatch, wizardMeta: meta });

      reset(restoredValues);
      const restoredTourType = restoredValues.overview?.tourType;
      if (typeof restoredTourType === "string" && restoredTourType.trim() !== "") {
        setValue("overview.tourType", restoredTourType as TourType, { shouldDirty: true, shouldValidate: false });
      }
      setShowDraftBanner(true);
      const unlockAutosave = opts?.unlockAutosave !== false;
      if (unlockAutosave) {
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              draftAutosaveUnlockedRef.current = true;
            });
          });
        } else {
          draftAutosaveUnlockedRef.current = true;
        }
      }
    },
    [
      defaultValues,
      profileSchemaRef,
      readThemeCatalogForProfile,
      reset,
      setValue,
      tenantFormContract,
      workspaceFormProfile,
      workspaceTemplate,
    ],
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!workspaceTemplate || workspaceFormProfile == null) {
      return;
    }
    const scope =
      draftScope ??
      resolveWorkspaceDraftScope(tenant, null, window.location.host) ??
      resolveTenantSlugFromHost(window.location.host);
    if (!scope) return;
    const parsed = readWizardDraftRecordForScope(scope);
    setStorageDraftSnapshot(parsed);
    try {
      if (parsed) {
        applyParsedDraft(parsed, undefined, {
          unlockAutosave: !isTourWizardServerDraftEnabled(),
        });
      }
    } catch {
      /* ignore */
    } finally {
      if (!isTourWizardServerDraftEnabled()) {
        draftRestoreAttemptedRef.current = true;
        if (!parsed) {
          draftAutosaveUnlockedRef.current = true;
        }
      }
    }
  }, [
    draftScope,
    defaultValues,
    tenant,
    tenantFormContract,
    applyParsedDraft,
    workspaceTemplate,
    workspaceFormProfile,
  ]);

  useEffect(() => {
    if (!isTourWizardServerDraftEnabled()) {
      serverRestorePendingRef.current = false;
      if (!draftRestoreAttemptedRef.current) {
        draftRestoreAttemptedRef.current = true;
      }
      return;
    }
    if (!isHydrated) {
      return;
    }
    if (!user?.userId) {
      serverRestorePendingRef.current = false;
      draftRestoreAttemptedRef.current = true;
      draftAutosaveUnlockedRef.current = true;
      return;
    }
    if (typeof window === "undefined") return;
    const scope =
      draftScope ??
      resolveWorkspaceDraftScope(tenant, null, window.location.host) ??
      resolveTenantSlugFromHost(window.location.host);
    if (!scope) {
      serverRestorePendingRef.current = false;
      draftRestoreAttemptedRef.current = true;
      return;
    }
    if (!workspaceTemplate || workspaceFormProfile == null) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { fetchWorkspaceTourWizardDraft } = await import(
          "@/lib/settings-tour-wizard-draft.client"
        );
        const local = readWizardDraftRecordForScope(scope);
        const { draft: serverDraft } = await fetchWorkspaceTourWizardDraft();
        const pick = pickWizardDraftForRestore(local, serverDraft);
        if (pick?.rowVersion != null) {
          setServerDraftRowVersion(pick.rowVersion);
        }
        if (pick) {
          const savedAt =
            pick.source === "server" && serverDraft
              ? serverDraft.updatedAt
              : pick.parsed.wizardMeta?.savedAt;
          if (pick.source === "server" || !local) {
            applyParsedDraft(pick.parsed, savedAt, { unlockAutosave: true });
            const meta = draftWizardMetaRef.current;
            const payload = serializeWizardDraft(pick.parsed.formPatch, meta);
            localStorage.setItem(draftStorageKey, payload);
          } else {
            draftAutosaveUnlockedRef.current = true;
          }
        } else {
          draftAutosaveUnlockedRef.current = true;
        }
      } catch {
        /* ignore — local draft remains */
      } finally {
        if (!cancelled) {
          serverRestorePendingRef.current = false;
          draftRestoreAttemptedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyParsedDraft,
    draftScope,
    draftStorageKey,
    isHydrated,
    tenant,
    user?.userId,
    workspaceTemplate,
    workspaceFormProfile,
  ]);

  useLayoutEffect(() => {
    if (!e2eWizardSeedEnabled() || e2eTourTypeSeededRef.current || typeof window === "undefined") {
      return;
    }
    const seeded = readBrowserE2eTourTypeSeed();
    if (!seeded) {
      return;
    }
    e2eTourTypeSeededRef.current = true;
    setValue("overview.tourType", seeded, { shouldDirty: true, shouldValidate: false });
    const w = window as unknown as { __E2E_SEED_TOUR_TYPE?: string };
    delete w.__E2E_SEED_TOUR_TYPE;
  }, [setValue]);

  useLayoutEffect(() => {
    setTourCreateWizardValidationFlags(
      mergeWizardValidationFlagsWithTenant(
        wizardStepEngine.getValidationFlagsForStep(resolvedProfile, currentStepKey, visibleSteps),
        tenantFormContract,
      ),
    );
  }, [resolvedProfile, currentStepKey, visibleSteps, tenantFormContract]);

  useEffect(() => {
    return () => {
      resetTourCreateWizardValidationFlags();
    };
  }, []);

  useEffect(() => {
    emitTourWizardAnalytics({ type: "wizard_step_view", step: currentStepKey, formProfile: resolvedProfile });
  }, [currentStepKey, resolvedProfile]);

  const handleNext = useCallback(async () => {
    setTourCreateWizardValidationFlags(
      mergeWizardValidationFlagsWithTenant(
        wizardStepEngine.getValidationFlagsForStep(resolvedProfile, currentStepKey, visibleSteps),
        tenantFormContract,
      ),
    );
    const fields = wizardStepEngine.getTriggerFieldsForStep(currentStepKey);
    const okZod = fields.length === 0 ? true : await trigger(fields as Parameters<typeof trigger>[0]);

    const ruleResult = validateForStepNavigation(resolvedProfile, currentStepKey, getValues(), visibleSteps, {
      tenantFormContract,
      rules: wizardRules,
    });
    const okRules = applyRulesIssuesToFormErrors(ruleResult, setError);

    if (!ruleResult.isValid) {
      emitWizardRulesValidationFailure({
        level: "step_nav",
        form_profile: resolvedProfile,
        step_id: currentStepKey,
        visible_step_ids: visibleSteps,
        zod_trigger_ok: okZod,
        result: ruleResult,
      });
    }

    if (okZod && okRules) {
      emitTourWizardAnalytics({ type: "wizard_step_next", step: currentStepKey, formProfile: resolvedProfile });
      setCurrentStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
    }
  }, [
    currentStepKey,
    getValues,
    resolvedProfile,
    setError,
    tenantFormContract,
    trigger,
    visibleSteps,
    wizardRules,
  ]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      /* ignore */
    }
    if (isTourWizardServerDraftEnabled()) {
      void import("@/lib/settings-tour-wizard-draft.client")
        .then(({ deleteWorkspaceTourWizardDraft }) => deleteWorkspaceTourWizardDraft())
        .catch(() => {
          /* ignore */
        });
    }
    setStorageDraftSnapshot(draftScope ? readWizardDraftRecordForScope(draftScope) : null);
    setDraftWizardMeta(undefined);
    draftWizardMetaRef.current = undefined;
    reset(defaultValues);
    setShowDraftBanner(false);
  }, [defaultValues, draftScope, draftStorageKey, reset]);

  const onSubmit = useCallback(
    async (values: TourCreateFormValues) => {
      if (workspaceFormProfile == null) {
        return;
      }
      const submitProfile = workspaceFormProfile;
      profileSchemaRef.current = submitProfile;
      clearErrors();
      const submitResult = validateForSubmit(submitProfile, values, {
        tenantFormContract,
        rules: getProfileRulesForWizard(submitProfile, wizardTemplateQuery.data?.fieldRulesOverlay),
      });
      const okRules = applyRulesIssuesToFormErrors(submitResult, setError);
      if (!submitResult.isValid) {
        emitWizardRulesValidationFailure({
          level: "submit",
          form_profile: submitProfile,
          result: submitResult,
        });
      }
      if (!okRules) {
        return;
      }
      try {
        await createMutation.mutateAsync({
          values,
          themeCatalog: readThemeCatalogForProfile(),
          workspaceFormProfile: submitProfile,
          tenantFormContract,
          sourcePresetId: draftWizardMetaRef.current?.sourcePresetId,
          sourceTourId: draftWizardMetaRef.current?.sourceTourId,
        });
        clearWizardSubmitIdempotencyKey();
        try {
          localStorage.removeItem(draftStorageKey);
        } catch {
          /* ignore */
        }
        if (isTourWizardServerDraftEnabled()) {
          void import("@/lib/settings-tour-wizard-draft.client")
            .then(({ deleteWorkspaceTourWizardDraft }) => deleteWorkspaceTourWizardDraft())
            .catch(() => {
              /* ignore */
            });
          setServerDraftRowVersion(undefined);
        }
        router.push("/tours");
        router.refresh();
      } catch {
        /* surfaced via mutation.error */
      }
    },
    [
      clearErrors,
      createMutation,
      readThemeCatalogForProfile,
      router,
      setError,
      tenantFormContract,
      workspaceFormProfile,
      wizardTemplateQuery.data?.fieldRulesOverlay,
    ],
  );

  const submitError = createMutation.error;
  const submitErrorMessage = useMemo(
    () =>
      submitError
        ? formatWizardApiErrorMessage(submitError, "ثبت تور ناموفق بود.")
        : null,
    [submitError],
  );

  const profileContextValue = useMemo(
    () => ({
      resolvedProfile,
      draftMeta: draftMetaForUi,
      tenantFormContract,
      rules: wizardRules,
      submitLocked,
      isSubmitPending: createMutation.isPending,
    }),
    [draftMetaForUi, resolvedProfile, tenantFormContract, wizardRules, submitLocked, createMutation.isPending],
  );

  return (
    <TourWizardProfileDriversProvider notifyProfileDriversChanged={notifyProfileDriversChanged}>
    <TourWizardProfileProvider value={profileContextValue}>
      <DirtyBeforeUnloadGate />
      <WizardAutosave
        resolvedProfile={resolvedProfile}
        currentStepKey={currentStepKey}
        draftStorageKey={draftStorageKey}
        tenantFormContract={tenantFormContract}
        draftScope={draftScope}
        wizardRules={wizardRules}
        draftWizardMetaRef={draftWizardMetaRef}
        setDraftWizardMeta={setDraftWizardMeta}
        serverRestorePending={serverRestorePendingRef.current}
        draftRestoreAttempted={draftRestoreAttemptedRef.current}
        draftAutosaveUnlocked={draftAutosaveUnlockedRef.current}
      />
      <Card
        data-testid="tour-create-wizard"
        data-resolved-form-profile={resolvedProfile}
        data-tenant-form-contract={tenantFormContract.tenantModules.join(",") || "none"}
        data-tenant-advanced-trip-details={tenantFormContract.allowAdvancedTripDetails ? "1" : "0"}
        title={t("pageTitle")}
        description={t("cardDescription")}
      >
        <CardBody>
          {showDraftBanner && isFirstStep ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.65rem", flexWrap: "wrap", marginBottom: '1rem' }}>
              <p role="status" style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
                پیش‌نویس ذخیره‌شده از مرورگر بازیابی شد.
              </p>
              <Button type="button" variant="ghost" onClick={clearDraft}>
                پاک کردن پیش‌نویس
              </Button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "grid", gap: "1rem" }}>
            <WizardFormProfileBadge />
            <WizardStepper steps={visibleSteps} currentIndex={currentStep} />

            <div style={{ padding: "0.25rem 0" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                گام {currentStep + 1} از {visibleSteps.length}: {wizardStepEngine.getStepTitleFa(currentStepKey)}
              </h2>
            </div>

            {submitErrorMessage ? (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  padding: "0.65rem 0.75rem",
                  borderRadius: 8,
                  background: "var(--color-danger-50, #fef2f2)",
                  color: "var(--color-danger-800, #991b1b)",
                  fontSize: "0.9rem",
                }}
              >
                {submitErrorMessage}
              </div>
            ) : null}

            <div>
              {currentStepKey === "basic" && <BasicInfoStep tourCreationPresets={presetsQuery.data} resolvedFormProfile={resolvedProfile} />}
              {currentStepKey === "theme" && <ThemeDetailsStep />}
              {currentStepKey === "capacity" && <CapacityPricingStep />}
              {currentStepKey === "location" && <LocationDatesStep />}
              {currentStepKey === "itinerary" && <ItineraryStep />}
              {currentStepKey === "participation" && <ParticipationStep />}
              {currentStepKey === "logistics" && <LogisticsStep />}
              {currentStepKey === "policies" && <PoliciesStep />}
              {currentStepKey === "review" && <ReviewSubmitStep />}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <Button type="button" variant="ghost" onClick={handleBack} disabled={isFirstStep || submitLocked}>
                قبلی
              </Button>

              {!isLastStep ? (
                <Button key="btn-next" type="button" variant="primary" onClick={() => void handleNext()} disabled={submitLocked}>
                  بعدی
                </Button>
              ) : (
                <Button key="btn-submit" type="submit" variant="primary" disabled={submitLocked}>
                  {createMutation.isPending ? "در حال ثبت…" : "ثبت نهایی تور"}
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </TourWizardProfileProvider>
    </TourWizardProfileDriversProvider>
  );
}

export function ClassicTourCreateWizardRoot() {
  const defaultValues = useMemo(() => buildTourCreateFormDefaultValues(), []);
  const profileSchemaRef = useRef<TourFormProfile>("general");
  /** Last non-empty tour type (basic step unmounts `<select>`; shared with Zod resolver). */
  const persistedTourTypeRef = useRef<TourType | undefined>(undefined);
  const formMethods = useForm<TourCreateFormValues>({
    /** Zod schema follows workspace template profile via {@link profileSchemaRef}. */
    resolver: ((values, context, options) =>
      (zodResolver(buildTourCreateSchemaForFormProfile(profileSchemaRef.current)) as Resolver<TourCreateFormValues>)(
        values,
        context,
        options,
      )) as Resolver<TourCreateFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });

  return (
    <FormProvider {...formMethods}>
      <TourCreateWizardShell
        defaultValues={defaultValues}
        profileSchemaRef={profileSchemaRef}
        persistedTourTypeRef={persistedTourTypeRef}
      />
    </FormProvider>
  );
}