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
import {
  buildDenaliCreateTourPayloadProjection,
  buildDenaliSubmitPayloadProjection,
  FatalProjectionError,
  pruneDenaliWizardFormForSubmit,
  pruneDenaliWizardFormToRegistry,
} from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
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

function buildDirtyFormWithRegistryInvalidKeys(clean: DenaliCreateTourWizardForm): DenaliCreateTourWizardForm {
  const dirty = structuredClone(clean) as DenaliCreateTourWizardForm & Record<string, unknown>;
  dirty.__ghostMatrixSmuggle = { staleRuleMatrixCell: true };
  dirty.__unregisteredWizardRoot = "draft-merge leftover";
  dirty.tripDetails = {
    ...dirty.tripDetails,
    overview: {
      ...dirty.tripDetails.overview,
      __ghostOverviewKey: "must not reach projection",
    } as DenaliCreateTourWizardForm["tripDetails"]["overview"],
  };
  return dirty;
}

test("golden-file: prune + submit projection matches factory-clean output when form has registry-invalid keys", () => {
  const cleanForm = submitValidDenaliWizardDefaults();
  const dirtyForm = buildDirtyFormWithRegistryInvalidKeys(cleanForm);

  const factoryCleanPruned = pruneDenaliWizardFormToRegistry(cleanForm);
  const factoryReference = buildDenaliSubmitPayloadProjection(factoryCleanPruned);

  const dirtyPruned = pruneDenaliWizardFormToRegistry(dirtyForm);
  const pipelineProjection = buildDenaliSubmitPayloadProjection(dirtyPruned);

  assert.deepEqual(
    pipelineProjection,
    factoryReference,
    "prune + buildDenaliSubmitPayloadProjection must yield the same submit payload for dirty vs clean forms when ghosts are stripped",
  );
  assert.deepEqual(
    dirtyPruned,
    factoryCleanPruned,
    "pruneDenaliWizardFormToRegistry must normalize dirty draft-smuggled forms to the factory-clean registry shape",
  );
});

test("pruneDenaliWizardFormForSubmit throws FatalProjectionError on non-registry root keys", () => {
  const cleanForm = submitValidDenaliWizardDefaults();
  const dirtyForm = buildDirtyFormWithRegistryInvalidKeys(cleanForm);
  assert.throws(
    () => pruneDenaliWizardFormForSubmit(dirtyForm),
    (error: unknown) => error instanceof FatalProjectionError,
  );
});

