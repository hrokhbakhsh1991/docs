/**
 * Projection contract — safety net for registry fields that must survive
 * `buildDenaliCreateTourPayloadProjection` (especially manual `tripDetails.overview` merges).
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import {
  denaliCanonicalToForm,
  denaliFormToCanonical,
} from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { submitValidDenaliWizardDefaults } from "@/features/tours/testing/denaliSubmitTestHelpers";
import { buildDenaliCreateTourPayloadProjection } from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliLogistics.schema";

/** Expected value for the registry-only overview field under test. */
const EXPECTED_NON_ATTENDANCE_DETAILS =
  "Projection contract: non-attendance policy for absent participants";

/** Peak elevation (basic step) → wire `tripDetails.overview.maxAltitudeMeters`. */
const EXPECTED_PEAK_HEIGHT_M = 5_610;

/** Route elevation gain (program step) → wire `tripDetails.overview.elevationGainMeters`. */
const EXPECTED_ELEVATION_GAIN_M = 1_100;

/**
 * Full canonical fixture (mountain_day submit-valid baseline + overview registry fields).
 * Built from a known-good wizard form so required slices stay internally consistent.
 */
function buildFullCanonicalModel(): DenaliCanonicalTourModel {
  const form = submitValidDenaliWizardDefaults();
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      ...form.tripDetails.overview,
      customServiceLabels: ["Shuttle", "Breakfast"],
      nonAttendanceDetails: EXPECTED_NON_ATTENDANCE_DETAILS,
      peakHeight: EXPECTED_PEAK_HEIGHT_M,
    },
    metrics: {
      ...form.tripDetails.metrics,
      elevationGain: EXPECTED_ELEVATION_GAIN_M,
    },
  };
  return denaliFormToCanonical(form);
}

function projectionOverview(
  projection: ReturnType<typeof buildDenaliCreateTourPayloadProjection>,
): Record<string, unknown> | undefined {
  return (projection.tripDetails as { overview?: Record<string, unknown> } | undefined)
    ?.overview;
}

function formFromCanonical(canonical: DenaliCanonicalTourModel) {
  return denaliCanonicalToForm(canonical, buildDenaliTourCreateDefaultValues());
}

test("projection contract: tripDetails.overview.nonAttendanceDetails is merged into API payload", () => {
  const canonical = buildFullCanonicalModel();

  assert.equal(canonical.overview?.nonAttendanceDetails, EXPECTED_NON_ATTENDANCE_DETAILS);
  assert.deepEqual(canonical.customServiceLabels, ["Shuttle", "Breakfast"]);

  const projection = buildDenaliCreateTourPayloadProjection(formFromCanonical(canonical));
  const overview = projectionOverview(projection);

  assert.equal(
    overview?.nonAttendanceDetails,
    EXPECTED_NON_ATTENDANCE_DETAILS,
    "buildDenaliCreateTourPayloadProjection must merge canonical.overview.nonAttendanceDetails into tripDetails.overview",
  );
});

test("projection contract: tripDetails.overview.peakHeight maps to maxAltitudeMeters", () => {
  const canonical = buildFullCanonicalModel();
  assert.equal(canonical.overview?.peakHeight, EXPECTED_PEAK_HEIGHT_M);

  const projection = buildDenaliCreateTourPayloadProjection(formFromCanonical(canonical));
  const overview = projectionOverview(projection);

  assert.equal(
    overview?.maxAltitudeMeters,
    EXPECTED_PEAK_HEIGHT_M,
    "buildDenaliCreateTourPayloadProjection must merge overview.peakHeight into tripDetails.overview.maxAltitudeMeters",
  );
});

test("projection contract: tripDetails.metrics.elevationGain maps to elevationGainMeters", () => {
  const canonical = buildFullCanonicalModel();
  assert.equal(canonical.metrics?.elevationGain, EXPECTED_ELEVATION_GAIN_M);

  const projection = buildDenaliCreateTourPayloadProjection(formFromCanonical(canonical));
  const overview = projectionOverview(projection);

  assert.equal(
    overview?.elevationGainMeters,
    EXPECTED_ELEVATION_GAIN_M,
    "buildDenaliCreateTourPayloadProjection must merge metrics.elevationGain into tripDetails.overview.elevationGainMeters",
  );
});

test("projection contract: manual overview merge does not drop other overview fields from projection", () => {
  const canonical = buildFullCanonicalModel();
  const projection = buildDenaliCreateTourPayloadProjection(formFromCanonical(canonical));
  const overview = projectionOverview(projection);

  assert.ok(overview?.denaliTourKind, "baseline overview fields from buildProjectionFromCanonical must remain");
  assert.equal(overview?.nonAttendanceDetails, EXPECTED_NON_ATTENDANCE_DETAILS);
  assert.equal(overview?.maxAltitudeMeters, EXPECTED_PEAK_HEIGHT_M);
  assert.equal(overview?.elevationGainMeters, EXPECTED_ELEVATION_GAIN_M);
});
