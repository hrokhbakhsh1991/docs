/**
 * Denali create wizard — active publish must not POST when validation fails.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DenaliCreateTourWizard } from "@/components/tours/wizard/DenaliCreateTourWizard";
import { focusDenaliWizardField } from "@/features/tours/wizard/denali/denaliWizardFieldFocus";
import { AppTestProviders } from "@test-utils/denali-integration-harness";

const mockMutateAsync = jest.fn();

jest.mock("@/features/tours/wizard/hooks/useDenaliTourWizardCreate", () => ({
  useDenaliTourWizardCreate: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    isSuccess: false,
    status: "idle",
  }),
}));

jest.mock("@/lib/services/tours.service", () => ({
  createTour: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/hooks/use-workspace-query-scope", () => ({
  useWorkspaceQueryScope: () => "workspace-test-id",
}));

jest.mock("@/hooks/use-tenant-wizard-template", () => ({
  useTenantWizardTemplate: () => ({
    data: { baseProfile: "denali_pilot", canonicalData: null },
    isLoading: false,
  }),
}));

jest.mock("@/hooks/use-settings-tour-themes", () => ({
  useSettingsTourThemes: () => ({ data: [] }),
}));

jest.mock("@/hooks/use-tour-destinations", () => ({
  useTourDestinations: () => ({ destinations: [] }),
}));

jest.mock("@/hooks/use-settings-equipment", () => ({
  useSettingsEquipment: () => ({ data: [] }),
}));

jest.mock("@/hooks/use-workspace-tour-crew-members", () => ({
  useWorkspaceTourCrewMembers: () => ({ data: [] }),
}));

const draftEngineState = {
  state: { status: "IDLE" as const, data: null, pendingDraft: null },
  setDraftData: jest.fn(),
  retry: jest.fn(),
  // Never resolve: completing draft init enables watch→setDraftData loops that hang RTL in jsdom.
  initialize: jest.fn(() => new Promise<void>(() => undefined)),
  applyDraft: jest.fn(),
  clearDraft: jest.fn(),
};

jest.mock("@repo/draft-engine", () => ({
  useDraftEngine: () => draftEngineState,
}));

jest.mock("@/features/tours/wizard/schemas/denaliTourCreateValidation", () => ({
  applyDenaliWizardStepValidation: () => true,
}));

jest.mock("@/features/tours/wizard/denali/hooks/usePublishButtonGuard", () => ({
  usePublishButtonGuard: () => ({
    disabled: false,
    disabledReason: null,
    publishIssues: [],
    submitIssues: [],
  }),
}));

jest.mock("@/features/tours/wizard/schemas/denaliWizardCanonicalResolver", () => ({
  createDenaliCanonicalWizardResolver: () => async (values: unknown) => ({
    values,
    errors: {},
  }),
}));

jest.mock("@/components/shared/QuickAddModal", () => ({
  QuickAddModalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/layouts", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components/shared/quick-add/QuickAddModal.module.css", () => ({}));
jest.mock("@/features/tours/wizard/denali/components/DenaliWizardHeader.module.css", () => ({}));
jest.mock("@/components/tours/TourPublishStatusField.module.css", () => ({}));

jest.mock("@/features/tours/wizard/denali/components/DenaliWizardHeader", () => ({
  DenaliWizardContentQualityHeader: () => null,
}));

jest.mock("@tour/ui", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Card: ({ children, ...rest }: { children: React.ReactNode }) => <div {...rest}>{children}</div>,
  CardBody: ({ children, ...rest }: { children: React.ReactNode }) => <div {...rest}>{children}</div>,
}));

jest.mock("@/features/tours/wizard/schemas/denaliCore.schema", () => {
  const actual = jest.requireActual<typeof import("@/features/tours/wizard/schemas/denaliCore.schema")>(
    "@/features/tours/wizard/schemas/denaliCore.schema",
  );
  return {
    ...actual,
    buildDenaliTourCreateDefaultValues: () => {
      const form = actual.buildDenaliTourCreateTestValues();
      form.basicInfo.publishStatus = "active";
      form.basicInfo.title = "";
      form.programNature.shortDescription = "";
      return form;
    },
  };
});

jest.mock("@/features/tours/wizard/denali/validation/denaliRuleAccess", () => {
  const actual = jest.requireActual<
    typeof import("@/features/tours/wizard/denali/validation/denaliRuleAccess")
  >("@/features/tours/wizard/denali/validation/denaliRuleAccess");
  return {
    ...actual,
    getDenaliWizardVisibleSteps: () => ["review"] as const,
    withDenaliWizardRailTestingOverrides: <T,>(steps: T) => steps,
  };
});

jest.mock("@/features/tours/wizard/denali/denaliWizardFieldFocus", () => ({
  focusDenaliWizardField: jest.fn(),
  clearDenaliWizardFieldFocus: jest.fn(),
}));

jest.mock("@/features/tours/wizard/denali", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");

  return {
    DenaliBasicInfoStep: () => null,
    DenaliProgramNatureStep: () => null,
    DenaliLogisticsStep: () => null,
    DenaliPricingStep: () => null,
    DenaliPhotosStep: () => null,
    DenaliReviewStep: () =>
      ReactActual.createElement(
        "div",
        { "data-testid": "denali-step-review" },
        ReactActual.createElement(
          "div",
          { role: "alert", "data-testid": "denali-summary-error" },
          ReactActual.createElement(
            "button",
            {
              type: "button",
              "data-testid": "denali-validation-field-link-basicInfo-title",
              onClick: () => {
                const { focusDenaliWizardField: focusField } = require("@/features/tours/wizard/denali/denaliWizardFieldFocus");
                focusField("basicInfo.title");
              },
            },
            "review.validationFieldIssue",
          ),
        ),
      ),
  };
});

const mockFocusDenaliWizardField = focusDenaliWizardField as jest.MockedFunction<
  typeof focusDenaliWizardField
>;

describe("DenaliCreateTourWizard — active submission guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  test("blocks active submit, shows error, and focuses field when error link is clicked", async () => {
    render(
      <AppTestProviders>
        <DenaliCreateTourWizard />
      </AppTestProviders>,
    );

    const saveButton = await screen.findByTestId("denali-wizard-final-submit");
    mockFocusDenaliWizardField.mockClear();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(screen.getByText("review.publishSubmitBlocked")).toBeInTheDocument();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("denali-summary-error")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("denali-validation-field-link-basicInfo-title"));
    });

    expect(mockFocusDenaliWizardField).toHaveBeenCalledWith("basicInfo.title");
  });
});
