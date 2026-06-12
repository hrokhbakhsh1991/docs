import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDenaliTourPatchIntent,
  DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
  DENALI_TOUR_PUBLISH_DRAFT_STATUS,
} from "../src/tours/denali-tour-patch-intent";
import { denaliTourPatchTouchesPublishFields } from "../src/tours/tour-write-hooks";

describe("denali-tour-patch-intent.spec.ts — Phase 12.4c", () => {
  it("DEN-12.4c-01 save intent strips publishStatus from PATCH data", () => {
    const payload = applyDenaliTourPatchIntent(
      {
        rowVersion: 3,
        schemaVersion: 1,
        roots: ["basics", "publishStatus"],
        data: {
          title: "Alpine day",
          publishStatus: "draft",
          basicInfo: { publishStatus: "draft", title: "Alpine day" },
        },
      },
      "save"
    );

    assert.equal("publishStatus" in payload.data, false);
    assert.equal(
      denaliTourPatchTouchesPublishFields({
        roots: payload.roots,
        data: payload.data as Record<string, unknown>,
      }),
      false
    );
    assert.equal(payload.roots.includes("publishStatus"), false);
  });

  it("DEN-12.4c-02 publish intent sets publishStatus active", () => {
    const payload = applyDenaliTourPatchIntent(
      {
        rowVersion: 1,
        schemaVersion: 1,
        roots: ["basics"],
        data: { title: "Ready tour", publishStatus: "draft" },
      },
      "publish"
    );

    assert.equal(payload.data.publishStatus, DENALI_TOUR_PUBLISH_ACTIVE_STATUS);
    assert.equal(
      denaliTourPatchTouchesPublishFields({
        roots: payload.roots,
        data: payload.data as Record<string, unknown>,
      }),
      true
    );
  });

  it("DEN-12.4c-03 unpublish intent sets publishStatus draft", () => {
    const payload = applyDenaliTourPatchIntent(
      {
        rowVersion: 1,
        schemaVersion: 1,
        roots: ["basics"],
        data: { title: "Live tour", publishStatus: "active" },
      },
      "unpublish"
    );

    assert.equal(payload.data.publishStatus, DENALI_TOUR_PUBLISH_DRAFT_STATUS);
    assert.equal(
      denaliTourPatchTouchesPublishFields({
        roots: payload.roots,
        data: payload.data as Record<string, unknown>,
      }),
      true
    );
  });
});
