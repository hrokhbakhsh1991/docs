/**
 * Policies fields on legal step (policies.* canonical paths).
 */
jest.mock("@tour/ui", () => ({
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
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

jest.mock("@/components/forms/PersianNumberInput", () => ({
  PersianNumberInput: ({
    onChange,
    numericMode: _numericMode,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    onChange?: (value: number | "") => void;
    numericMode?: string;
  }) => (
    <input
      {...props}
      onChange={(e) => {
        const raw = e.target.value;
        onChange?.(raw === "" ? "" : Number(raw));
      }}
    />
  ),
}));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { DenaliFormHarness, DenaliFormWatchProbe } from "@test-utils/denali-integration-harness";

import { DenaliLegalStep } from "../../steps/DenaliLegalStep";

test("DenaliLegalStep renders policy fields when tour type is selected", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";

  render(
    <DenaliFormHarness defaultValues={form}>
      <DenaliLegalStep />
    </DenaliFormHarness>,
  );
  expect(screen.getByTestId("denali-legal-policies-notes")).toBeTruthy();
  expect(screen.getByTestId("denali-legal-cancellation-hours")).toBeTruthy();
  expect(screen.getByTestId("denali-legal-cancellation-penalty")).toBeTruthy();
});

test("DenaliLegalStep persists policy values in form state and submit payload", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";

  render(
    <DenaliFormHarness defaultValues={form}>
      <DenaliLegalStep />
      <DenaliFormWatchProbe name="policies" testId="policies-json" />
    </DenaliFormHarness>,
  );
  fireEvent.change(screen.getByTestId("denali-legal-policies-notes"), {
    target: { value: "Refund within 48h" },
  });
  fireEvent.change(screen.getByTestId("denali-legal-cancellation-hours"), {
    target: { value: "48" },
  });
  fireEvent.change(screen.getByTestId("denali-legal-cancellation-penalty"), {
    target: { value: "20" },
  });

  const policies = JSON.parse(screen.getByTestId("policies-json").textContent ?? "{}");
  expect(policies.policiesText).toBe("Refund within 48h");
  expect(policies.cancellationDeadlineHours).toBe(48);
  expect(policies.cancellationPenaltyPercentage).toBe(20);

  const payloadForm = {
    ...form,
    policies,
  };
  const canonical = denaliFormToCanonical(payloadForm);
  expect(canonical.policies.policiesText).toBe("Refund within 48h");
  expect(canonical.policies.cancellationDeadlineHours).toBe(48);
  expect(canonical.policies.cancellationPenaltyPercentage).toBe(20);
});
