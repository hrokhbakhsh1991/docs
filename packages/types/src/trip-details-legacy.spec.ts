import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLegacyOverviewTripStyleToTripStyles } from "./trip-details-legacy";

test("migrates singular legacy key into tripStyles and removes legacy key", () => {
  const td: Record<string, unknown> = {
    overview: { tripStyle: "adventure", tripStyles: ["photography"] },
  };
  normalizeLegacyOverviewTripStyleToTripStyles(td);
  const overview = td.overview as Record<string, unknown>;
  assert.equal("tripStyle" in overview, false);
  assert.deepEqual(
    [...((overview.tripStyles as string[]) ?? [])].sort(),
    ["adventure", "photography"],
  );
});

test("creates tripStyles from legacy only when array was absent", () => {
  const td: Record<string, unknown> = { overview: { tripStyle: "luxury" } };
  normalizeLegacyOverviewTripStyleToTripStyles(td);
  const overview = td.overview as Record<string, unknown>;
  assert.deepEqual(overview.tripStyles, ["luxury"]);
  assert.equal("tripStyle" in overview, false);
});

test("no-op when legacy key absent", () => {
  const td: Record<string, unknown> = { overview: { tripStyles: ["adventure"] } };
  normalizeLegacyOverviewTripStyleToTripStyles(td);
  assert.deepEqual((td.overview as { tripStyles: string[] }).tripStyles, ["adventure"]);
});
