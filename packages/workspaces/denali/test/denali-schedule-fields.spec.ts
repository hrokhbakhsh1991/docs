import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { applyDenaliStructuralInvariants } from "../src/normalize/structuralInvariants";
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
  it("DN-SCHED-00 endDateTime clears when hidden like return time (ED-DT-CLEAR-01)", () => {
    const end = DENALI_FIELD_DEFINITIONS.find((field) => field.canonicalPath === "endDateTime");
    assert.deepEqual(end?.structuralInvariant, { kind: "clearWhenNotVisible" });
  });
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

  it("DN-SCHED-03 multi-day hides hiking go/return hours (ED-HIKE-MULTI-01)", () => {
    const multi = baseForm("mountain_multi");
    const go = evaluateFormFieldRule(multi, "program.hikingGoHours", "denali_program");
    const ret = evaluateFormFieldRule(multi, "program.hikingReturnHours", "denali_program");
    const approx = evaluateFormFieldRule(multi, "program.hikingHoursApprox", "denali_program");
    assert.equal(go.visible, false);
    assert.equal(ret.visible, false);
    assert.equal(approx.visible, true);

    const single = baseForm("mountain_day");
    assert.equal(
      evaluateFormFieldRule(single, "program.hikingGoHours", "denali_program").visible,
      true
    );
  });

  it("DN-SCHED-03b multi-day clears hidden hiking go/return values", () => {
    const form = baseForm("mountain_multi");
    form.programNature.hikingGoHours = 4;
    form.programNature.hikingReturnHours = 3;
    const next = applyDenaliStructuralInvariants(form);
    assert.equal(next.programNature.hikingGoHours, undefined);
    assert.equal(next.programNature.hikingReturnHours, undefined);
    assert.equal(next.programNature.hikingHoursApprox, undefined);
  });

  it("DN-SCHED-04 single-day clears hidden endDateTime (ED-DT-CLEAR-01)", () => {
    const form = baseForm("mountain_day");
    form.basicInfo.endDateTime = "2026-07-03T18:00:00.000Z";
    const next = applyDenaliStructuralInvariants(form);
    assert.equal(next.basicInfo.endDateTime, undefined);
    assert.equal(next.basicInfo.approximateReturnTime, "18:30");
  });

  it("DN-SCHED-04b multi-day keeps endDateTime and clears return time", () => {
    const form = baseForm("mountain_multi");
    const next = applyDenaliStructuralInvariants(form);
    assert.equal(next.basicInfo.endDateTime, "2026-07-03T18:00:00.000Z");
    assert.equal(next.basicInfo.approximateReturnTime, undefined);
  });
});
