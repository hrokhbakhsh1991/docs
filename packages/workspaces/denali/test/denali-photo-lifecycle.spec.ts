import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { denaliHydrateTourEditDraft } from "../src/clone/denali-tour-clone-hydration";
import {
  assertDenaliPhotoUploadsIdle,
  resetDenaliPhotoUploadTrackerForTests,
  trackDenaliPhotoUploadLifecycle,
} from "../src/ui/logic/denali-photo-upload-tracker";
import { sanitizeCompleteTourPhotosOnDraft } from "../src/wizard/denali-wizard-catalog-sanitize";

describe("denali-photo-lifecycle.spec.ts", () => {
  afterEach(() => {
    resetDenaliPhotoUploadTrackerForTests();
  });

  it("DN-PHOTO-LC-01 edit hydrate flattens legacy photosData.photos into draft photos[]", () => {
    const canonical = {
      title: "Gallery trek",
      category: "mountain_day",
      photosData: {
        photos: [
          { id: "p1", storageKey: "tenant/tours/t1/photos/p1", label: "One" },
          { id: "p2", url: "https://cdn.example.com/two.jpg", label: "Two" },
        ],
      },
    };
    const edit = denaliHydrateTourEditDraft(canonical);
    const photos = edit.data.photos as Array<{ id: string }>;
    assert.equal(photos.length, 2);
    assert.equal(photos[0]?.id, "p1");
    assert.equal(photos[1]?.id, "p2");
  });

  it("DN-PHOTO-LC-02 sanitizeCompleteTourPhotosOnDraft drops empty slots", () => {
    const draft = {
      data: {
        photos: [
          { id: "p1", storageKey: "tenant/wizard-drafts/s/photos/p1" },
          { id: "p2", label: "pending" },
          { id: "p3", url: "https://cdn.example.com/ok.jpg" },
        ],
      },
    };
    const sanitized = sanitizeCompleteTourPhotosOnDraft(draft);
    const photos = sanitized.data.photos as Array<{ id: string }>;
    assert.deepEqual(
      photos.map((photo) => photo.id),
      ["p1", "p3"]
    );
  });

  it("DN-PHOTO-LC-03 upload tracker blocks submit while uploads are active", () => {
    assert.equal(assertDenaliPhotoUploadsIdle(), null);
    const release = trackDenaliPhotoUploadLifecycle();
    assert.equal(assertDenaliPhotoUploadsIdle(), "PHOTO_UPLOAD_IN_PROGRESS");
    release();
    assert.equal(assertDenaliPhotoUploadsIdle(), null);
  });
});
