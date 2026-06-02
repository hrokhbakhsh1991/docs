import assert from "node:assert/strict";
import test from "node:test";

import {
  presetDefaultsToDenaliFormPatch,
  presetDefaultsUsesLegacyRoots,
} from "./presetDefaultsToDenaliFormPatch";

test("presetDefaultsToDenaliFormPatch: keeps 6-tab Denali roots only", () => {
  const patch = presetDefaultsToDenaliFormPatch({
    basicInfo: { tourType: "mountain_day", title: "abcdefghijabcdefghij" },
    programNature: { themeIds: ["theme-1"], shortDescription: "کوه یک‌روزه" },
    transport: { transportMode: "organizer_vehicle" },
    pricingPayment: {
      requiresPayment: true,
      basePricePerPerson: 500_000,
      paymentMode: "offline_receipt",
    },
    participantRequirements: { minimumAge: 18 },
    policies: { policiesText: "لغو" },
    overview: { shortDescription: "legacy must drop" },
    discount: { percent: 10 },
    onlinePayment: true,
  });

  assert.equal(patch.basicInfo?.tourType, "mountain_day");
  assert.equal(patch.programNature?.shortDescription, "کوه یک‌روزه");
  assert.equal((patch as { overview?: unknown }).overview, undefined);
  assert.equal((patch as { discount?: unknown }).discount, undefined);
  assert.equal((patch as { onlinePayment?: unknown }).onlinePayment, undefined);
});

test("presetDefaultsToDenaliFormPatch: legacy overview maps to Denali sections", () => {
  const patch = presetDefaultsToDenaliFormPatch(
    {
      overview: {
        shortDescription: "از قالب legacy",
        mainTourThemeId: "theme-legacy",
      },
      policies: { cancellationPolicy: "لغو از legacy" },
    },
    { matchTourType: "mountain", matchMainTourThemeId: "theme-legacy" },
  );

  assert.equal(patch.programNature?.shortDescription, "از قالب legacy");
  assert.deepEqual(patch.programNature?.themeIds, ["theme-legacy"]);
  assert.equal(patch.basicInfo?.tourType, "mountain_day");
  assert.equal(patch.policies?.policiesText, "لغو از legacy");
});

test("presetDefaultsToDenaliFormPatch clears outdoor fields for event preset shape", () => {
  const patch = presetDefaultsToDenaliFormPatch({
    basicInfo: { tourType: "event_cinema", title: "abcdefghijabcdefghij" },
    programNature: {
      themeIds: ["theme-1"],
      shortDescription: "سینما",
      difficultyLevel: 1,
      hikingHoursApprox: 2,
    },
    transport: { transportMode: "none" },
    pricingPayment: {
      requiresPayment: false,
      basePricePerPerson: undefined,
      paymentMode: "offline_receipt",
    },
    participantRequirements: {},
    policies: {},
  });

  assert.equal(patch.programNature?.difficultyLevel, undefined);
  assert.equal(patch.programNature?.hikingHoursApprox, undefined);
});

test("presetDefaultsUsesLegacyRoots detects classic JSON", () => {
  assert.equal(presetDefaultsUsesLegacyRoots({ overview: {} }), true);
  assert.equal(presetDefaultsUsesLegacyRoots({ basicInfo: {} }), false);
});

test("presetDefaultsToDenaliFormPatch: legacy participation gear maps to gearItems", () => {
  const reqId = "11111111-1111-4111-8111-111111111111";
  const optId = "22222222-2222-4222-8222-222222222222";
  const patch = presetDefaultsToDenaliFormPatch({
    participation: {
      gearRequiredIds: [reqId],
      gearOptionalIds: [optId],
    },
  });

  assert.deepEqual(patch.participantRequirements?.gearItems, [
    { id: reqId, isRequired: true },
    { id: optId, isRequired: false },
  ]);
});

test("presetDefaultsToDenaliFormPatch: 6-tab shape merges legacy participation gear", () => {
  const gearId = "33333333-3333-4333-8333-333333333333";
  const patch = presetDefaultsToDenaliFormPatch({
    basicInfo: { tourType: "mountain_day" },
    participantRequirements: { minimumAge: 18 },
    participation: { gearRequiredIds: [gearId] },
  });

  assert.equal(patch.participantRequirements?.minimumAge, 18);
  assert.deepEqual(patch.participantRequirements?.gearItems, [{ id: gearId, isRequired: true }]);
});
