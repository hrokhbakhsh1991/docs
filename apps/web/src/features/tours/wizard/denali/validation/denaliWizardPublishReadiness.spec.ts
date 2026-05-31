import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { buildDenaliSubmitIssueViews } from "../denaliWizardSubmitIssuePresentation";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import {
  getDenaliWizardPublishReadinessIssues,
  getDenaliWizardPublishReadinessIssuesForTargetStatus,
  isDenaliWizardReadyForOpenPublish,
} from "./denaliWizardPublishReadiness";
import { publishReadinessIssueToZodIssue } from "./denaliSubmitValidation";

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
      ...base.tripDetails,
      logistics: { gatheringPoints: [CONCRETE_GATHERING] },
      overview: { ...base.tripDetails.overview, customServiceLabels: [] },
    },
  });
}

test("getDenaliWizardPublishReadinessIssues: draft publishStatus skips OPEN gate", () => {
  const form = publishGateMountainForm({ basicInfo: { publishStatus: "draft" } });
  assert.deepEqual(getDenaliWizardPublishReadinessIssues(form), []);
});

test("getDenaliWizardPublishReadinessIssuesForTargetStatus: draft form still reports active gate issues", () => {
  const form = publishGateMountainForm({
    basicInfo: { publishStatus: "draft" },
    tripDetails: { logistics: { gatheringPoints: [] }, overview: { customServiceLabels: [] }, metrics: {} },
  });
  const issues = getDenaliWizardPublishReadinessIssuesForTargetStatus(form, "active");
  assert.ok(issues.some((row) => row.code === "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES"));
});

test("getDenaliWizardPublishReadinessIssues: active without geo fails publish gate", () => {
  const form = publishGateMountainForm({
    basicInfo: { publishStatus: "active" },
    tripDetails: { logistics: { gatheringPoints: [] }, overview: { customServiceLabels: [] }, metrics: {} },
  });
  const issues = getDenaliWizardPublishReadinessIssues(form);
  assert.ok(issues.some((row) => row.code === "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES"));
});

test("getDenaliWizardPublishReadinessIssues: active event tour skips hidden gathering geo gate", () => {
  const base = buildDenaliTourCreateTestValues();
  const form = normalizeDenaliWizardForm({
    ...base,
    basicInfo: {
      ...base.basicInfo,
      tourType: "event_reading",
      publishStatus: "active",
      startDateTime: "2026-07-01T06:00:00.000Z",
      startPoint: { addressText: "", latitude: null, longitude: null },
    },
    transport: {
      ...base.transport,
      transportMode: "none",
    },
    tripDetails: {
      logistics: { gatheringPoints: [] },
      overview: { customServiceLabels: [] },
      metrics: {},
    },
  });
  const issues = getDenaliWizardPublishReadinessIssues(form);
  assert.ok(
    !issues.some((row) => row.code === "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES"),
    JSON.stringify(issues),
  );
});

test("geo violations include RHF paths for review navigation", () => {
  const missingGathering = publishGateMountainForm({
    basicInfo: { publishStatus: "active" },
    tripDetails: { logistics: { gatheringPoints: [] }, overview: { customServiceLabels: [] }, metrics: {} },
  });
  const gatheringIssue = getDenaliWizardPublishReadinessIssues(missingGathering).find(
    (row) => row.code === "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
  );
  assert.equal(gatheringIssue?.path, "tripDetails.logistics.gatheringPoints");

  const missingStart = publishGateMountainForm({
    basicInfo: {
      publishStatus: "active",
      startPoint: { addressText: "", latitude: null, longitude: null },
    },
    tripDetails: {
      logistics: { gatheringPoints: [CONCRETE_GATHERING] },
      overview: { customServiceLabels: [] },
      metrics: {},
    },
  });
  const startIssue = getDenaliWizardPublishReadinessIssues(missingStart).find(
    (row) => row.code === "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
  );
  assert.equal(startIssue?.path, "basicInfo.startPoint");
});

test("gatheringPoints geo path resolves to denali_logistics in submit issue views", () => {
  const form = publishGateMountainForm({
    basicInfo: { publishStatus: "active" },
    tripDetails: { logistics: { gatheringPoints: [] }, overview: { customServiceLabels: [] }, metrics: {} },
  });
  const publishIssues = getDenaliWizardPublishReadinessIssues(form);
  const zodIssues = publishIssues.map(publishReadinessIssueToZodIssue);
  const t = ((key: string) => key) as Parameters<typeof buildDenaliSubmitIssueViews>[3];
  const views = buildDenaliSubmitIssueViews(zodIssues, form, denaliRuleSet, t);
  const gatheringView = views.find(
    (view) => view.formPath === "tripDetails.logistics.gatheringPoints",
  );
  assert.ok(gatheringView);
  assert.equal(gatheringView.stepId, "denali_logistics");
});

test("startPoint geo path resolves to denali_logistics in submit issue views", () => {
  const form = publishGateMountainForm({
    basicInfo: {
      publishStatus: "active",
      startPoint: { addressText: "", latitude: null, longitude: null },
    },
    tripDetails: {
      logistics: { gatheringPoints: [CONCRETE_GATHERING] },
      overview: { customServiceLabels: [] },
      metrics: {},
    },
  });
  const publishIssues = getDenaliWizardPublishReadinessIssues(form);
  const zodIssues = publishIssues.map(publishReadinessIssueToZodIssue);
  const t = ((key: string) => key) as Parameters<typeof buildDenaliSubmitIssueViews>[3];
  const views = buildDenaliSubmitIssueViews(zodIssues, form, denaliRuleSet, t);
  const startView = views.find((view) => view.formPath === "basicInfo.startPoint");
  assert.ok(startView);
  assert.equal(startView.stepId, "denali_logistics");
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
