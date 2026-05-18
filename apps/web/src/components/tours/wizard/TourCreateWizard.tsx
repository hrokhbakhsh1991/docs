"use client";

import {
  defaultTourFormProfileForTourType,
  normalizeTourFormProfileInput,
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
import { Button, Card, CardBody } from "@tour/ui";

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
  type TourWizardDraftEnvelope,
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
import { wizardStepEngine } from "@/features/tours/wizard/wizardStepEngine";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import {
  coalesceWizardMainTourThemeId,
  coalesceWizardResolvedProfile,
  preserveWizardMetaResolvedProfile,
  resolveTourFormProfile,
} from "@/features/tours/wizard/tourWizardProfileResolve";
import { settingsTourThemesKeys } from "@/lib/query-keys";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";
import { useSettingsTourPresets } from "@/hooks/use-settings-tour-presets";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import type { ProfileRules } from "@/features/tours/wizard/profileRules/types";
import type { TenantTourFormContract } from "@/features/tours/contracts/tour-form-contract";

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
  const [profileOverride, setProfileOverride] = useState<TourFormProfile | null>(null);
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
    const metaProfile = parsed?.wizardMeta?.resolvedFormProfile;
    if (metaProfile && metaProfile !== "general") {
      profileSchemaRef.current = metaProfile;
      setProfileOverride(metaProfile);
      if (parsed?.wizardMeta) {
        draftWizardMetaRef.current = parsed.wizardMeta;
        setDraftWizardMeta(parsed.wizardMeta);
      }
      return;
    }
    const tourTypeRaw = parsed?.formPatch?.overview?.tourType;
    if (typeof tourTypeRaw === "string" && tourTypeRaw.trim() !== "") {
      const fromTourType = defaultTourFormProfileForTourType(tourTypeRaw as TourType);
      if (fromTourType !== "general") {
        profileSchemaRef.current = fromTourType;
        setProfileOverride(fromTourType);
      }
    }
  }, [profileSchemaRef]);

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

  const snapshotForResolve = useMemo((): TourWizardDraftMeta | undefined => {
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

  const wizardTemplateBaseProfile = wizardTemplateQuery.data?.baseProfile;

  const effectiveTourTypeForProfile: TourType | undefined = useMemo(
    () =>
      tourTypeForResolve ??
      persistedTourTypeRef.current ??
      tourTypeFromStorage ??
      readBrowserE2eTourTypeSeed(),
    [tourTypeForResolve, tourTypeFromStorage, persistedTourTypeRef],
  );

  useEffect(() => {
    if (!tourTypeForResolve) {
      return;
    }
    if (persistedTourTypeRef.current === tourTypeForResolve) {
      return;
    }
    persistedTourTypeRef.current = tourTypeForResolve;
  }, [tourTypeForResolve, persistedTourTypeRef]);

  const mainTourThemeIdForResolve = useMemo(() => {
    const storageMain = storageDraft?.formPatch?.overview?.mainTourThemeId;
    const watchedMain = mainTourThemeId;
    return coalesceWizardMainTourThemeId({
      watchedMain,
      storageMain,
    });
  }, [
    mainTourThemeId,
    storageDraft?.formPatch?.overview?.mainTourThemeId,
  ]);

  const ignoreSnapshot = useMemo(() => {
    const snapMain = snapshotForResolve?.themeIds?.main?.trim();
    const main = mainTourThemeIdForResolve?.trim() ?? "";
    return Boolean(snapMain && main && snapMain !== main);
  }, [snapshotForResolve?.themeIds?.main, mainTourThemeIdForResolve]);

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
  const themeCatalogResolved = themeCatalogForProfile ?? themeCatalogRef.current;

  const derivedProfile = useMemo(() => {
    const raw = resolveTourFormProfile({
      snapshot: snapshotForResolve,
      mainTourThemeId: mainTourThemeIdForResolve,
      themeCatalog: themeCatalogResolved,
      tourType: effectiveTourTypeForProfile,
      ignoreSnapshot,
    });
    const preserved = preserveWizardMetaResolvedProfile(
      raw,
      snapshotForResolve?.resolvedFormProfile,
    );
    if (preserved !== "general") {
      return preserved;
    }
    if (effectiveTourTypeForProfile) {
      const fromTourType = defaultTourFormProfileForTourType(effectiveTourTypeForProfile);
      if (fromTourType !== "general") {
        return fromTourType;
      }
    }
    if (wizardTemplateBaseProfile && wizardTemplateBaseProfile !== "general") {
      return wizardTemplateBaseProfile;
    }
    return preserved;
  }, [
    snapshotForResolve,
    ignoreSnapshot,
    mainTourThemeIdForResolve,
    themeCatalogResolved,
    effectiveTourTypeForProfile,
    wizardTemplateBaseProfile,
  ]);

  const rawResolvedProfile = useMemo(() => {
    const snapshotProfile = snapshotForResolve?.resolvedFormProfile;
    if (snapshotProfile && snapshotProfile !== "general") {
      const mainFromSnapshot = coalesceWizardMainTourThemeId({
        watchedMain: mainTourThemeId,
        storageMain: storageDraft?.formPatch?.overview?.mainTourThemeId,
      });
      return coalesceWizardResolvedProfile({
        raw: snapshotProfile,
        snapshotProfile,
        mainTourThemeId: mainFromSnapshot ?? mainTourThemeIdForResolve,
        themeCatalog: themeCatalogResolved,
        tourType: tourTypeWatch ?? effectiveTourTypeForProfile,
        persistedTourType: persistedTourTypeRef.current ?? effectiveTourTypeForProfile,
        templateBaseProfile: wizardTemplateBaseProfile,
      });
    }
    if (draftWizardMeta?.resolvedFormProfile && draftWizardMeta.resolvedFormProfile !== "general") {
      return draftWizardMeta.resolvedFormProfile;
    }
    
    const mainFromForm = coalesceWizardMainTourThemeId({
      watchedMain: mainTourThemeId,
      storageMain: storageDraft?.formPatch?.overview?.mainTourThemeId,
    });
    
    if (mainFromForm && themeCatalogResolved?.length) {
      const themeRow = themeCatalogResolved.find((row) => row.id === mainFromForm);
      if (themeRow?.formProfile != null) {
        const fromTheme = normalizeTourFormProfileInput(themeRow.formProfile);
        if (fromTheme !== "general") {
          return fromTheme;
        }
      }
    }
    
    const tourTypeFromForm =
      typeof tourTypeWatch === "string" && tourTypeWatch.trim() !== ""
        ? (tourTypeWatch as TourType)
        : undefined;
        
    const metaProfile = snapshotForResolve?.resolvedFormProfile;
    if (profileOverride && profileOverride !== "general") {
      return profileOverride;
    }
    const profileOverrideForResolve =
      profileOverride && profileOverride !== "general" ? profileOverride : null;
    const coalesced = coalesceWizardResolvedProfile({
      raw: profileOverrideForResolve ?? derivedProfile,
      snapshotProfile: metaProfile,
      mainTourThemeId: mainFromForm ?? mainTourThemeIdForResolve,
      themeCatalog: themeCatalogResolved,
      tourType: tourTypeFromForm ?? effectiveTourTypeForProfile,
      persistedTourType: persistedTourTypeRef.current ?? effectiveTourTypeForProfile,
      templateBaseProfile: wizardTemplateBaseProfile,
    });
    if (coalesced !== "general") {
      return coalesced;
    }
    if (effectiveTourTypeForProfile) {
      const fromTourType = defaultTourFormProfileForTourType(effectiveTourTypeForProfile);
      if (fromTourType !== "general") {
        return fromTourType;
      }
    }
    if (wizardTemplateBaseProfile && wizardTemplateBaseProfile !== "general") {
      return wizardTemplateBaseProfile;
    }
    return coalesced;
  }, [
    snapshotForResolve,
    mainTourThemeId,
    storageDraft?.formPatch?.overview?.mainTourThemeId,
    mainTourThemeIdForResolve,
    themeCatalogResolved,
    effectiveTourTypeForProfile,
    draftWizardMeta?.resolvedFormProfile,
    tourTypeWatch,
    profileOverride,
    derivedProfile,
    wizardTemplateBaseProfile,
    persistedTourTypeRef,
  ]);

  const lastNonGeneralResolvedProfileRef = useRef<TourFormProfile | undefined>(undefined);
  const resolvedProfile = useMemo(() => {
    if (rawResolvedProfile && rawResolvedProfile !== "general") {
      lastNonGeneralResolvedProfileRef.current = rawResolvedProfile;
      return rawResolvedProfile;
    }
    if (!themesQuery.data?.length && lastNonGeneralResolvedProfileRef.current) {
      return lastNonGeneralResolvedProfileRef.current;
    }
    return rawResolvedProfile || lastNonGeneralResolvedProfileRef.current || "general";
  }, [rawResolvedProfile, themesQuery.data?.length]);

  const lastNonGeneralSchemaProfileForZodRef = useRef<TourFormProfile | undefined>(undefined);
  const schemaProfileForZod = useMemo(() => {
    const raw =
      draftWizardMeta?.resolvedFormProfile && draftWizardMeta.resolvedFormProfile !== "general"
        ? draftWizardMeta.resolvedFormProfile
        : resolvedProfile;
    if (raw && raw !== "general") {
      lastNonGeneralSchemaProfileForZodRef.current = raw;
      return raw;
    }
    return lastNonGeneralSchemaProfileForZodRef.current ?? "general";
  }, [draftWizardMeta?.resolvedFormProfile, resolvedProfile]);
  profileSchemaRef.current = schemaProfileForZod;

  const notifyProfileDriversChanged = useCallback((hint?: WizardProfileDriverHint) => {
    if (hint?.mainTourThemeId) {
      setValue("overview.mainTourThemeId", hint.mainTourThemeId, { shouldDirty: true, shouldValidate: false });
    }
  }, [setValue]);

  useEffect(() => {
    if (!draftRestoreAttemptedRef.current) {
      return;
    }
    const targetProfile =
      resolvedProfile !== "general"
        ? resolvedProfile
        : undefined;
          
    const nextMainThemeId = mainTourThemeId;

    if (!targetProfile && !nextMainThemeId) {
       return;
    }

    setDraftWizardMeta((prev) => {
      const currentThemeIds = prev?.themeIds ?? {};
      const nextThemeId = nextMainThemeId || currentThemeIds.main;

      if (
        prev?.resolvedFormProfile === targetProfile &&
        prev?.themeIds?.main === nextThemeId
      ) {
        return prev;
      }

      const nextMeta: TourWizardDraftMeta = {
        ...(prev ?? {
          resolvedFormProfile: targetProfile ?? "general",
          formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        }),
        resolvedFormProfile: targetProfile ?? "general",
        formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        themeIds: {
          ...currentThemeIds,
          ...(nextThemeId ? { main: nextThemeId } : {}),
        },
      };
      draftWizardMetaRef.current = nextMeta;
      return nextMeta;
    });
    
    if (targetProfile) {
      profileSchemaRef.current = targetProfile;
      setProfileOverride(targetProfile);
    }
  }, [resolvedProfile, profileSchemaRef, mainTourThemeId]);

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

  const lastStepKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prevKey = lastStepKeyRef.current;
    if (prevKey) {
      const nextIndex = visibleSteps.indexOf(prevKey as any);
      if (nextIndex !== -1) {
        if (nextIndex !== currentStep) {
          setCurrentStep(nextIndex);
        }
      } else {
        setCurrentStep((prev) => Math.min(prev, Math.max(0, visibleSteps.length - 1)));
      }
    }
    lastStepKeyRef.current = visibleSteps[currentStep];
  }, [visibleSteps, currentStep]);

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

  const applyParsedDraft = useCallback(
    (
      parsed: ParsedWizardDraft,
      savedAt?: string,
      opts?: { unlockAutosave?: boolean },
    ) => {
      const { mergedValues, resolvedFormProfile } = applyWizardDraftRestore(parsed, defaultValues);
      const restoredValues = stripTenantGatedTourCreateGroups(tenantFormContract, mergedValues);

      const mainFromPatch =
        typeof parsed.formPatch?.overview?.mainTourThemeId === "string"
          ? parsed.formPatch.overview.mainTourThemeId.trim()
          : "";
      const tourTypeFromPatch =
        typeof parsed.formPatch?.overview?.tourType === "string" &&
        parsed.formPatch.overview.tourType.trim() !== ""
          ? (parsed.formPatch.overview.tourType as TourType)
          : undefined;
      const explicitMetaProfile =
        parsed.wizardMeta?.resolvedFormProfile &&
        parsed.wizardMeta.resolvedFormProfile !== "general"
          ? parsed.wizardMeta.resolvedFormProfile
          : undefined;
      const resolvedFormProfileForMeta =
        explicitMetaProfile ??
        coalesceWizardResolvedProfile({
          raw: resolvedFormProfile,
          snapshotProfile: parsed.wizardMeta?.resolvedFormProfile,
          mainTourThemeId: mainFromPatch || parsed.wizardMeta?.themeIds?.main,
          themeCatalog: readThemeCatalogForProfile(),
          tourType: tourTypeFromPatch,
          persistedTourType: tourTypeFromPatch,
          templateBaseProfile: wizardTemplateQuery.data?.baseProfile,
        });
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
      setProfileOverride(
        resolvedFormProfileForMeta === "general" ? null : resolvedFormProfileForMeta,
      );
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
      wizardTemplateQuery.data?.baseProfile,
    ],
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [draftScope, defaultValues, tenant, tenantFormContract, applyParsedDraft]);

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
  }, [applyParsedDraft, draftScope, draftStorageKey, isHydrated, tenant, user?.userId]);

  useLayoutEffect(() => {
    if (!e2eWizardSeedEnabled() || e2eTourTypeSeededRef.current || typeof window === "undefined") {
      return;
    }
    const seeded = readBrowserE2eTourTypeSeed();
    if (!seeded) {
      return;
    }
    e2eTourTypeSeededRef.current = true;
    const seededProfile = defaultTourFormProfileForTourType(seeded);
    profileSchemaRef.current = seededProfile;
    setProfileOverride(seededProfile);
    setValue("overview.tourType", seeded, { shouldDirty: true, shouldValidate: false });
    const w = window as unknown as { __E2E_SEED_TOUR_TYPE?: string };
    delete w.__E2E_SEED_TOUR_TYPE;
  }, [setValue, profileSchemaRef]);

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
    setProfileOverride(null);
    reset(defaultValues);
    setShowDraftBanner(false);
  }, [defaultValues, draftScope, draftStorageKey, reset]);

  const onSubmit = useCallback(
    async (values: TourCreateFormValues) => {
      const submitProfile = coalesceWizardResolvedProfile({
        raw: resolvedProfile,
        snapshotProfile:
          draftWizardMetaRef.current?.resolvedFormProfile ??
          (draftScope ? readWizardDraftRecordForScope(draftScope)?.wizardMeta?.resolvedFormProfile : undefined),
        mainTourThemeId: coalesceWizardMainTourThemeId({
          watchedMain: values.overview?.mainTourThemeId,
          storageMain: storageDraft?.formPatch?.overview?.mainTourThemeId,
        }),
        themeCatalog: readThemeCatalogForProfile(),
        tourType:
          typeof values.overview?.tourType === "string" && values.overview.tourType.trim() !== ""
            ? (values.overview.tourType as TourType)
            : persistedTourTypeRef.current,
        persistedTourType: persistedTourTypeRef.current,
        templateBaseProfile: wizardTemplateQuery.data?.baseProfile,
      });
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
          formProfile: submitProfile,
          tenantFormContract,
        });
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
      draftScope,
      readThemeCatalogForProfile,
      resolvedProfile,
      router,
      setError,
      storageDraft?.formPatch?.overview?.mainTourThemeId,
      tenantFormContract,
      wizardTemplateQuery.data?.baseProfile,
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
    }),
    [draftMetaForUi, resolvedProfile, tenantFormContract, wizardRules],
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
          {showDraftBanner ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.65rem", flexWrap: "wrap" }}>
              <p role="status" style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
                پیش‌نویس ذخیره‌شده از مرورگر بازیابی شد.
              </p>
              <Button type="button" variant="ghost" onClick={clearDraft}>
                پاک کردن پیش‌نویس
              </Button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit, (errors) => console.log('[RHF ERRORS]', JSON.stringify(errors, null, 2)))} noValidate style={{ display: "grid", gap: "1rem" }}>
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
              <Button type="button" variant="ghost" onClick={handleBack} disabled={isFirstStep || createMutation.isPending}>
                قبلی
              </Button>

              {!isLastStep ? (
                <Button key="btn-next" type="button" variant="primary" onClick={() => void handleNext()} disabled={createMutation.isPending}>
                  بعدی
                </Button>
              ) : (
                <Button key="btn-submit" type="submit" variant="primary" disabled={createMutation.isPending}>
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

export function TourCreateWizard() {
  const defaultValues = useMemo(() => buildTourCreateFormDefaultValues(), []);
  const profileSchemaRef = useRef<TourFormProfile>("general");
  /** Last non-empty tour type (basic step unmounts `<select>`; shared with Zod resolver). */
  const persistedTourTypeRef = useRef<TourType | undefined>(undefined);
  const lastNonGeneralResolverProfileRef = useRef<TourFormProfile | undefined>(undefined);
  const formMethods = useForm<TourCreateFormValues>({
    /** Re-read profile on each validate from shell ref + persisted / URL tour type. */
    resolver: ((values, context, options) => {
      const tourTypeRaw =
        (typeof values.overview?.tourType === "string" && values.overview.tourType.trim() !== ""
          ? values.overview.tourType
          : undefined) ??
        persistedTourTypeRef.current ??
        readBrowserE2eTourTypeSeed();
      let profile = profileSchemaRef.current;
      if (tourTypeRaw) {
        const fromTourType = defaultTourFormProfileForTourType(tourTypeRaw as TourType);
        if (fromTourType !== "general") {
          profile = fromTourType;
        }
      }
      if (profile && profile !== "general") {
        lastNonGeneralResolverProfileRef.current = profile;
      } else if (lastNonGeneralResolverProfileRef.current) {
        profile = lastNonGeneralResolverProfileRef.current;
      }
      return (zodResolver(buildTourCreateSchemaForFormProfile(profile)) as Resolver<TourCreateFormValues>)(
        values,
        context,
        options,
      );
    }) as Resolver<TourCreateFormValues>,
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