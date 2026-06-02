import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isSensitiveTripDetailsPath,
  listSensitiveTripDetailsPathsFromPatch,
} from "./tour-trip-details-sensitive-paths";

describe("tour-trip-details-sensitive-paths", () => {
  test("detects pricing and urban paths", () => {
    assert.equal(isSensitiveTripDetailsPath("pricing.basePrice"), true);
    assert.equal(isSensitiveTripDetailsPath("urban.venue"), true);
    assert.equal(isSensitiveTripDetailsPath("overview.title"), false);
  });

  test("collects sensitive paths from nested patch", () => {
    const paths = listSensitiveTripDetailsPathsFromPatch({
      pricing: { basePrice: 100 },
      overview: { title: "Trip" },
    });
    assert.deepEqual(paths, ["pricing.basePrice"]);
  });
});
