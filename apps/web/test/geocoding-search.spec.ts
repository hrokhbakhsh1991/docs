/**
 * Geocoding search helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeGeocodingResults } from "../src/lib/geocoding/geocoding-search";
import { searchIranMountainLandmarks } from "@app-tour/iran-mountain-landmarks";
import { parseNominatimRows } from "../src/lib/geocoding/nominatim";
import {
  createEmptyDenaliGatheringPoint,
  parseDenaliGatheringPoints,
} from "@app-tour/workspace-denali/host/ui/logic/denali-location-types";

describe("geocoding-search.spec.ts", () => {
  it("WEB-GEOCODING-01 parses nominatim rows", () => {
    const rows = parseNominatimRows([
      { display_name: "Tehran", lat: "35.6892", lon: "51.3890" },
      { display_name: "bad", lat: "x", lon: "y" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.displayName, "Tehran");
    assert.equal(rows[0]?.latitude, 35.6892);
  });

  it("WEB-GEOCODING-02 merges local and remote results without duplicate coords", () => {
    const local = searchIranMountainLandmarks("دماوند", 2);
    const remote = [
      {
        displayName: "Remote",
        addressText: "Remote",
        latitude: local[0]?.latitude ?? 35.9519,
        longitude: local[0]?.longitude ?? 52.1094,
      },
    ];
    const merged = mergeGeocodingResults(local, remote, 6);
    assert.equal(merged.length, 1);
  });
});

describe("denali-gathering-points-parse.spec.ts", () => {
  it("WEB-GATHERING-01 parses legacy nested location rows", () => {
    assert.deepEqual(
      parseDenaliGatheringPoints([
        {
          title: "Parking",
          location: { addressText: "Tehran gate", latitude: 35.7, longitude: 51.4 },
        },
      ]),
      [{ name: "Parking", address: "Tehran gate", latitude: 35.7, longitude: 51.4 }]
    );
  });

  it("WEB-GATHERING-02 creates default empty primary station", () => {
    assert.deepEqual(createEmptyDenaliGatheringPoint(true), { name: "", isPrimary: true });
  });
});
