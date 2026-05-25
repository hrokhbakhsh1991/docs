import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  getDenaliWizardPublishReadinessIssues,
  isDenaliWizardReadyForOpenPublish,
} from "./denaliWizardPublishReadiness";

const CONCRETE_GATHERING = {
  id: "gather-1",
  title: "Gathering",
  time: "05:30",
  location: {
    addressText: "Tehran meeting point",
    latitude: 35.6892,
    longitude: 51.389,
  },
} as const;

function publishGateMountainForm(
  patch?: Partial<{
    basicInfo: Partial<DenaliCreateTourWizardForm["basicInfo"]>;
    tripDetails: DenaliCreateTourWizardForm["tripDetails"];
    programNature: Partial<DenaliCreateTourWizardForm["programNature"]>;
    transport: Partial<DenaliCreateTourWizardForm["transport"]>;
  }>,
): DenaliCreateTourWizardForm {
  const base = buildDenaliTourCreateTestValues();
  return normalizeDenaliWizardForm({
    ...base,
    basicInfo: {
      ...base.basicInfo,
      tourType: "mountain_day",
      startDateTime: "2026-07-01T06:00:00.000Z",
      startPoint: {
        addressText: "Start village",
        latitude: 35.7,
        longitude: 51.4,
      },
      ...patch?.basicInfo,
    },
    programNature: {
      ...base.programNature,
      itinerary: [
        {
          day: 1,
          locationText: "Day 1 camp",
          activities: "Ascent",
          photos: [],
        },
      ],
      ...patch?.programNature,
    },
    transport: {
      ...base.transport,
      transportMode: "organizer_vehicle",
      ...patch?.transport,
    },
    tripDetails: patch?.tripDetails ?? {
      logistics: { gatheringPoints: [CONCRETE_GATHERING] },
    },
  });
}

test("getDenaliWizardPublishReadinessIssues: draft publishStatus skips OPEN gate", () => {
  const form = publishGateMountainForm({ basicInfo: { publishStatus: "draft" } });
  assert.deepEqual(getDenaliWizardPublishReadinessIssues(form), []);
});

test("getDenaliWizardPublishReadinessIssues: active without geo fails publish gate", () => {
  const form = publishGateMountainForm({
    basicInfo: { publishStatus: "active" },
    tripDetails: { logistics: { gatheringPoints: [] } },
  });
  const issues = getDenaliWizardPublishReadinessIssues(form);
  assert.ok(issues.some((row) => row.code === "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES"));
});

test("isDenaliWizardReadyForOpenPublish: mountain form with geo and active passes", () => {
  const form = publishGateMountainForm({ basicInfo: { publishStatus: "active" } });
  assert.equal(isDenaliWizardReadyForOpenPublish(form), true);
});

test("getDenaliWizardPublishReadinessIssues: active with transport none skips primaryTransportMode gate", () => {
  const form = publishGateMountainForm({
    basicInfo: { publishStatus: "active" },
    transport: {
      transportMode: "none",
      transportNotes: undefined,
      dongAmount: undefined,
      allowPersonalCar: undefined,
    },
  });
  const issues = getDenaliWizardPublishReadinessIssues(form);
  assert.ok(
    !issues.some(
      (row) =>
        String(row.path ?? "").includes("transport") ||
        String(row.message).includes("حمل‌ونقل"),
    ),
    `unexpected transport issue: ${JSON.stringify(issues)}`,
  );
  assert.equal(isDenaliWizardReadyForOpenPublish(form), true);
});
