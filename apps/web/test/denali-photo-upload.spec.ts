/**
 * Denali wizard photo upload — client validation + draft photo parsing
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_PHOTO_ALLOWED_CONTENT_TYPES,
  validateDenaliPhotoFile,
} from "../src/wizard/denali/denali-photo-upload-client";
import { parseDenaliTourPhotos } from "../src/wizard/denali/denali-photo-types";

describe("denali-photo-upload.spec.ts", () => {
  it("WEB-6.7-PHOTO-01 parses storageKey on draft photos", () => {
    const photos = parseDenaliTourPhotos([
      {
        id: "11111111-1111-4111-8111-111111111111",
        label: "Summit",
        storageKey: "tenant/wizard-drafts/session/photos/id",
        contentType: "image/jpeg",
      },
    ]);
    assert.equal(photos.length, 1);
    assert.equal(photos[0]?.storageKey, "tenant/wizard-drafts/session/photos/id");
    assert.equal(photos[0]?.contentType, "image/jpeg");
  });

  it("WEB-6.7-PHOTO-02 validates allowed image types and size", () => {
    for (const type of DENALI_PHOTO_ALLOWED_CONTENT_TYPES) {
      assert.equal(
        validateDenaliPhotoFile({ type, size: 1024 } as File),
        null
      );
    }
    assert.equal(
      validateDenaliPhotoFile({ type: "application/pdf", size: 1024 } as File),
      "PHOTO_INVALID_TYPE"
    );
    assert.equal(
      validateDenaliPhotoFile({ type: "image/jpeg", size: 6 * 1024 * 1024 } as File),
      "PHOTO_FILE_TOO_LARGE"
    );
  });
});
