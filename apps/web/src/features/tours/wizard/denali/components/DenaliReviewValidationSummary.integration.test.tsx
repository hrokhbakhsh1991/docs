/**
 * Review validation summary groups submit issues by relocated wizard steps.
 */
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values && "count" in values) {
      return `${key}:${values.count}`;
    }
    if (values && "step" in values && "count" in values) {
      return `${key}:${values.step}:${values.count}`;
    }
    if (values && "label" in values && "message" in values) {
      return `${key}:${values.label}:${values.message}`;
    }
    return key;
  },
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";

import { DenaliCanonicalProvider } from "../DenaliCanonicalContext";
import { DenaliReviewValidationSummary } from "./DenaliReviewValidationSummary";
import { DenaliWizardNavigationProvider } from "../DenaliWizardNavigationContext";

function ReviewSummaryHarness({
  defaultValues,
  currentStepIndex = getDenaliWizardSteps().length - 1,
}: {
  defaultValues: DenaliCreateTourWizardForm;
  currentStepIndex?: number;
}) {
  const formMethods = useForm<DenaliCreateTourWizardForm>({ defaultValues });
  const [currentStep, setCurrentStep] = React.useState(currentStepIndex);
  const visibleSteps = getDenaliWizardSteps();

  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider formMethods={formMethods}>
        <DenaliWizardNavigationProvider
          visibleSteps={visibleSteps}
          currentStepIndex={currentStep}
          setCurrentStep={setCurrentStep}
        >
          <DenaliReviewValidationSummary />
        </DenaliWizardNavigationProvider>
      </DenaliCanonicalProvider>
    </FormProvider>
  );
}

describe("DenaliReviewValidationSummary", () => {
  test("groups shortDescription issues under denali_photos on review", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.tourType = "mountain_day";
    form.basicInfo.title = "";
    form.programNature.shortDescription = "";

    render(<ReviewSummaryHarness defaultValues={form} />);

    expect(screen.getByTestId("denali-summary-error")).toBeInTheDocument();
    expect(screen.getByTestId("denali-validation-step-denali_photos")).toBeInTheDocument();
    expect(screen.queryByTestId("denali-validation-step-denali_program")).toBeNull();
    expect(
      screen.getByTestId("denali-validation-field-link-programNature-shortDescription"),
    ).toBeInTheDocument();
  });

  test("groups title issues under denali_basic", () => {
    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.tourType = "mountain_day";
    form.basicInfo.title = "";
    form.programNature.shortDescription = "Valid short description";

    render(<ReviewSummaryHarness defaultValues={form} />);

    expect(screen.getByTestId("denali-validation-step-denali_basic")).toBeInTheDocument();
    expect(screen.queryByTestId("denali-validation-step-denali_photos")).toBeNull();
  });
});
