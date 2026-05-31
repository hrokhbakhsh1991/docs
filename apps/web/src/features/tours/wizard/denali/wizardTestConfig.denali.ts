/**
 * Denali workspace test configuration — single source for structural guard specs.
 */
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  denaliWizardSteps,
  getDenaliWizardSteps,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import { DENALI_ROOTS } from "@repo/shared-contracts";

import type { WizardTestConfig } from "@/features/tours/wizard/testing/wizard-testing-utils";

import {
  DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  migrateDenaliDraftStepIndex,
  sanitizeDenaliWizardDraftSnapshot,
} from "@/features/tours/drafts/sanitizeDenaliWizardDraftSnapshot";
import { buildWorstCaseDenaliWizardForm } from "./__benchmarks__/fixtures/buildWorstCaseDenaliWizardForm";
import { setDenaliFormPathValue } from "./denaliFormPathUtils";
import {
  buildDenaliPublishReadinessIssueViews,
  resolvePublishReadinessFormPath,
  resolveStepForIssue,
  type DenaliWizardSubmitIssueView,
} from "./denaliWizardSubmitIssuePresentation";
import { getDenaliWizardFieldFocusMapKeys } from "./denaliWizardFieldFocus";
import { isFormPathNavigable } from "@/features/tours/wizard/testing/wizard-testing-utils";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { DENALI_FIELD_DEFINITIONS } from "@repo/denali-domain";
import {
  DENALI_PUBLISH_READINESS_BLOCKING_CODES,
  DENALI_PUBLISH_READINESS_PATH_FIXTURES,
  publishReadinessIssueHasResolvablePath,
  type DenaliPublishReadinessBlockingCode,
} from "./validation/denaliPublishReadinessIssueCodes";
import {
  getDenaliWizardPublishReadinessIssues,
  type DenaliWizardPublishReadinessIssue,
} from "./validation/denaliWizardPublishReadiness";

export type DenaliWizardTestConfig = WizardTestConfig<
  DenaliCreateWizardStepId,
  DenaliCreateTourWizardForm
> & {
  publishReadiness: WizardTestConfig<
    DenaliCreateWizardStepId,
    DenaliCreateTourWizardForm
  >["publishReadiness"] & {
    blockingCodes: readonly DenaliPublishReadinessBlockingCode[];
    pathFixtures: typeof DENALI_PUBLISH_READINESS_PATH_FIXTURES;
    codes: {
      readonly validationRuleRequiredField: "VALIDATION_RULE_REQUIRED_FIELD";
      readonly tourTypeRequired: "DENALI_TOUR_TYPE_REQUIRED";
      readonly payloadUnbuildable: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE";
      readonly requiresGeolocationZones: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES";
    };
    buildIssueViews: (
      issues: readonly DenaliWizardPublishReadinessIssue[],
      form: DenaliCreateTourWizardForm,
      t: (key: string) => string,
    ) => ReturnType<typeof buildDenaliPublishReadinessIssueViews>;
  };
  resolveSubmitNavigation: (
    formPath: string,
    form: DenaliCreateTourWizardForm,
  ) => Pick<DenaliWizardSubmitIssueView, "formPath" | "stepId">;
  resolvePublishReadinessNavigation: (
    issue: DenaliWizardPublishReadinessIssue,
    form: DenaliCreateTourWizardForm,
  ) => { formPath: string; stepId: DenaliCreateWizardStepId };
};

const DENALI_DEFAULT_ACTIVE_TOUR_KIND = "mountain_day" as const;
const DENALI_GATHERING_POINTS_PATH = "tripDetails.logistics.gatheringPoints" as const;

function buildActivePublishGuardForm(): DenaliCreateTourWizardForm {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.publishStatus = "active";
  form.basicInfo.tourType = DENALI_DEFAULT_ACTIVE_TOUR_KIND;
  form.tripDetails = {
    ...form.tripDetails,
    logistics: { gatheringPoints: [] },
  };
  return form;
}

const denaliTestTranslator = ((key: string) => key) as Parameters<
  typeof buildDenaliPublishReadinessIssueViews
>[3];

export const denaliTestConfig = {
  railId: "denali",
  steps: getDenaliWizardSteps(),
  fieldRegistry: DENALI_FIELD_DEFINITIONS,
  getFocusMapKeys: getDenaliWizardFieldFocusMapKeys,
  nonFocusableStepIds: ["review"] as const,
  testIds: {
    validationFieldLink: "denali-validation-field-link",
    publishReadinessFieldLink: "denali-publish-readiness-field-link",
    summaryError: "denali-summary-error",
    publishReadinessWarning: "denali-review-publish-readiness-warning",
  },
  paths: {
    gatheringPoints: DENALI_GATHERING_POINTS_PATH,
  },
  defaultActiveTourKind: DENALI_DEFAULT_ACTIVE_TOUR_KIND,
  buildActivePublishGuardForm,
  resolveSubmitNavigation(formPath: string, form: DenaliCreateTourWizardForm) {
    return {
      formPath,
      stepId: resolveStepForIssue(formPath, form, denaliRuleSet),
    };
  },
  resolvePublishReadinessNavigation(
    issue: DenaliWizardPublishReadinessIssue,
    form: DenaliCreateTourWizardForm,
  ) {
    const [view] = buildDenaliPublishReadinessIssueViews(
      [issue],
      form,
      denaliRuleSet,
      denaliTestTranslator,
    );
    return {
      formPath: view?.formPath ?? resolvePublishReadinessFormPath(issue),
      stepId:
        (view?.stepId as DenaliCreateWizardStepId | undefined) ??
        resolveStepForIssue(resolvePublishReadinessFormPath(issue), form, denaliRuleSet),
    };
  },
  draftSchema: {
    formRoots: DENALI_ROOTS,
    buildMinimalForm: buildDenaliTourCreateTestValues,
    buildRepresentabilityForm: buildWorstCaseDenaliWizardForm,
    ensurePathOnForm(form, formPath) {
      if (isFormPathNavigable(form, formPath)) {
        return;
      }
      setDenaliFormPathValue(form, formPath, "");
    },
    sanitizeSnapshot: sanitizeDenaliWizardDraftSnapshot,
    migrations: {
      currentRailLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
      migrateStepIndex: migrateDenaliDraftStepIndex,
    },
  },
  publishReadiness: {
    blockingCodes: DENALI_PUBLISH_READINESS_BLOCKING_CODES,
    pathFixtures: DENALI_PUBLISH_READINESS_PATH_FIXTURES,
    hasResolvablePath: publishReadinessIssueHasResolvablePath,
    resolveFormPath: resolvePublishReadinessFormPath,
    getIssues: getDenaliWizardPublishReadinessIssues,
    codes: {
      validationRuleRequiredField: "VALIDATION_RULE_REQUIRED_FIELD",
      tourTypeRequired: "DENALI_TOUR_TYPE_REQUIRED",
      payloadUnbuildable: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
      requiresGeolocationZones: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
    },
    buildIssueViews: (
      issues: readonly DenaliWizardPublishReadinessIssue[],
      form: DenaliCreateTourWizardForm,
      t: (key: string) => string,
    ) =>
      buildDenaliPublishReadinessIssueViews(
        issues,
        form,
        denaliRuleSet,
        t as Parameters<typeof buildDenaliPublishReadinessIssueViews>[3],
      ),
  },
} satisfies DenaliWizardTestConfig;

/** Re-export for specs that assert rail order without importing denaliStepConfig directly. */
export { denaliWizardSteps };
