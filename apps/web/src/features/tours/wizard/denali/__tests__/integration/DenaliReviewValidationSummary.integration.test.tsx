/**
 * Review validation summary — step grouping, publish-readiness warnings, and navigateToField links.
 */
jest.mock("@/hooks/use-settings-tour-themes", () => ({
  useSettingsTourThemes: () => ({ data: [] }),
}));

jest.mock("@/hooks/use-tour-destinations", () => ({
  useTourDestinations: () => ({ groupedRegions: [] }),
}));

jest.mock("@/hooks/use-settings-equipment", () => ({
  useSettingsEquipment: () => ({ data: [], isLoading: false }),
}));

jest.mock("@/hooks/use-workspace-tour-crew-members", () => ({
  useWorkspaceTourCrewMembers: () => ({ data: [] }),
}));

jest.mock("@/components/tours/TourPublishStatusField", () => ({
  TourPublishStatusField: () => <div data-testid="denali-review-publish-status" />,
}));

const mockNavigateToField = jest.fn();

jest.mock("../../DenaliWizardNavigationContext", () => {
  const actual = jest.requireActual("../../DenaliWizardNavigationContext");
  const { denaliTestConfig } = jest.requireActual("../../wizardTestConfig.denali");
  return {
    ...actual,
    useDenaliWizardNavigationOptional: () => ({
      navigateToField: mockNavigateToField,
      currentStepIndex: 0,
      visibleSteps: denaliTestConfig.steps,
    }),
  };
});

