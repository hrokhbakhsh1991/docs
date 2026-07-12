"use client";

import { useTranslations } from "next-intl";

/** Denali catalog registration steps (workspace flow order). */
export const CATALOG_REGISTRATION_STEPPER_IDS = [
  "phone",
  "otp",
  "profile",
  "intake",
] as const;

export type CatalogRegistrationStepperId =
  (typeof CATALOG_REGISTRATION_STEPPER_IDS)[number];

function resolveStepperIndex(currentStep: string): number {
  if (currentStep === "success") {
    return CATALOG_REGISTRATION_STEPPER_IDS.length;
  }
  const index = CATALOG_REGISTRATION_STEPPER_IDS.indexOf(
    currentStep as CatalogRegistrationStepperId
  );
  return index >= 0 ? index : 0;
}

export type CatalogRegistrationStepperProps = {
  readonly currentStep: string;
};

export function CatalogRegistrationStepper({ currentStep }: CatalogRegistrationStepperProps) {
  const t = useTranslations("catalogRegistration.stepper");
  const activeIndex = resolveStepperIndex(currentStep);

  return (
    <ol
      data-registration-stepper
      aria-label={t("ariaLabel")}
    >
      {CATALOG_REGISTRATION_STEPPER_IDS.map((stepId, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = index === activeIndex && currentStep !== "success";
        return (
          <li
            key={stepId}
            data-registration-step={stepId}
            data-registration-step-state={
              isComplete ? "complete" : isCurrent ? "current" : "upcoming"
            }
          >
            <span data-registration-step-index>{index + 1}</span>
            <span data-registration-step-label>{t(stepId)}</span>
          </li>
        );
      })}
    </ol>
  );
}
