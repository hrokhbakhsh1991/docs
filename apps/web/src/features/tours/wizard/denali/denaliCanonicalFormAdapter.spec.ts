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
