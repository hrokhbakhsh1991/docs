import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adjustShadowParityForIntentionalMismatches,
  createShadowParityIntentionalMismatchAdjuster,
  FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES,
} from "./shadow-parity-intentional-mismatch";

describe("shadow parity intentional mismatch registry", () => {
  it("starts with zero accepted mismatch suppressions", () => {
    assert.deepEqual(FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES, []);
  });

  it("leaves parity unchanged when no intentional mismatches are registered", () => {
    const report = {
      matches: false,
      mismatchCount: 1,
      fieldReports: [
        {
          fieldId: "title",
          mismatch: "FIELD_MISSING",
        },
      ],
    };

    assert.deepEqual(
      adjustShadowParityForIntentionalMismatches({
        workspaceType: "denali",
        eventType: "TourCreated",
        surface: "telegram",
        report,
      }),
      report,
    );
  });

  it("subtracts only explicitly registered intentional mismatches", () => {
    const adjust = createShadowParityIntentionalMismatchAdjuster([
      {
        workspaceType: "denali",
        eventType: "TourCreated",
        surface: "telegram",
        fieldId: "title",
        reason: "documented delta",
      },
    ]);

    const adjusted = adjust({
      workspaceType: "denali",
      eventType: "TourCreated",
      surface: "telegram",
      report: {
        matches: false,
        mismatchCount: 2,
        fieldReports: [
          { fieldId: "title", mismatch: "FIELD_MISSING" },
          { fieldId: "meetingPoint", mismatch: "FIELD_EXTRA" },
        ],
      },
    });

    assert.equal(adjusted.mismatchCount, 1);
    assert.equal(adjusted.matches, false);
    assert.equal(adjusted.fieldReports[0]?.mismatch, null);
    assert.equal(adjusted.fieldReports[1]?.mismatch, "FIELD_EXTRA");
  });

  it("does not suppress the same field outside its registered coordinate", () => {
    const adjust = createShadowParityIntentionalMismatchAdjuster([
      {
        workspaceType: "denali",
        eventType: "TourCreated",
        surface: "telegram",
        fieldId: "title",
        reason: "documented delta",
      },
    ]);

    const report = {
      matches: false,
      mismatchCount: 1,
      fieldReports: [{ fieldId: "title", mismatch: "FIELD_MISSING" }],
    };

    assert.deepEqual(
      adjust({
        workspaceType: "starter",
        eventType: "TourCreated",
        surface: "telegram",
        report,
      }),
      report,
    );
  });
});
