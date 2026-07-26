import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliFlatEditTourLoadSuccess,
  denaliFlatEditHydratorUnavailableResult,
  finalizeDenaliFlatEditTourLoad,
} from "../src/ui/chrome/build-denali-flat-edit-tour-load-result.ts";
import { emptyDenaliTourWizardDraft } from "../src/draft/denali-tour-wizard-draft.ts";

describe("denali flat-edit tour load result builders", () => {
  it("returns hydrator-unavailable failure", () => {
    assert.deepEqual(denaliFlatEditHydratorUnavailableResult(), {
      ok: false,
      kind: "error",
      code: "TOUR_EDIT_HYDRATOR_UNAVAILABLE",
    });
  });

  it("builds success payload", () => {
    const baseline = emptyDenaliTourWizardDraft();
    const detail = {
      projection: {
        title: "T",
        uiStatus: "draft",
        priceAmount: null,
        priceCurrency: null,
        departureAt: null,
        acceptedSeats: 0,
        capacity: null,
      },
    };
    const result = buildDenaliFlatEditTourLoadSuccess({
      detail,
      baseline,
      rowVersion: 3,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.rowVersion, 3);
      assert.equal(result.detail.projection.title, "T");
      assert.equal(result.baseline, baseline);
    }
  });

  it("finalizeDenaliFlatEditTourLoad maps null baseline to unavailable", () => {
    const result = finalizeDenaliFlatEditTourLoad({
      tourDetail: {
        rowVersion: 1,
        projection: {
          title: "T",
          uiStatus: "draft",
          priceAmount: null,
          priceCurrency: null,
          departureAt: null,
          acceptedCount: 0,
          totalCapacity: null,
        },
      },
      baseline: null,
    });
    assert.deepEqual(result, denaliFlatEditHydratorUnavailableResult());
  });

  it("finalizeDenaliFlatEditTourLoad maps seats fields and returns success", () => {
    const baseline = emptyDenaliTourWizardDraft();
    const result = finalizeDenaliFlatEditTourLoad({
      tourDetail: {
        rowVersion: 7,
        projection: {
          title: "Alpine",
          uiStatus: "published",
          priceAmount: 10,
          priceCurrency: "USD",
          departureAt: "2026-01-01T00:00:00.000Z",
          acceptedCount: 2,
          totalCapacity: 8,
        },
      },
      baseline,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.rowVersion, 7);
      assert.equal(result.detail.projection.acceptedSeats, 2);
      assert.equal(result.detail.projection.capacity, 8);
      assert.equal(result.baseline, baseline);
    }
  });
});
