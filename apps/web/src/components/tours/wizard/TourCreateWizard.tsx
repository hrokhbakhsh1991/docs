"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from "react-hook-form";
import { Button, Card, CardBody } from "@tour/ui";

import { BasicInfoStep } from "./steps/BasicInfoStep";
import { CapacityPricingStep } from "./steps/CapacityPricingStep";
import { ItineraryStep } from "./steps/ItineraryStep";
import { LocationDatesStep } from "./steps/LocationDatesStep";
import { LogisticsStep } from "./steps/LogisticsStep";
import { ParticipationStep } from "./steps/ParticipationStep";
import { PoliciesStep } from "./steps/PoliciesStep";
import { ReviewSubmitStep } from "./steps/ReviewSubmitStep";
import {
  tourCreateSchema,
  type TourCreateFormValues,
} from "./schemas/tourCreateSchema";
import { mergeTourDraft, wizardDefaultDaySegment } from "@/features/tours/wizard/tourCreateWizardMerge";
import { useTourWizardCreate } from "@/features/tours/wizard/hooks/useTourWizardCreate";
import {
  stepTitlesFa,
  stepTriggerFields,
  wizardSteps,
  type TourCreateWizardStepId,
} from "@/features/tours/wizard/stepConfig";
import { useSettingsTourPresets } from "@/hooks/use-settings-tour-presets";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { ApiError } from "@/lib/api-client";

const DRAFT_STORAGE_KEY = "tour-create-wizard-draft-v1";

function buildDefaultValues(): TourCreateFormValues {
  return {
    autoAcceptRegistrations: true,
    overview: {
      title: "",
      shortDescription: "",
      longDescription: "",
      secondaryTourThemeIds: [],
      tripStyles: [],
      highlights: [],
      communicationLink: "",
    },
    pricing: {
      basePrice: 0,
      currency: "TOMAN",
      discountNotes: "",
    },
    schedule: {
      startDate: "",
      endDate: "",
      departureMeetingTime: "",
      returnMeetingTime: "",
    },
    location: {
      regionId: "",
      mainDestinationId: "",
      secondaryDestinationIds: [],
      meetingPoint: "",
      returnPoint: "",
      displayLocation: "",
    },
    itinerary: {
      days: [
        {
          dayNumber: 1,
          title: "",
          description: "",
          segments: [{ ...wizardDefaultDaySegment }],
        },
      ],
    },
    participation: {
      requiredExperienceLevel: "",
      requiredFitnessLevel: "",
      minimumAge: undefined,
      maximumAge: undefined,
      genderRestriction: "",
      technicalSkillRequired: "",
      medicalRestrictions: "",
      requirements: "",
      skillsRequired: [],
      gearRequiredIds: [],
      gearOptionalIds: [],
      documentsRequired: [],
      suitableFor: [],
      notSuitableFor: [],
      minParticipants: undefined,
      sportsInsuranceRequired: false,
      registrationNationalIdRequired: false,
    },
    logistics: {
      primaryTransportMode: undefined,
      fuelShareToman: undefined,
      includedServices: "",
      excludedServices: "",
      meetingPointDetails: "",
      transportationDetails: "",
      transportationNotes: "",
      accommodationDetails: "",
      accommodationTypes: [],
      accommodationNotes: "",
      mealPlan: "",
      mealNotes: "",
      supportServices: [],
      optionalServices: [],
      leaderProvidesInsurance: false,
      leaderInsuranceNotes: "",
      guideLanguageIds: [],
      groupSizeMin: undefined,
      groupSizeMax: undefined,
    },
    policies: {
      cancellationPolicy: "",
      refundPolicy: "",
      safetyNotes: "",
      riskDisclaimer: "",
      attendanceRules: "",
      lateArrivalPolicy: "",
      noShowPolicy: "",
      confirmationPolicy: "",
      capacityPolicy: "",
      safetyPolicy: "",
      weatherPolicy: "",
      reservationRules: "",
    },
  };
}

function WizardStepper({ currentIndex }: { currentIndex: number }) {
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
      {wizardSteps.map((step, index) => (
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
            {index + 1}. {stepTitlesFa[step]}
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

export function TourCreateWizard() {
  const t = useTranslations("tours.new");
  const router = useRouter();
  const themesQuery = useSettingsTourThemes();
  const presetsQuery = useSettingsTourPresets();
  const [currentStep, setCurrentStep] = useState(0);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultValues = useMemo(() => buildDefaultValues(), []);

  const formMethods = useForm<TourCreateFormValues>({
    resolver: zodResolver(tourCreateSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });

  const { handleSubmit, trigger, reset } = formMethods;

  const createMutation = useTourWizardCreate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TourCreateFormValues>;
        reset(mergeTourDraft(defaultValues, parsed));
        setShowDraftBanner(true);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore
  }, []);

  const watched = useWatch({ control: formMethods.control });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(watched ?? {}));
      } catch {
        /* ignore */
      }
    }, 600);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [watched]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === wizardSteps.length - 1;
  const currentStepKey = wizardSteps[currentStep];

  const stepContent = useMemo(() => {
    const byStep: Record<TourCreateWizardStepId, JSX.Element> = {
      basic: <BasicInfoStep tourCreationPresets={presetsQuery.data} />,
      capacity: <CapacityPricingStep />,
      location: <LocationDatesStep />,
      itinerary: <ItineraryStep />,
      participation: <ParticipationStep />,
      logistics: <LogisticsStep />,
      policies: <PoliciesStep />,
      review: <ReviewSubmitStep />,
    };
    return byStep[currentStepKey];
  }, [currentStepKey, presetsQuery.data]);

  const handleNext = useCallback(async () => {
    const fields = stepTriggerFields[currentStepKey];
    const ok = fields.length === 0 ? true : await trigger(fields as Parameters<typeof trigger>[0]);
    if (ok) {
      setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
    }
  }, [currentStepKey, trigger]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    reset(defaultValues);
    setShowDraftBanner(false);
  }, [defaultValues, reset]);

  const onSubmit = useCallback(
    async (values: TourCreateFormValues) => {
      try {
        await createMutation.mutateAsync({
          values,
          themeCatalog: themesQuery.data,
        });
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        router.push("/tours");
        router.refresh();
      } catch {
        /* surfaced via mutation.error */
      }
    },
    [createMutation, router, themesQuery.data],
  );

  const submitError = createMutation.error;
  const submitErrorMessage = useMemo(() => {
    if (!submitError) return null;
    if (submitError instanceof ApiError) return submitError.message;
    if (submitError instanceof Error) return submitError.message;
    return "ثبت تور ناموفق بود.";
  }, [submitError]);

  return (
    <FormProvider {...formMethods}>
      <DirtyBeforeUnloadGate />
      <Card title={t("pageTitle")} description={t("cardDescription")}>
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
            <WizardStepper currentIndex={currentStep} />

            <div style={{ padding: "0.25rem 0" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                گام {currentStep + 1} از {wizardSteps.length}: {stepTitlesFa[currentStepKey]}
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
    </FormProvider>
  );
}
