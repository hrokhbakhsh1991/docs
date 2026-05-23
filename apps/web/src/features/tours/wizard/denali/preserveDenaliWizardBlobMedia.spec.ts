import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  formHasClientBlobMedia,
  isClientBlobUrl,
  preserveDenaliWizardBlobMedia,
  stripBlobUrlsFromDenaliDraftPatch,
} from "./preserveDenaliWizardBlobMedia";

const blobPhoto = {
  id: "photo-1",
  url: "blob:http://localhost/abc",
  filename: "a.jpg",
  size: 100,
  mimeType: "image/jpeg",
  uploadedAt: new Date().toISOString(),
};

test("isClientBlobUrl detects blob scheme", () => {
  assert.equal(isClientBlobUrl("blob:http://x"), true);
  assert.equal(isClientBlobUrl("https://cdn/x.jpg"), false);
});

test("preserveDenaliWizardBlobMedia restores gallery blobs dropped by normalization", () => {
  const before = buildDenaliTourCreateDefaultValues();
  before.photosData = { photos: [blobPhoto] };

  const after = buildDenaliTourCreateDefaultValues();
  after.photosData = { photos: [] };

  const merged = preserveDenaliWizardBlobMedia(before, after);
  assert.equal(merged.photosData?.photos?.length, 1);
  assert.equal(merged.photosData?.photos?.[0]?.url, blobPhoto.url);
  assert.equal(merged.photosData?.photos?.[0], blobPhoto);
});

test("preserveDenaliWizardBlobMedia merges itinerary day blobs by day number", () => {
  const before = buildDenaliTourCreateDefaultValues();
  before.programNature.itinerary = [
    { day: 1, activities: "hike", photos: [blobPhoto] },
  ];

  const after = buildDenaliTourCreateDefaultValues();
  after.programNature.itinerary = [{ day: 1, activities: "hike", photos: [] }];

  const merged = preserveDenaliWizardBlobMedia(before, after);
  assert.equal(merged.programNature.itinerary?.[0]?.photos?.length, 1);
  assert.equal(merged.programNature.itinerary?.[0]?.photos?.[0]?.url, blobPhoto.url);
});

test("preserveDenaliWizardBlobMedia does not restore itinerary when after cleared it", () => {
  const before = buildDenaliTourCreateDefaultValues();
  before.programNature.itinerary = [
    { day: 1, activities: "hike", photos: [blobPhoto] },
  ];

  const after = buildDenaliTourCreateDefaultValues();
  after.programNature.itinerary = undefined;

  const merged = preserveDenaliWizardBlobMedia(before, after);
  assert.equal(merged.programNature.itinerary, undefined);
});

test("stripBlobUrlsFromDenaliDraftPatch omits blob gallery and day photos", () => {
  const patch: Partial<ReturnType<typeof buildDenaliTourCreateDefaultValues>> = {
    photosData: {
      photos: [blobPhoto, { ...blobPhoto, id: "p2", url: "https://cdn/x.jpg" }],
    },
    programNature: {
      themeIds: [],
      itinerary: [{ day: 1, activities: "a", photos: [blobPhoto] }],
    },
  };
  const stripped = stripBlobUrlsFromDenaliDraftPatch(patch);
  assert.equal(stripped.photosData?.photos?.length, 1);
  assert.equal(stripped.photosData?.photos?.[0]?.url, "https://cdn/x.jpg");
  assert.equal(stripped.programNature?.itinerary?.[0]?.photos, undefined);
});

test("formHasClientBlobMedia", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(formHasClientBlobMedia(form), false);
  form.photosData = { photos: [blobPhoto] };
  assert.equal(formHasClientBlobMedia(form), true);
});
