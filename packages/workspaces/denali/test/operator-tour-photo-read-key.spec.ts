import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDenaliOperatorTourPhotoReadKeyAllowed } from "../src/photos/tour-photo-object-key";

const TENANT = "00000000-0000-4000-8000-000000000003";

describe("isDenaliOperatorTourPhotoReadKeyAllowed", () => {
  it("DN-OP-PHOTO-01 allows wizard draft keys", () => {
    assert.equal(
      isDenaliOperatorTourPhotoReadKeyAllowed(
        TENANT,
        `${TENANT}/wizard-drafts/session/photos/p1`
      ),
      true
    );
  });

  it("DN-OP-PHOTO-02 allows persisted tour photo keys", () => {
    assert.equal(
      isDenaliOperatorTourPhotoReadKeyAllowed(
        TENANT,
        `${TENANT}/tours/tour-1/photos/p1`
      ),
      true
    );
  });

  it("DN-OP-PHOTO-03 rejects other tenant keys", () => {
    assert.equal(
      isDenaliOperatorTourPhotoReadKeyAllowed(
        TENANT,
        "other-tenant/tours/t1/photos/p1"
      ),
      false
    );
  });
});
