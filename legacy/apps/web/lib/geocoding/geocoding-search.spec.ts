import assert from "node:assert/strict";
import test from "node:test";

import { mergeGeocodingResults } from "./geocoding-search";
import { searchIranMountainLandmarks } from "./iran-mountain-landmarks";
import type { GeocodingSearchResult } from "./nominatim";

test("mergeGeocodingResults prepends local rows and dedupes by coordinates", () => {
  const local = searchIranMountainLandmarks("دماوند", 2);
  const remote: GeocodingSearchResult[] = [
    {
      displayName: "دماوند - بارگاه سوم",
      addressText: "duplicate",
      latitude: 35.9519,
      longitude: 52.1094,
    },
    {
      displayName: "Tehran",
      addressText: "Tehran",
      latitude: 35.6892,
      longitude: 51.389,
    },
  ];
  const merged = mergeGeocodingResults(local, remote, 6);
  assert.equal(merged.length, 2);
  assert.match(merged[0]?.displayName ?? "", /دماوند/);
  assert.equal(merged[1]?.displayName, "Tehran");
});
