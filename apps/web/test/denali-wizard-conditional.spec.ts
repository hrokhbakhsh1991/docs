/**
 * Denali conditional wizard — matrix dimensions + contextual field rules
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RenderStepPlan } from "@app-tour/platform-core";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import {
  applyDenaliConditionalFieldRules,
  resolveDenaliDimensionsFromDraft,
} from "@app-tour/workspace-denali/wizard/contextual";
import { isDenaliMultiDayTourKind } from "@app-tour/workspace-denali/ui/logic/denali-photo-types";

const MOCK_RULES = {
  evaluateFormFieldRule: (
    form: Record<string, unknown>,
    path: string,
    _step: string
  ): { visible: boolean; required: boolean } => {
    const basicInfo = form.basicInfo as Record<string, unknown> | undefined;
    const tourType = basicInfo?.tourType;
    if (path === "tripDetails.overview.peakHeight" && tourType === "nature_day") {
      return { visible: false, required: false };
    }
    if (path === "program.itinerary" && tourType === "mountain_multi") {
      return { visible: true, required: true };
    }
    return { visible: true, required: false };
  },
  buildDefaultForm: () => ({
    basicInfo: { tourType: undefined },
    programNature: { itinerary: [] },
    transport: { transportMode: "none" },
    pricingPayment: { requiresPayment: false },
    participantRequirements: {},
    policies: {},
    photosData: { photos: [] },
    tripDetails: { logistics: { gatheringPoints: [] }, overview: {}, metrics: {} },
  }),
  readCanonicalBasics: (tourKind: string | undefined) => {
    if (tourKind === "mountain_multi") {
      return { category: "mountain", duration: "multi_day" };
    }
    if (tourKind === "nature_day") {
      return { category: "nature", duration: "single_day" };
    }
    if (tourKind === "mountain_day") {
      return { category: "mountain", duration: "single_day" };
    }
    return null;
  },
  canonicalToFormPathMap: {
    category: "basicInfo.tourType",
    "tripDetails.overview.peakHeight": "tripDetails.overview.peakHeight",
    "program.itinerary": "programNature.itinerary",
  },
  tourKindValues: ["mountain_day", "mountain_multi", "nature_day"],
} as const;

const BASE_PLAN: readonly RenderStepPlan[] = [
  {
    stepId: "denali_basic",
    fields: [
      {
        fieldId: "peakHeight",
        kind: "number",
        canonicalPath: "tripDetails.overview.peakHeight",
        required: true,
        hidden: false,
        stepId: "denali_basic",
      },
    ],
  },
  {
    stepId: "denali_program",
    fields: [
      {
        fieldId: "itinerary",
        kind: "composite",
        canonicalPath: "program.itinerary",
        required: false,
        hidden: false,
        stepId: "denali_program",
        uiHints: { compositeId: "denali.itinerary" },
      },
    ],
  },
];

describe("denali-wizard-conditional.spec.ts", () => {
  it("WEB-DENALI-COND-01 resolves matrix dimensions from tour kind slug", () => {
    const draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_multi");
    assert.deepEqual(resolveDenaliDimensionsFromDraft(draft, MOCK_RULES), {
      category: "mountain",
      duration: "multi_day",
    });
  });

  it("WEB-DENALI-COND-02 hides peak height for nature single-day matrix cell", () => {
    const draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "nature_day");
    const filtered = applyDenaliConditionalFieldRules(BASE_PLAN, draft, MOCK_RULES);
    const hasPeakHeight = filtered.some((step) =>
      step.fields.some((field) => field.canonicalPath === "tripDetails.overview.peakHeight")
    );
    assert.equal(hasPeakHeight, false);
  });

  it("WEB-DENALI-COND-03 marks itinerary required for multi-day mountain", () => {
    const draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_multi");
    const filtered = applyDenaliConditionalFieldRules(BASE_PLAN, draft, MOCK_RULES);
    const program = filtered.find((step) => step.stepId === "denali_program");
    const itinerary = program?.fields.find((field) => field.canonicalPath === "program.itinerary");
    assert.equal(itinerary?.required, true);
  });

  it("WEB-DENALI-COND-04 skips contextual filter until tour kind is selected", () => {
    const filtered = applyDenaliConditionalFieldRules(BASE_PLAN, emptyTourWizardDraft(), MOCK_RULES);
    assert.equal(filtered.length, BASE_PLAN.length);
  });

  it("WEB-DENALI-COND-06 matrix fallback dimensions differ from empty draft classification", () => {
    const draft = emptyTourWizardDraft();
    const dimensions = resolveDenaliDimensionsFromDraft(draft, MOCK_RULES);
    assert.deepEqual(dimensions, { category: "mountain", duration: "single_day" });
    assert.equal(getCanonicalStringValue(draft, "category"), "");
  });

  it("WEB-DENALI-COND-05 detects multi-day tour kinds", () => {
    assert.equal(isDenaliMultiDayTourKind("mountain_multi"), true);
    assert.equal(isDenaliMultiDayTourKind("mountain_day"), false);
  });
});
