/**
 * Custom services labels live in RHF form state (tripDetails.overview.customServiceLabels).
 */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  DENALI_CUSTOM_SERVICE_LABELS_PATH,
  DenaliCustomServicesField,
} from "../components/DenaliCustomServicesField";

jest.mock("@/hooks/use-tenant-wizard-template", () => ({
  useTenantWizardTemplate: () => ({ data: { baseProfile: "denali_pilot" } }),
}));

jest.mock("../components/DenaliCustomServicesEditor", () => ({
  DenaliCustomServicesEditor: ({
    labels,
    onAppend,
    onRemove,
  }: {
    labels: readonly string[];
    onAppend: (label: string) => void;
    onRemove: (index: number) => void;
  }) => {
    const [draft, setDraft] = React.useState("");
    return (
      <div data-testid="denali-custom-services">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
        <input
          data-testid="denali-custom-service-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          data-testid="denali-custom-service-add"
          onClick={() => {
            onAppend(draft.trim());
            setDraft("");
          }}
        >
          add
        </button>
        {labels.map((label, index) => (
          <button
            key={`remove-${label}-${index}`}
            type="button"
            data-testid={`denali-custom-service-remove-${index}`}
            onClick={() => onRemove(index)}
          >
            remove
          </button>
        ))}
      </div>
    );
  },
}));

function StepNavigationHarness() {
  const [onLogisticsStep, setOnLogisticsStep] = useState(true);
  const formMethods = useForm<DenaliCreateTourWizardForm>({
    defaultValues: buildDenaliTourCreateDefaultValues(),
  });

  return (
    <FormProvider {...formMethods}>
      {onLogisticsStep ? <DenaliCustomServicesField workspaceFormProfile="denali_pilot" /> : null}
      <span data-testid="labels-json">
        {JSON.stringify(formMethods.watch(DENALI_CUSTOM_SERVICE_LABELS_PATH) ?? [])}
      </span>
      <button type="button" data-testid="toggle-step" onClick={() => setOnLogisticsStep((v) => !v)}>
        toggle
      </button>
    </FormProvider>
  );
}

describe("DenaliCustomServicesField", () => {
  test("persists labels in form state when logistics step unmounts", () => {
    render(<StepNavigationHarness />);

    const input = screen.getByTestId("denali-custom-service-input");
    fireEvent.change(input, { target: { value: "صبحانه" } });
    fireEvent.click(screen.getByTestId("denali-custom-service-add"));
    expect(screen.getByTestId("labels-json")).toHaveTextContent('["صبحانه"]');

    fireEvent.click(screen.getByTestId("toggle-step"));
    expect(screen.queryByTestId("denali-custom-services")).toBeNull();
    expect(screen.getByTestId("labels-json")).toHaveTextContent('["صبحانه"]');

    fireEvent.click(screen.getByTestId("toggle-step"));
    expect(screen.getByText("صبحانه")).toBeInTheDocument();
  });
});
