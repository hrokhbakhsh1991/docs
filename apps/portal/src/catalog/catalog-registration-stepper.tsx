"use client";

import { useTranslations } from "next-intl";

/** Denali catalog registration steps (workspace flow order). */
export const CATALOG_REGISTRATION_STEPPER_IDS = [
  "phone",
  "otp",
  "profile",
  "intake",
] as const;

/** Member login egress — OTP shell only (no tour intake). */
export const MEMBER_LOGIN_STEPPER_IDS = ["phone", "otp", "profile"] as const;

/** Session resume at tour intake — hide auth steps (PCMS-REG-01). */
export const INTAKE_ONLY_STEPPER_IDS = ["intake"] as const;

export type CatalogRegistrationStepperId =
  (typeof CATALOG_REGISTRATION_STEPPER_IDS)[number];

export type CatalogRegistrationStepperMode = "registration" | "login" | "intake-only";

function resolveStepIds(mode: CatalogRegistrationStepperMode): readonly string[] {
  if (mode === "login") {
    return MEMBER_LOGIN_STEPPER_IDS;
  }
  if (mode === "intake-only") {
    return INTAKE_ONLY_STEPPER_IDS;
  }
  return CATALOG_REGISTRATION_STEPPER_IDS;
}

function resolveStepperAriaLabel(
  mode: CatalogRegistrationStepperMode,
  t: (key: string) => string
): string {
  if (mode === "login") {
    return t("loginAriaLabel");
  }
  if (mode === "intake-only") {
    return t("intakeOnlyAriaLabel");
  }
  return t("ariaLabel");
}

function resolveStepperIndex(currentStep: string, stepIds: readonly string[]): number {
  if (currentStep === "success") {
    return stepIds.length;
  }
  const index = stepIds.indexOf(currentStep);
  return index >= 0 ? index : 0;
}

export type CatalogRegistrationStepperProps = {
  readonly currentStep: string;
  readonly mode?: CatalogRegistrationStepperMode;
};

export function CatalogRegistrationStepper({
  currentStep,
  mode = "registration",
}: CatalogRegistrationStepperProps) {
  const t = useTranslations("catalogRegistration.stepper");
  const stepIds = resolveStepIds(mode);
  const activeIndex = resolveStepperIndex(currentStep, stepIds);

  return (
    <ol
      data-registration-stepper
      data-registration-stepper-mode={mode}
      aria-label={resolveStepperAriaLabel(mode, t)}
    >
      {stepIds.map((stepId, index) => {
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
