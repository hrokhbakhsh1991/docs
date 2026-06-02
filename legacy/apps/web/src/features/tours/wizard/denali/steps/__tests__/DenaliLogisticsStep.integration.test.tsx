/**
 * Custom services labels live in RHF form state (tripDetails.overview.customServiceLabels).
 */
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliLogistics.schema";
import { DenaliFormHarness, DenaliFormWatchProbe } from "@test-utils/denali-integration-harness";

import {
  DENALI_CUSTOM_SERVICE_LABELS_PATH,
  DenaliCustomServicesField,
} from "../../components/DenaliCustomServicesField";

jest.mock("@/hooks/use-tenant-wizard-template", () => ({
  useTenantWizardTemplate: () => ({ data: { baseProfile: "denali_pilot" } }),
}));

function CustomServicesFixture() {
  const [onLogisticsStep, setOnLogisticsStep] = useState(true);
  const defaultValues = buildDenaliTourCreateDefaultValues();

  return (
    <DenaliFormHarness defaultValues={defaultValues}>
      {onLogisticsStep ? <DenaliCustomServicesField workspaceFormProfile="denali_pilot" /> : null}
      <DenaliFormWatchProbe name={DENALI_CUSTOM_SERVICE_LABELS_PATH} testId="labels-json" />
      <button type="button" data-testid="toggle-step" onClick={() => setOnLogisticsStep((v) => !v)}>
        toggle
      </button>
    </DenaliFormHarness>
  );
}

describe("DenaliLogisticsStep custom services", () => {
  test("persists labels in form state when logistics step unmounts", () => {
    render(<CustomServicesFixture />);

    const input = screen.getByTestId("denali-custom-service-input-0");
    fireEvent.change(input, { target: { value: "صبحانه" } });
    expect(screen.getByTestId("labels-json")).toHaveTextContent('["صبحانه"]');

    fireEvent.click(screen.getByTestId("toggle-step"));
    expect(screen.queryByTestId("denali-custom-services")).toBeNull();
    expect(screen.getByTestId("labels-json")).toHaveTextContent('["صبحانه"]');

    fireEvent.click(screen.getByTestId("toggle-step"));
    expect(screen.getByDisplayValue("صبحانه")).toBeInTheDocument();
  });

  test("does not append a row when an input blurs", () => {
    render(<CustomServicesFixture />);

    const input = screen.getByTestId("denali-custom-service-input-0");
    fireEvent.change(input, { target: { value: "نیسان" } });
    fireEvent.blur(input);

    expect(screen.queryByTestId("denali-custom-service-input-1")).toBeNull();
    expect(screen.getByTestId("labels-json")).toHaveTextContent('["نیسان"]');
  });
});
