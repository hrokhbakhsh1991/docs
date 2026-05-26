import assert from "node:assert/strict";
import test from "node:test";

import { DenaliCanonicalTourTypeRequiredError } from "@repo/types/denali";

import {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

import {
  createInitialDenaliCanonicalModel,
  denaliCanonicalToForm,
  denaliFormToCanonical,
  isDenaliWizardTourTypeSelected,
  safeDenaliFormToCanonical,
} from "./denaliCanonicalFormAdapter";

test("safeDenaliFormToCanonical returns initial shell when tourType is missing", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(isDenaliWizardTourTypeSelected(form), false);

  const canonical = safeDenaliFormToCanonical(form);
  assert.equal(canonical.title, "");
  assert.equal(canonical.duration, "single");
  assert.doesNotThrow(() => createInitialDenaliCanonicalModel(form));
});

test("denaliFormToCanonical throws when tourType is missing (submit strict path)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.throws(() => denaliFormToCanonical(form), DenaliCanonicalTourTypeRequiredError);
});

test("safeDenaliFormToCanonical maps strictly after tourType is selected", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "Test tour title here";

  const safe = safeDenaliFormToCanonical(form);
  const strict = denaliFormToCanonical(form);
  assert.equal(safe.category, strict.category);
  assert.equal(safe.duration, strict.duration);
  assert.equal(safe.title, strict.title);
});

test("denaliCanonicalToForm maps customServiceLabels onto tripDetails.overview", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_reading";
  form.basicInfo.title = "Urban event with services";
  form.tripDetails.overview.customServiceLabels = ["Shuttle", "Guide"];

  const canonical = denaliFormToCanonical(form);
  assert.deepEqual(canonical.customServiceLabels, ["Shuttle", "Guide"]);

  const roundTrip = denaliCanonicalToForm(canonical, form);
  assert.deepEqual(roundTrip.tripDetails?.overview?.customServiceLabels, [
    "Shuttle",
    "Guide",
  ]);
});

test("denaliCanonicalToForm maps peakHeight and elevationGain onto tripDetails slices", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.tripDetails.overview.peakHeight = 3_900;
  form.tripDetails.metrics = { elevationGain: 1_100 };

  const canonical = denaliFormToCanonical(form);
  assert.equal(canonical.overview?.peakHeight, 3_900);
  assert.equal(canonical.metrics?.elevationGain, 1_100);

  const roundTrip = denaliCanonicalToForm(canonical, form);
  assert.equal(roundTrip.tripDetails?.overview?.peakHeight, 3_900);
  assert.equal(roundTrip.tripDetails?.metrics?.elevationGain, 1_100);
});

test("denaliCanonicalToForm maps nonAttendanceDetails onto tripDetails.overview", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_reading";
  form.basicInfo.title = "Urban event with non-attendance note";
  form.tripDetails.overview.nonAttendanceDetails = "  No-show policy  ";

  const canonical = denaliFormToCanonical(form);
  assert.equal(canonical.overview?.nonAttendanceDetails, "No-show policy");

  const roundTrip = denaliCanonicalToForm(canonical, form);
  assert.equal(roundTrip.tripDetails?.overview?.nonAttendanceDetails, "No-show policy");
});

test("denaliFormToCanonical strips UI-only photo fields before canonical schema", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.photosData.photos = [
    {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      url: "https://cdn.example.com/photo.jpg",
      filename: "photo.jpg",
      size: 2048,
      mimeType: "image/jpeg",
      uploadedAt: "2026-06-01T12:00:00.000Z",
      assetId: "staging-asset-id",
      uploadStatus: "uploaded",
    },
  ];

  const canonical = denaliFormToCanonical(form);
  const parsed = denaliCanonicalTourSchema.safeParse(canonical);

  assert.equal(
    parsed.success,
    true,
    parsed.success ? "" : JSON.stringify(parsed.error.issues),
  );
  assert.ok(canonical.photos?.[0]);
  assert.equal("assetId" in (canonical.photos?.[0] ?? {}), false);
  assert.equal("uploadStatus" in (canonical.photos?.[0] ?? {}), false);
});
