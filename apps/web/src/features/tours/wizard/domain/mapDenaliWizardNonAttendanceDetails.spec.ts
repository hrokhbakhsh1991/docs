import assert from "node:assert/strict";
import test from "node:test";

import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { submitValidDenaliWizardDefaults } from "@/features/tours/wizard/denali/validation/denaliSubmitTestHelpers";

import { buildDenaliCreateTourPayloadProjection } from "./buildDenaliCreateTourPayloadProjection";
import { mapDenaliWizardToCreateTourPayload } from "./mapDenaliWizardToCreateTourPayload";

test("buildDenaliCreateTourPayloadProjection merges nonAttendanceDetails into tripDetails.overview", () => {
  const form = submitValidDenaliWizardDefaults();
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      ...form.tripDetails.overview,
      nonAttendanceDetails: "No-show policy",
    },
  };

  const projection = buildDenaliCreateTourPayloadProjection(form);
  const overview = (projection.tripDetails as { overview?: Record<string, unknown> } | undefined)
    ?.overview;

  assert.equal(overview?.nonAttendanceDetails, "No-show policy");
  assert.equal(overview?.shortIntro, projection.description);
});

test("mapDenaliWizardToCreateTourPayload preserves existing overview fields when merging nonAttendanceDetails", () => {
  const form = submitValidDenaliWizardDefaults();
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      ...form.tripDetails.overview,
      nonAttendanceDetails: "Late arrival note",
    },
  };

  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = (dto.tripDetails as { overview?: Record<string, unknown> } | undefined)?.overview;

  assert.equal(overview?.nonAttendanceDetails, "Late arrival note");
  assert.ok(overview?.denaliTourKind);
});

test("transformTourToDenaliWizardValues hydrates nonAttendanceDetails from tripDetails.overview", () => {
  const source: TourCloneSourceDto = {
    title: "Clone with non-attendance",
    description: "desc",
    tourType: "event",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    details: {
      tripDetails: {
        overview: {
          denaliTourKind: "event_reading",
          shortIntro: "short",
          nonAttendanceDetails: "  Stored policy  ",
        },
        logistics: {
          departureDate: "2026-09-01",
          departureMeetingTime: "08:00",
        },
      },
    },
  };

  const form = transformTourToDenaliWizardValues(source, "create");
  assert.equal(form.tripDetails?.overview?.nonAttendanceDetails, "Stored policy");
});
