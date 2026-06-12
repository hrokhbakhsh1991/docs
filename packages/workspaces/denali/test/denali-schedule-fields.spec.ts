import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { evaluateFormFieldRule } from "../src/rules/evaluateFormRules";

function baseForm(tourType: string): DenaliCreateTourWizardForm {
  return {
    basicInfo: {
      title: "Tour",
      tourType: tourType as DenaliCreateTourWizardForm["basicInfo"]["tourType"],
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-07-01T08:00:00.000Z",
      endDateTime: "2026-07-03T18:00:00.000Z",
      capacityMin: undefined,
      capacityMax: 20,
      meetingPoint: undefined,
      startPointLocationText: undefined,
      approximateReturnTime: "18:30",
      leaderUserIds: [],
      requiresLocalGuide: false,
      localGuideName: undefined,
      requiresManualAdminApproval: false,
      socialMediaLink: undefined,
      publishStatus: "draft",
    },
    programNature: {
      themeIds: [],
      guideLanguageIds: [],
      shortDescription: undefined,
      longDescription: undefined,
      difficultyLevel: 5,
      hikingHoursApprox: undefined,
      hikingGoHours: undefined,
      hikingReturnHours: undefined,
      itinerary: [],
    },
    transport: { transportMode: "none" },
    pricingPayment: {
      requiresPayment: false,
      basePricePerPerson: undefined,
      paymentMode: undefined,
      includesTourInsurance: false,
    },
    participantRequirements: {
      minimumAge: undefined,
      maximumAge: undefined,
      fitnessLevel: undefined,
      nationalIdRequired: false,
      sportsInsuranceRequired: false,
      minRequiredPeaks: undefined,
      fitnessPrerequisiteText: undefined,
      gearItems: [],
    },
    policies: {},
    photosData: { photos: [] },
    tripDetails: {
      logistics: { gatheringPoints: [] },
      overview: { customServiceLabels: [] },
      metrics: {},
    },
  };
}

describe("denali-schedule-fields.spec.ts", () => {
  it("DN-SCHED-01 single-day tour shows approximate return time, not end datetime", () => {
    const form = baseForm("mountain_day");
    const returnTime = evaluateFormFieldRule(form, "approximateReturnTime", "denali_basic");
    const endDateTime = evaluateFormFieldRule(form, "endDateTime", "denali_basic");
    assert.equal(returnTime.visible, true);
    assert.equal(endDateTime.visible, false);
  });

  it("DN-SCHED-02 multi-day tour shows end datetime, not approximate return time", () => {
    const form = baseForm("mountain_multi");
    const returnTime = evaluateFormFieldRule(form, "approximateReturnTime", "denali_basic");
    const endDateTime = evaluateFormFieldRule(form, "endDateTime", "denali_basic");
    assert.equal(returnTime.visible, false);
    assert.equal(endDateTime.visible, true);
    assert.equal(endDateTime.required, true);
  });
});
