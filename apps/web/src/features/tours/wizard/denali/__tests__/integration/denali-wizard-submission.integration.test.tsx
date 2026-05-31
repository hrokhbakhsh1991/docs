/**
 * Denali create wizard — active publish must not POST when validation fails.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { WorkspaceTourWizard } from "@/components/tours/wizard/WorkspaceTourWizard";
import { focusDenaliWizardField } from "@/features/tours/wizard/denali/denaliWizardFieldFocus";
import { getWizardConfig } from "@/features/tours/wizard/workspace-wizard.config";
import type { WizardSessionBlueprint } from "@/features/tours/wizard/wizard-session-blueprint.types";
import { AppTestProviders } from "@test-utils/denali-integration-harness";

const mockMutateAsync = jest.fn();

const mockWizardTemplate = {
  id: "test-template",
  workspaceId: "workspace-test-id",
  baseProfile: "denali_pilot" as const,
  stepOverrides: { skip: [] as const, insert: [] as const },
  fieldRulesOverlay: {},
  presetId: null,
  canonicalData: {},
  wizardContractVersion: 1,
  formProfileVersion: 1,
};

const mockSessionBlueprint: WizardSessionBlueprint = {
  template: mockWizardTemplate,
  profile: "denali_pilot",
  shellConfig: getWizardConfig("denali_pilot"),
};

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
  initialize: jest.fn(() => Promise.resolve()),
  applyDraft: jest.fn(),
  clearDraft: jest.fn(() => Promise.resolve()),
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

jest.mock("@/features/tours/wizard/denali/steps/DenaliBasicInfoStep", () => ({
  DenaliBasicInfoStep: () => null,
}));
jest.mock("@/features/tours/wizard/denali/steps/DenaliProgramNatureStep", () => ({
  DenaliProgramNatureStep: () => null,
}));
jest.mock("@/features/tours/wizard/denali/steps/DenaliLogisticsStep", () => ({
  DenaliLogisticsStep: () => null,
}));
jest.mock("@/features/tours/wizard/denali/steps/DenaliPricingStep", () => ({
  DenaliPricingStep: () => null,
}));
jest.mock("@/features/tours/wizard/denali/steps/DenaliPhotosStep", () => ({
  DenaliPhotosStep: () => null,
}));
jest.mock("@/features/tours/wizard/denali/steps/DenaliLegalStep", () => ({
  DenaliLegalStep: () => null,
}));
jest.mock("@/features/tours/wizard/denali/steps/DenaliReviewStep", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  return {
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

describe("WorkspaceTourWizard — active submission guard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test("blocks active submit, shows error, and focuses field when error link is clicked", async () => {
    render(
      <AppTestProviders>
        <WorkspaceTourWizard sessionBlueprint={mockSessionBlueprint} />
      </AppTestProviders>,
    );

    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(600);
    });

    const saveButton = screen.getByTestId("workspace-wizard-final-submit");
    mockFocusDenaliWizardField.mockClear();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByText("review.publishSubmitBlocked")).toBeInTheDocument();

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("denali-summary-error")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("denali-validation-field-link-basicInfo-title"));
    });

    expect(mockFocusDenaliWizardField).toHaveBeenCalledWith("basicInfo.title");
  });
});
