import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { collectDenaliRuleRequiredIssues } from "../src/rules/denaliRuleRequired";
import { denaliRuleModelMountainMultiDay } from "../src/rules/denaliRuleModel";

function logisticsFormWithPersonalCarNoDong(): DenaliCreateTourWizardForm {
  return {
    basicInfo: {
      title: "Tour",
      tourType: "mountain_multi",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-07-01T08:00:00.000Z",
      endDateTime: "2026-07-03T18:00:00.000Z",
      capacityMax: 12,
      leaderUserIds: [],
      requiresLocalGuide: false,
      requiresManualAdminApproval: false,
      publishStatus: "draft",
    },
    programNature: {
      themeIds: [],
      guideLanguageIds: [],
      itinerary: [],
    },
    transport: {
      transportMode: "bus",
      allowPersonalCar: true,
      dongAmount: undefined,
    },
    pricingPayment: {},
    participantRequirements: {},
    policies: {},
    photosData: { photos: [] },
    locationZones: {},
    customServices: { items: [] },
    tourServices: { items: [] },
  } as DenaliCreateTourWizardForm;
}

describe("denali-rule-required-step.spec.ts — TW-18", () => {
  it("WEB-P11-7-09 empty dongAmount blocks logistics step when personal car allowed", () => {
    const issues = collectDenaliRuleRequiredIssues(
      logisticsFormWithPersonalCarNoDong(),
      denaliRuleModelMountainMultiDay,
      { mode: "step", stepId: "denali_logistics" }
    );
    assert.ok(
      issues.some((issue) => issue.path.join(".") === "transport.dongAmount"),
      "expected transport.dongAmount required on logistics step"
    );
  });
});
