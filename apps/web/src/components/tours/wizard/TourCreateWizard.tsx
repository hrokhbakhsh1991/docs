"use client";

import {
  defaultTourFormProfileForTourType,
  normalizeTourFormProfileInput,
  type TourFormProfile,
  type TourType,
} from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { applyTourWizardPatch } from "@/features/tours/wizard/applyTourWizardPatch";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { useTourWizardCreate } from "@/features/tours/wizard/hooks/useTourWizardCreate";
import {
  validateForAutosave,
  validateForStepNavigation,
  validateForSubmit,
  type ValidationResult,
} from "@/features/tours/wizard/profileRules";
import { type TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";
import { resolveTenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { emitTourWizardAnalytics } from "@/features/tours/wizard/tourWizardAnalytics";
import { emitWizardRulesValidationFailure } from "@/features/tours/observability/tourProfileObservability";
import { TourWizardProfileProvider, useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";
import { useAuth } from "@/lib/auth/auth-context";
import {
  parseWizardDraftRecord,
  serializeWizardDraft,
  WIZARD_DRAFT_STORAGE_KEY,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import { sanitizeInactiveRootsForProfile } from "@/features/tours/wizard/fieldGroups";
import { wizardStepEngine } from "@/features/tours/wizard/wizardStepEngine";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import { resolveTourFormProfile } from "@/features/tours/wizard/tourWizardProfileResolve";
import { useSettingsTourPresets } from "@/hooks/use-settings-tour-presets";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { ApiError } from "@/lib/api-client";

/** Playwright e2e seed allow-list (inline so minified bundles never mis-bind imported `TOUR_TYPES` in this callback). */
const E2E_SEEDABLE_TOUR_TYPES = new Set<string>(["mountain", "city", "desert", "nature", "cultural"]);

/** Loopback / init-script tour type seed — read during render so profile resolves before layout `setValue` flushes. */
function readBrowserE2eTourTypeSeed(): TourType | undefined {
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

/** Same as `parseWizardDraftRecord` but safe on SSR; used so profile resolves on first client paint before layout restore. */
function readWizardDraftFromBrowserStorage(): ReturnType<typeof parseWizardDraftRecord> {
  try {
    const ls =
      typeof globalThis !== "undefined" && "localStorage" in globalThis
        ? (globalThis as unknown as { localStorage: Storage }).localStorage
        : null;
    if (!ls) {
      return null;
    }
    return parseWizardDraftRecord(ls.getItem(WIZARD_DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

type ParsedWizardDraft = NonNullable<ReturnType<typeof parseWizardDraftRecord>>;

/**
 * Applies a persisted draft envelope on top of wizard defaults. Uses the envelope's
 * saved {@link TourFormProfile} when present, otherwise `tourType` → default profile.
 * `themeCatalog` is omitted on first layout (themes hydrate later); resolution matches
 * {@link resolveTourFormProfile} snapshot → tourType → default precedence.
 */
function mergeRestoredDraftWithDefaults(
  parsed: ParsedWizardDraft,
  defaultValues: TourCreateFormValues,
): ReturnType<typeof applyTourWizardPatch> {
  const snapshotProfile = parsed.wizardMeta
    ? normalizeTourFormProfileInput(parsed.wizardMeta.resolvedFormProfile)
    : undefined;
  const tourTypeRaw = parsed.formPatch?.overview?.tourType;
  const tourTypeForFallback =
    typeof tourTypeRaw === "string" && tourTypeRaw.trim() !== ""
      ? (tourTypeRaw as TourType)
      : undefined;
  const currentProfileForPipeline =
    snapshotProfile ?? defaultTourFormProfileForTourType(tourTypeForFallback);

  return applyTourWizardPatch({
    baseValues: defaultValues,
    patch: parsed.formPatch,
    currentProfile: currentProfileForPipeline,
    themeCatalog: undefined,
    tourType: tourTypeRaw,
    snapshot: parsed.wizardMeta,
  });
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
  return (
    <p
      suppressHydrationWarning
      data-testid="wizard-form-profile"
      data-form-profile={resolvedProfile}
      style={{ margin: "0 0 0.35rem", fontSize: "0.8rem", color: "#64748b" }}
    >
      {t("wizardFormProfileBadge", { profile: resolvedProfile })}
    </p>
  );
}

/**
 * Surface a profile-rules-layer {@link ValidationResult} into the React Hook Form error map.
 *
 * Today the rules layer mirrors the Zod schema's required-ness exactly, so the issues
 * reported here for a step's required fields will typically already have a Zod-sourced
 * error on the same path. We `setError` anyway so the rules layer is the authoritative
 * gate: if a future profile/rules change adds a stricter rule than the Zod schema, the user
 * sees the error inline instead of a silently-blocked Next button.
 *
 * Returns `true` when no issues were surfaced (caller should advance), `false` otherwise.
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

/**
 * Wizard shell. All step-related decisions (visibility, ordering, trigger paths, per-step Zod
 * relaxation flags, titles) are funnelled through `wizardStepEngine`. The shell itself only
 * orchestrates RHF state, profile resolution, draft restore + auto-save, and analytics.
 *
 * **Preparing for autosave per field group (future task):**
 * The engine already exposes `getStepConfig(stepKey).primaryGroup`, which maps each step to a
 * {@link FieldGroupId}. Coupled with `GROUP_TO_TOUR_CREATE_ROOT_KEYS` from `fieldGroups.ts`, an
 * autosave hook can implement "save just this group" in three lines:
 *   1. `const group = wizardStepEngine.getPrimaryGroupForStep(stepKey);`
 *   2. `const roots = group ? GROUP_TO_TOUR_CREATE_ROOT_KEYS[group] : [];`
 *   3. Serialize `pick(formValues, roots)` and PATCH it to the workspace draft endpoint.
 * No changes to the wizard shell itself are required — the engine is the only seam.
 */
function TourCreateWizardShell({
  defaultValues,
  profileSchemaRef,
}: {
  defaultValues: TourCreateFormValues;
  profileSchemaRef: MutableRefObject<TourFormProfile>;
}) {
  const t = useTranslations("tours.new");
  const router = useRouter();
  const { user } = useAuth();
  const tenantFormContract = useMemo(
    () => resolveTenantTourFormContract(user?.tenantModules),
    [user?.tenantModules],
  );
  const themesQuery = useSettingsTourThemes();
  const presetsQuery = useSettingsTourPresets();
  const [currentStep, setCurrentStep] = useState(0);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftWizardMeta, setDraftWizardMeta] = useState<TourWizardDraftMeta | undefined>(undefined);
  const draftWizardMetaRef = useRef<TourWizardDraftMeta | undefined>(undefined);
  const draftRestoreAttemptedRef = useRef(false);
  /** One-shot UI profile from draft/e2e layout until `derivedProfile` catches up (RHF + snapshot timing). */
  const [profileOverride, setProfileOverride] = useState<TourFormProfile | null>(null);

  /** Parsed wizard draft from `localStorage` (synced in draft-restore layout; avoids render-time reads). */
  const [storageDraftSnapshot, setStorageDraftSnapshot] = useState<ReturnType<typeof parseWizardDraftRecord>>(null);

  const formMethods = useFormContext<TourCreateFormValues>();
  const { handleSubmit, trigger, reset, getValues, setValue, setError, clearErrors } = formMethods;

  const emptyOverviewNormalizedRef = useRef(false);
  const e2eTourTypeSeededRef = useRef(false);
  useLayoutEffect(() => {
    if (emptyOverviewNormalizedRef.current) {
      return;
    }
    emptyOverviewNormalizedRef.current = true;
    if (getValues("overview.mainTourThemeId") === "") {
      setValue("overview.mainTourThemeId", undefined, { shouldDirty: false, shouldValidate: false });
    }
    if (getValues("overview.tourType") === "") {
      setValue("overview.tourType", undefined, { shouldDirty: false, shouldValidate: false });
    }
  }, [getValues, setValue]);

  const watched = useWatch({ control: formMethods.control });
  const mainTourThemeId = useWatch({ control: formMethods.control, name: "overview.mainTourThemeId" });
  const tourTypeWatch = useWatch({ control: formMethods.control, name: "overview.tourType" });

  const storageDraft = storageDraftSnapshot;
  const snapshotForResolve = draftWizardMeta ?? storageDraft?.wizardMeta;

  const ignoreSnapshot = useMemo(() => {
    const snapMain = snapshotForResolve?.themeIds?.main?.trim();
    const main = typeof mainTourThemeId === "string" ? mainTourThemeId.trim() : "";
    return Boolean(snapMain && main && snapMain !== main);
  }, [snapshotForResolve?.themeIds?.main, mainTourThemeId]);

  const tourTypeFromStorage =
    typeof storageDraft?.formPatch?.overview?.tourType === "string" &&
    storageDraft.formPatch.overview.tourType.trim() !== ""
      ? (storageDraft.formPatch.overview.tourType as TourType)
      : undefined;

  const tourTypeForResolve: TourType | undefined =
    typeof tourTypeWatch === "string" && tourTypeWatch.trim() !== ""
      ? (tourTypeWatch as TourType)
      : tourTypeFromStorage ?? readBrowserE2eTourTypeSeed();

  const derivedProfile = useMemo(
    () =>
      resolveTourFormProfile({
        snapshot: snapshotForResolve,
        mainTourThemeId: typeof mainTourThemeId === "string" ? mainTourThemeId : undefined,
        themeCatalog: themesQuery.data,
        tourType: tourTypeForResolve,
        ignoreSnapshot,
      }),
    [snapshotForResolve, ignoreSnapshot, mainTourThemeId, themesQuery.data, tourTypeForResolve],
  );

  useEffect(() => {
    if (profileOverride == null) {
      return;
    }
    if (derivedProfile === profileOverride) {
      setProfileOverride(null);
    }
  }, [derivedProfile, profileOverride]);

  const resolvedProfile = profileOverride ?? derivedProfile;

  profileSchemaRef.current = resolvedProfile;

  const activeThemeCount = useMemo(
    () => (themesQuery.data ?? []).filter((row) => row.isActive).length,
    [themesQuery.data],
  );

  // Single source of truth for the live step rail: profile-based visibility + workspace-theme prune,
  // both delegated to `wizardStepEngine`. Any future "dynamic step engine" rewrite swaps this one call.
  const visibleSteps = useMemo(
    () =>
      wizardStepEngine.getVisibleStepsForRuntime(resolvedProfile, {
        themesQueryFinishedLoading: !themesQuery.isLoading,
        activeThemeCount,
      }),
    [resolvedProfile, activeThemeCount, themesQuery.isLoading],
  );

  useEffect(() => {
    setCurrentStep((prev) => Math.min(prev, Math.max(0, visibleSteps.length - 1)));
  }, [visibleSteps.length]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === visibleSteps.length - 1;
  const currentStepKey = visibleSteps[currentStep]!;

  const createMutation = useTourWizardCreate();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(WIZARD_DRAFT_STORAGE_KEY);
    const parsed = parseWizardDraftRecord(raw);
    setStorageDraftSnapshot(parsed);
    try {
      if (parsed) {
        const { mergedValues, resolvedFormProfile } = mergeRestoredDraftWithDefaults(parsed, defaultValues);

        profileSchemaRef.current = resolvedFormProfile;
        if (parsed.wizardMeta) {
          draftWizardMetaRef.current = parsed.wizardMeta;
          setDraftWizardMeta(parsed.wizardMeta);
        }
        setProfileOverride(resolvedFormProfile);

        reset(mergedValues);
        const restoredTourType = mergedValues.overview?.tourType;
        if (typeof restoredTourType === "string" && restoredTourType.trim() !== "") {
          setValue("overview.tourType", restoredTourType as TourType, { shouldDirty: true, shouldValidate: false });
        }
        setShowDraftBanner(true);
      }
    } catch {
      /* ignore */
    } finally {
      draftRestoreAttemptedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore
  }, []);

  /**
   * Playwright smoke: seed `overview.tourType` in layout (after draft restore) so `useWatch` / profile resolve
   * update before paint. Uses `E2E_SEEDABLE_TOUR_TYPES` instead of imported `TOUR_TYPES` to avoid minifier
   * closure bugs against the wrong binding in production chunks.
   *
   * - `?e2eTourType=…` on loopback (`127.0.0.1` / localhost / `[::1]`)
   * - `window.__E2E_SEED_TOUR_TYPE` (`addInitScript`, any host)
   */
  useLayoutEffect(() => {
    if (e2eTourTypeSeededRef.current || typeof window === "undefined") {
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!draftRestoreAttemptedRef.current) {
      return;
    }
    let raf = 0;
    let timeoutId: number | undefined;
    raf = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        try {
          // Sanitize watched snapshot against the **live** resolved profile so the on-disk
          // draft envelope never persists data owned by groups that are inactive for the
          // current profile (e.g. itinerary days from a mountain session that the user
          // later flipped to an urban_event theme). Re-runs on `resolvedProfile` change
          // so a profile flip eagerly rewrites a clean envelope, even if RHF state is idle.
          const snapshot = sanitizeInactiveRootsForProfile(
            (watched ?? {}) as TourCreateFormValues,
            resolvedProfile,
          );
          // L2 autosave gate: minimal, rules-scoped check (never required). v1 is always valid;
          // keeps a single hook for future shape-only refinements without breaking drafts.
          const autoResult = validateForAutosave(
            resolvedProfile,
            currentStepKey,
            snapshot as Partial<TourCreateFormValues>,
          );
          if (!autoResult.isValid) {
            emitWizardRulesValidationFailure({
              level: "autosave",
              form_profile: resolvedProfile,
              step_id: currentStepKey,
              result: autoResult,
            });
          }
          const payload = serializeWizardDraft(
            snapshot as Partial<TourCreateFormValues>,
            draftWizardMetaRef.current,
          );
          localStorage.setItem(WIZARD_DRAFT_STORAGE_KEY, payload);
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
  }, [watched, resolvedProfile, currentStepKey]);

  useLayoutEffect(() => {
    // Position-aware relax flags published to the shared Zod policy module (see
    // `wizardStepEngine.getValidationFlagsForStep` JSDoc for the composition rule).
    setTourCreateWizardValidationFlags(
      wizardStepEngine.getValidationFlagsForStep(resolvedProfile, currentStepKey, visibleSteps),
    );
  }, [resolvedProfile, currentStepKey, visibleSteps]);

  useEffect(() => {
    return () => {
      resetTourCreateWizardValidationFlags();
    };
  }, []);

  const stepContent = useMemo(() => {
    const byStep: Record<TourCreateWizardStepId, JSX.Element> = {
      basic: <BasicInfoStep tourCreationPresets={presetsQuery.data} resolvedFormProfile={resolvedProfile} />,
      theme: <ThemeDetailsStep />,
      capacity: <CapacityPricingStep />,
      location: <LocationDatesStep />,
      itinerary: <ItineraryStep />,
      participation: <ParticipationStep />,
      logistics: <LogisticsStep />,
      policies: <PoliciesStep />,
      review: <ReviewSubmitStep />,
    };
    return byStep[currentStepKey];
  }, [currentStepKey, presetsQuery.data, resolvedProfile]);

  useEffect(() => {
    emitTourWizardAnalytics({ type: "wizard_step_view", step: currentStepKey, formProfile: resolvedProfile });
  }, [currentStepKey, resolvedProfile]);

  const handleNext = useCallback(async () => {
    setTourCreateWizardValidationFlags(
      wizardStepEngine.getValidationFlagsForStep(resolvedProfile, currentStepKey, visibleSteps),
    );
    const fields = wizardStepEngine.getTriggerFieldsForStep(currentStepKey);
    const okZod = fields.length === 0 ? true : await trigger(fields as Parameters<typeof trigger>[0]);

    // Rules-layer step-nav gate. This is the canonical "is this step's required-set
    // satisfied?" check for the wizard — it consults `ProfileRules` (and only that). Today
    // it returns the same verdict as the Zod schema for every shipped profile (parity is
    // covered by `profileRules/validation.spec.ts`), but it is wired in additively so any
    // future rules-only requirement immediately surfaces here without a schema change.
    const ruleResult = validateForStepNavigation(resolvedProfile, currentStepKey, getValues(), visibleSteps);
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
    trigger,
    visibleSteps,
  ]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStorageDraftSnapshot(readWizardDraftFromBrowserStorage());
    setDraftWizardMeta(undefined);
    draftWizardMetaRef.current = undefined;
    setProfileOverride(null);
    reset(defaultValues);
    setShowDraftBanner(false);
  }, [defaultValues, reset]);

  const onSubmit = useCallback(
    async (values: TourCreateFormValues) => {
      // Rules-layer submit gate. Runs *after* RHF's Zod resolver has already accepted the
      // form (handleSubmit only invokes us on success). If the rules layer reports issues
      // here, that is by definition a drift between the Zod schema and the rules table —
      // we surface the issues into the RHF error map so the user sees them and abort the
      // mutation. In parity-mode (today) this branch is never taken.
      clearErrors();
      const submitResult = validateForSubmit(resolvedProfile, values);
      const okRules = applyRulesIssuesToFormErrors(submitResult, setError);
      if (!submitResult.isValid) {
        emitWizardRulesValidationFailure({
          level: "submit",
          form_profile: resolvedProfile,
          result: submitResult,
        });
      }
      if (!okRules) {
        return;
      }
      try {
        await createMutation.mutateAsync({
          values,
          themeCatalog: themesQuery.data,
          formProfile: resolvedProfile,
        });
        try {
          localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        router.push("/tours");
        router.refresh();
      } catch {
        /* surfaced via mutation.error */
      }
    },
    [clearErrors, createMutation, resolvedProfile, router, setError, themesQuery.data],
  );

  const submitError = createMutation.error;
  const submitErrorMessage = useMemo(() => {
    if (!submitError) return null;
    if (submitError instanceof ApiError) return submitError.message;
    if (submitError instanceof Error) return submitError.message;
    return "ثبت تور ناموفق بود.";
  }, [submitError]);

  const profileContextValue = useMemo(
    () => ({
      resolvedProfile,
      draftMeta: draftWizardMeta,
      tenantFormContract,
    }),
    [draftWizardMeta, resolvedProfile, tenantFormContract],
  );

  return (
    <TourWizardProfileProvider value={profileContextValue}>
      <DirtyBeforeUnloadGate />
      <Card
        data-testid="tour-create-wizard"
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

            <div>{stepContent}</div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <Button type="button" variant="ghost" onClick={handleBack} disabled={isFirstStep || createMutation.isPending}>
                قبلی
              </Button>

              {!isLastStep ? (
                <Button type="button" variant="primary" onClick={() => void handleNext()} disabled={createMutation.isPending}>
                  بعدی
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "در حال ثبت…" : "ثبت نهایی تور"}
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </TourWizardProfileProvider>
  );
}

export function TourCreateWizard() {
  const defaultValues = useMemo(() => buildTourCreateFormDefaultValues(), []);
  const profileSchemaRef = useRef<TourFormProfile>("general");
  const formMethods = useForm<TourCreateFormValues>({
    /** Re-read `profileSchemaRef` on each validate so Shell-updated profile matches Zod (static resolver only saw `"general"`). */
    resolver: ((values, context, options) => {
      return (zodResolver(buildTourCreateSchemaForFormProfile(profileSchemaRef.current)) as Resolver<TourCreateFormValues>)(
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
      <TourCreateWizardShell defaultValues={defaultValues} profileSchemaRef={profileSchemaRef} />
    </FormProvider>
  );
}
