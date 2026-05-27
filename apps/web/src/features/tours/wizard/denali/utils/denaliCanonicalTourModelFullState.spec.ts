import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateBaseSchema";

function buildFullStateFormFixture() {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.endDateTime = "2026-06-01T18:00:00.000Z";
  form.basicInfo.capacityMin = 8;
  form.basicInfo.leaderUserIds = ["11111111-1111-1111-1111-111111111111"];
  form.basicInfo.requiresLocalGuide = true;
  form.basicInfo.localGuideName = "Guide A";
  form.basicInfo.requiresManualAdminApproval = true;
  form.basicInfo.socialMediaLink = "@denali";
  form.basicInfo.approximateReturnTime = "20:30";

  form.programNature.longDescription = "long desc";
  form.programNature.hikingGoHours = 4;
  form.programNature.hikingReturnHours = 4;
  form.programNature.itinerary = [{ day: 1, title: "day1", description: "desc1" }];

  form.transport.transportMode = "agency_bus";
  form.transport.transportNotes = "note";

  form.pricingPayment.includesTourInsurance = true;

  form.participantRequirements.maximumAge = 55;
  form.participantRequirements.nationalIdRequired = true;
  form.participantRequirements.minRequiredPeaks = 1;
  form.participantRequirements.fitnessPrerequisiteText = "fit";
  form.participantRequirements.gearItems = ["shoe"];

  form.policies.policiesText = "policy";
  form.policies.cancellationDeadlineHours = 48;
  form.policies.cancellationPenaltyPercentage = 20;

  form.photosData.photos = [{ url: "https://example.com/1.jpg", isCover: true, caption: "cover" }];
  form.tripDetails.logistics.gatheringPoints = [
    { name: "point1", meetingTime: "07:00", locationText: "loc1" },
  ];
  form.tripDetails.overview = {
    ...form.tripDetails.overview,
    nonAttendanceDetails: "nda",
    peakHeight: 5610,
  };
  form.tripDetails.metrics = {
    ...form.tripDetails.metrics,
    elevationGain: 1100,
  };
  return form;
}

const FULL_STATE_BASELINE: DenaliCanonicalTourModel = {
  category: "mountain",
  duration: "single",
  title: "صعود به قله دماوند - جبهه جنوبی",
  destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  startDateTime: "2026-06-01T08:00:00.000Z",
  endDateTime: "2026-06-01T18:00:00.000Z",
  capacityMax: 15,
  capacityMin: 8,
  gatheringPoints: [{ name: "point1", meetingTime: "07:00", locationText: "loc1" }],
  overview: {
    nonAttendanceDetails: "nda",
    peakHeight: 5610,
  },
  metrics: {
    elevationGain: 1100,
  },
  approximateReturnTime: "20:30",
  leaderUserIds: ["11111111-1111-1111-1111-111111111111"],
  requiresLocalGuide: true,
  localGuideName: "Guide A",
  requiresManualAdminApproval: true,
  publishStatus: "draft",
  socialMediaLink: "@denali",
  program: {
    themeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
    shortDescription: "یک برنامه جذاب برای صعود به بام ایران.",
    longDescription: "long desc",
    difficultyLevel: 5,
    hikingHoursApprox: 8,
    hikingGoHours: 4,
    hikingReturnHours: 4,
    itinerary: [{ day: 1 }],
  },
  transport: {
    mode: "none",
    transportNotes: "note",
  },
  pricing: {
    requiresPayment: true,
    basePricePerPerson: 500000,
    paymentMode: "offline_receipt",
    includesTourInsurance: true,
  },
  participants: {
    minimumAge: 18,
    maximumAge: 55,
    fitnessLevel: "medium",
    nationalIdRequired: true,
    sportsInsuranceRequired: true,
    minRequiredPeaks: 1,
    fitnessPrerequisiteText: "fit",
    gearItems: ["shoe"],
  },
  policies: {
    policiesText: "policy",
    cancellationDeadlineHours: 48,
    cancellationPenaltyPercentage: 20,
  },
};

test("full-state canonical baseline remains stable for DenaliCanonicalTourModel", () => {
  const canonical = denaliFormToCanonical(buildFullStateFormFixture());
  const stableCanonical = JSON.parse(JSON.stringify(canonical));
  assert.deepEqual(stableCanonical, FULL_STATE_BASELINE);
});
