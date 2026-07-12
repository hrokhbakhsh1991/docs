import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RenderStepPlan } from "@app-tour/platform-core";

import { readDenaliCanonicalBasics } from "../src/adapters/denaliCanonicalBasicsControl";
import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
import { applyDestinationCatalogPrefill } from "../src/settings/apply-destination-catalog-prefill";
import { buildDenaliFullWizardTemplateSteps } from "../src/settings/denaliFullWizardTemplate";
import { applyDenaliInvariantState } from "../src/normalize/invariantState";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../src/rules/generated/denaliCanonicalPathMap.generated";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";
import { evaluateFormFieldRule } from "../src/rules/evaluateFormRules";
import { applyDenaliConditionalFieldRules } from "../src/wizard/apply-contextual-render-plan";
import { isDenaliWizardFieldVisibleOnDraft } from "../src/wizard/denali-wizard-field-visibility";
import type { DestinationResource } from "../src/ui/adapters/catalog-types";
import { buildDenaliReviewSections } from "../src/ui/logic/denali-review-format-logic";

const RULES_MODULE = Object.freeze({
  applyDenaliInvariantState,
  buildDefaultForm: buildDenaliTourCreateDefaultValues,
  readCanonicalBasics: readDenaliCanonicalBasics,
  canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
  evaluateFormFieldRule,
});

function destination(partial: Partial<DestinationResource>): DestinationResource {
  return {
    id: "dest-1",
    tenantId: "tenant-1",
    regionId: "region-1",
    name: "توچال",
    locationType: "peak",
    altitudeM: 3962,
    typicalTrailDistanceKm: null,
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    ...partial,
  };
}

function draftWithCategory(slug: string) {
  return setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", slug);
}

function templateBasicPlan(): readonly RenderStepPlan[] {
  const basic = buildDenaliFullWizardTemplateSteps().find((step) => step.stepId === "denali_basic");
  assert.ok(basic);
  return [
    {
      stepId: "denali_basic",
      fields: basic.fields.map((field) => ({
        fieldId: field.canonicalPath,
        kind: "text" as const,
        canonicalPath: field.canonicalPath,
        required: field.required === true,
        hidden: false,
        stepId: "denali_basic",
      })),
    },
  ];
}

const REVIEW_LABELS = {
  fieldLabel: (path: string) => path,
  stepLabel: (stepId: string) => stepId,
  tourKindLabel: (slug: string) => slug,
  transportModeLabel: (mode: string) => mode,
  publishStatusLabel: (status: string) => status,
  locationZoneLabel: (path: string) => path,
  yes: "yes",
  no: "no",
  gearRequired: "req",
  gearOptional: "opt",
  photoCount: (count: number) => String(count),
  dayLabel: (day: number) => String(day),
  primaryGathering: "primary",
  socialMediaTelegramAutoLabel: "telegram-auto",
} as const;

describe("destination-catalog-metric-tour-visibility.spec.ts", () => {
  it("DN-CAT-METRIC-01 peak height visible only on mountain tour kinds (rule engine)", () => {
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(
        draftWithCategory("mountain_day"),
        "tripDetails.overview.peakHeight",
        "denali_basic"
      ),
      true
    );
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(
        draftWithCategory("mountain_multi"),
        "tripDetails.overview.peakHeight",
        "denali_basic"
      ),
      true
    );
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(
        draftWithCategory("nature_day"),
        "tripDetails.overview.peakHeight",
        "denali_basic"
      ),
      false
    );
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(
        draftWithCategory("nature_multi"),
        "tripDetails.overview.peakHeight",
        "denali_basic"
      ),
      false
    );
  });

  it("DN-CAT-METRIC-02 trail distance visible only on nature tour kinds (rule engine)", () => {
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(
        draftWithCategory("nature_day"),
        "tripDetails.overview.trailDistanceKm",
        "denali_basic"
      ),
      true
    );
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(
        draftWithCategory("mountain_day"),
        "tripDetails.overview.trailDistanceKm",
        "denali_basic"
      ),
      false
    );
  });

  it("DN-CAT-METRIC-03 full template + contextual rules hide peak on nature_day", () => {
    const draft = draftWithCategory("nature_day");
    const filtered = applyDenaliConditionalFieldRules(templateBasicPlan(), draft, RULES_MODULE);
    const basic = filtered.find((step) => step.stepId === "denali_basic");
    const paths = basic?.fields.map((field) => field.canonicalPath) ?? [];
    assert.equal(paths.includes("tripDetails.overview.peakHeight"), false);
    assert.equal(paths.includes("tripDetails.overview.trailDistanceKm"), true);
  });

  it("DN-CAT-METRIC-04 prefill skips peak altitude on nature tour even for peak destination", () => {
    let draft = draftWithCategory("nature_day");
    draft = applyDestinationCatalogPrefill(draft, destination({ locationType: "peak", altitudeM: 3962 }));
    assert.equal(getCanonicalStringValue(draft, "tripDetails.overview.peakHeight"), "");
  });

  it("DN-CAT-METRIC-05 review omits peak height row on nature tour", () => {
    let draft = draftWithCategory("nature_day");
    draft = setCanonicalStringValue(draft, "tripDetails.overview.peakHeight", "3962");
    const sections = buildDenaliReviewSections(
      draft,
      {
        destinationNameById: new Map(),
        leaderNameById: new Map(),
        themeNameById: new Map(),
        languageNameById: new Map(),
      },
      REVIEW_LABELS
    );
    const basic = sections.find((section) => section.stepId === "denali_basic");
    const peakRow = basic?.rows.find((row) => row.label === "tripDetails.overview.peakHeight");
    assert.equal(peakRow, undefined);
  });

  it("DN-CAT-METRIC-06 review omits elevation gain on nature tour", () => {
    let draft = draftWithCategory("nature_day");
    draft = setCanonicalStringValue(draft, "tripDetails.metrics.elevationGain", "800");
    const sections = buildDenaliReviewSections(
      draft,
      {
        destinationNameById: new Map(),
        leaderNameById: new Map(),
        themeNameById: new Map(),
        languageNameById: new Map(),
      },
      REVIEW_LABELS
    );
    const program = sections.find((section) => section.stepId === "denali_program");
    const gainRow = program?.rows.find(
      (row) => row.label === "tripDetails.metrics.elevationGain"
    );
    assert.equal(gainRow, undefined);
  });
});
