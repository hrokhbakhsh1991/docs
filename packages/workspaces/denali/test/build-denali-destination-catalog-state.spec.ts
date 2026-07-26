import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliDestinationCatalogStateFromPayload,
  resolveInitialDenaliDestinationCatalogState,
} from "../src/ui/adapters/build-denali-destination-catalog-state.ts";

describe("buildDenaliDestinationCatalogState", () => {
  it("maps active destinations to select options with region suffix", () => {
    const state = buildDenaliDestinationCatalogStateFromPayload({
      regions: [{ id: "r1", name: "Alborz", country: null, isActive: true, sortOrder: 0 }],
      destinations: [
        {
          id: "d1",
          regionId: "r1",
          name: "Damavand",
          locationType: "peak",
          altitudeM: 5600,
          typicalTrailDistanceKm: null,
          isActive: true,
          sortOrder: 0,
        },
        {
          id: "d2",
          regionId: "r1",
          name: "Hidden",
          locationType: null,
          altitudeM: null,
          typicalTrailDistanceKm: null,
          isActive: false,
          sortOrder: 1,
        },
      ],
      total: 2,
    });
    assert.equal(state.loading, false);
    assert.equal(state.error, null);
    assert.equal(state.options.length, 1);
    assert.equal(state.options[0]?.label, "Damavand (Alborz)");
    assert.equal(state.destinationById.get("d1")?.name, "Damavand");
  });

  it("resolveInitial returns loading when prefetch is null", () => {
    const state = resolveInitialDenaliDestinationCatalogState(null);
    assert.equal(state.loading, true);
    assert.equal(state.options.length, 0);
  });
});