jest.mock("../../application", () => {
  const actual = jest.requireActual("../../application");
  const { denaliTestConfig } = jest.requireActual("../../wizardTestConfig.denali");
  const geoCode = denaliTestConfig.publishReadiness.codes.requiresGeolocationZones;
  const geoFixture = denaliTestConfig.publishReadiness.pathFixtures[geoCode].find(
    (issue: { path?: string }) => issue.path === denaliTestConfig.paths.gatheringPoints,
  );
  return {
    ...actual,
    useWizardStateGuard: () => ({
      publishStatus: "draft",
      effectivePublishStatus: "draft",
      publishIssues: geoFixture ? [geoFixture] : [],
      canSetActive: false,
      publishReadinessBlocked: false,
      disableActivePublish: true,
      requestStatus: jest.fn(),
      enforceSafeStatus: jest.fn(),
    }),
    logDenaliWizardDiagnosticReport: jest.fn(),
    getDenaliWizardSubmitIssues: () => [],
  };
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { wizardIssueLinkTestId } from "@/features/tours/wizard/testing/wizard-testing-utils";
import { DenaliFormNavigationHarness } from "@test-utils/denali-integration-harness";

import { denaliTestConfig } from "../../wizardTestConfig.denali";
import {
  DenaliReviewValidationSummary,
  type DenaliReviewValidationSummaryProps,
} from "../../components/DenaliReviewValidationSummary";
import { DenaliReviewStep } from "../../steps/DenaliReviewStep";

function buildMountainDayForm(
  overrides: Partial<{
    title: string;
    shortDescription: string;
  }> = {},
): DenaliCreateTourWizardForm {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = denaliTestConfig.defaultActiveTourKind!;
  form.basicInfo.title = overrides.title ?? form.basicInfo.title;
  form.programNature.shortDescription =
    overrides.shortDescription ?? form.programNature.shortDescription;
  return form;
}

function geoPublishIssueFromConfig() {
  const { publishReadiness, paths } = denaliTestConfig;
  const code = publishReadiness.codes.requiresGeolocationZones;
  const fixture = publishReadiness.pathFixtures[code].find(
    (issue) => publishReadiness.resolveFormPath(issue) === paths.gatheringPoints,
  );
  if (fixture == null) {
    throw new Error("missing geo publish-readiness fixture in denaliTestConfig");
  }
  return fixture;
}

const reviewNavigation = () => {
  const visibleSteps = denaliTestConfig.steps!;
  return {
    visibleSteps,
    currentStepIndex: visibleSteps.length - 1,
    setCurrentStep: jest.fn(),
  };
};

function renderReviewSummary(
  defaultValues: DenaliCreateTourWizardForm,
  publishIssues: DenaliReviewValidationSummaryProps["publishIssues"] = [],
) {
  return render(
    <DenaliFormNavigationHarness defaultValues={defaultValues} navigation={reviewNavigation()}>
      <DenaliReviewValidationSummary publishIssues={publishIssues} />
    </DenaliFormNavigationHarness>,
  );
}

function renderReviewStep(defaultValues: DenaliCreateTourWizardForm) {
  return render(
    <DenaliFormNavigationHarness defaultValues={defaultValues} navigation={reviewNavigation()}>
      <DenaliReviewStep />
    </DenaliFormNavigationHarness>,
  );
}

describe("DenaliReviewValidationSummary", () => {
  const { testIds, paths } = denaliTestConfig;

  beforeEach(() => {
    mockNavigateToField.mockClear();
  });

  describe("step grouping on review", () => {
    it("groups shortDescription issues under denali_photos", () => {
      const form = buildMountainDayForm({ title: "", shortDescription: "" });

      renderReviewSummary(form, []);

      expect(screen.getByTestId(testIds!.summaryError)).toBeInTheDocument();
      expect(screen.queryByTestId(testIds!.publishReadinessWarning)).toBeNull();
      expect(screen.getByTestId("denali-validation-step-denali_photos")).toBeInTheDocument();
      expect(screen.queryByTestId("denali-validation-step-denali_program")).toBeNull();
      expect(
        screen.getByTestId(
          wizardIssueLinkTestId(testIds!.validationFieldLink, "programNature.shortDescription"),
        ),
      ).toBeInTheDocument();
    });

    it("groups title issues under denali_basic", () => {
      const form = buildMountainDayForm({ title: "", shortDescription: "Valid short description" });

      renderReviewSummary(form, []);

      expect(screen.getByTestId("denali-validation-step-denali_basic")).toBeInTheDocument();
      expect(screen.queryByTestId("denali-validation-step-denali_photos")).toBeNull();
    });
  });

  describe("navigateToField from issue links", () => {
    it("submit error link calls navigateToField with photos step and shortDescription path", () => {
      const form = buildMountainDayForm({ title: "", shortDescription: "" });

      renderReviewSummary(form, []);

      fireEvent.click(
        screen.getByTestId(
          wizardIssueLinkTestId(testIds!.validationFieldLink, "programNature.shortDescription"),
        ),
      );

      const expected = denaliTestConfig.resolveSubmitNavigation(
        "programNature.shortDescription",
        form,
      );
      expect(mockNavigateToField).toHaveBeenCalledWith(
        expected.stepId,
        expected.formPath,
      );
    });

    it("publish-readiness gathering link calls navigateToField", () => {
      const form = buildMountainDayForm({
        title: "Valid tour title for publish readiness test",
        shortDescription: "Valid short description for publish readiness test",
      });

      renderReviewSummary(form, [geoPublishIssueFromConfig()]);

      expect(screen.getByTestId(testIds!.publishReadinessWarning)).toBeInTheDocument();
      expect(screen.getByTestId("denali-validation-step-denali_logistics")).toBeInTheDocument();

      fireEvent.click(
        screen.getByTestId(
          wizardIssueLinkTestId(testIds!.publishReadinessFieldLink, paths!.gatheringPoints),
        ),
      );

      const expected = denaliTestConfig.resolvePublishReadinessNavigation(
        geoPublishIssueFromConfig(),
        form,
      );
      expect(mockNavigateToField).toHaveBeenCalledWith(
        expected.stepId,
        expected.formPath,
      );
    });

    it("DenaliReviewStep publish-readiness geo link calls navigateToField", () => {
      renderReviewStep(buildMountainDayForm());

      expect(screen.getByTestId(testIds!.publishReadinessWarning)).toBeInTheDocument();

      fireEvent.click(
        screen.getByTestId(
          wizardIssueLinkTestId(testIds!.publishReadinessFieldLink, paths!.gatheringPoints),
        ),
      );

      const expected = denaliTestConfig.resolvePublishReadinessNavigation(
        geoPublishIssueFromConfig(),
        buildMountainDayForm(),
      );
      expect(mockNavigateToField).toHaveBeenCalledWith(
        expected.stepId,
        expected.formPath,
      );
    });
  });
});
