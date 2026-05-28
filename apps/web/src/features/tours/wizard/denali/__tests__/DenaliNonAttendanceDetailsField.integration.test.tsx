/**
 * Non-attendance details on pricing step (tripDetails.overview.nonAttendanceDetails).
 */
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@tour/ui", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
    <input type="checkbox" {...props} />
  ),
  FormField: ({
    children,
    label,
  }: {
    children: React.ReactNode;
    label: string;
  }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Select: () => null,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

jest.mock("@/components/forms/PersianNumberInput", () => ({
  PersianNumberInput: () => null,
}));

jest.mock("../steps/DenaliPricingParticipantSection", () => ({
  DenaliPricingParticipantSection: () => null,
}));

jest.mock("../hooks/useDenaliCanonicalValue", () => ({
  useDenaliCanonicalValue: (slice: string) => {
    if (slice === "pricing") {
      return { requiresPayment: false, includesTourInsurance: false };
    }
    return {};
  },
}));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliPricing.schema";

import { DenaliCanonicalProvider } from "../DenaliCanonicalContext";
import { DenaliPricingStep } from "../steps/DenaliPricingStep";

function PricingHarness({ defaultValues }: { defaultValues: DenaliCreateTourWizardForm }) {
  const formMethods = useForm<DenaliCreateTourWizardForm>({ defaultValues });

  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider formMethods={formMethods}>
        <DenaliPricingStep />
        <span data-testid="value-json">
          {JSON.stringify(formMethods.watch("tripDetails.overview.nonAttendanceDetails") ?? "")}
        </span>
      </DenaliCanonicalProvider>
    </FormProvider>
  );
}

test("DenaliPricingStep renders non-attendance details when tour type is selected", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_reading";

  render(<PricingHarness defaultValues={form} />);
  expect(screen.getByTestId("denali-non-attendance-details")).toBeTruthy();
});

test("DenaliPricingStep hides non-attendance details before tour type is selected", () => {
  render(<PricingHarness defaultValues={buildDenaliTourCreateDefaultValues()} />);
  expect(screen.queryByTestId("denali-non-attendance-details")).toBeNull();
});

test("DenaliPricingStep persists non-attendance details in form state", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_reading";

  render(<PricingHarness defaultValues={form} />);
  fireEvent.change(screen.getByTestId("denali-non-attendance-details"), {
    target: { value: "No-show policy" },
  });
  expect(screen.getByTestId("value-json").textContent).toBe(JSON.stringify("No-show policy"));
});