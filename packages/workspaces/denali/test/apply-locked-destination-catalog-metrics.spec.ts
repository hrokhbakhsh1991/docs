import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyLockedDestinationCatalogMetricsToCanonical } from "../src/settings/apply-locked-destination-catalog-metrics";

const DAMAVAND = "00000000-0000-4000-8000-000000000705";

function dest(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    id: DAMAVAND,
    locationType: "peak",
    altitudeM: 5610,
    typicalTrailDistanceKm: null,
    ...partial,
  };
}

describe("apply-locked-destination-catalog-metrics.spec.ts", () => {
  it("DEN-PEAK-LOCK-01 overwrites crafted peakHeight when catalog altitude is locked", () => {
    const next = applyLockedDestinationCatalogMetricsToCanonical(
      {
        category: "mountain_multi",
        destinationId: DAMAVAND,
        tripDetails: { overview: { peakHeight: 9999 } },
      },
      [dest({})]
    );
    const overview = (next.tripDetails as { overview: { peakHeight: number } }).overview;
    assert.equal(overview.peakHeight, 5610);
  });

  it("DEN-PEAK-LOCK-01b leaves operator peakHeight when catalog does not lock", () => {
    const next = applyLockedDestinationCatalogMetricsToCanonical(
      {
        category: "mountain_day",
        destinationId: DAMAVAND,
        tripDetails: { overview: { peakHeight: 4100 } },
      },
      [dest({ altitudeM: null })]
    );
    const overview = (next.tripDetails as { overview: { peakHeight: number } }).overview;
    assert.equal(overview.peakHeight, 4100);
  });

  it("DEN-PEAK-LOCK-01c no-ops when destinations are omitted", () => {
    const data = {
      category: "mountain_day",
      destinationId: DAMAVAND,
      tripDetails: { overview: { peakHeight: 9999 } },
    };
    const next = applyLockedDestinationCatalogMetricsToCanonical(data);
    assert.equal(next, data);
  });

  it("DEN-PEAK-LOCK-01d does not write peakHeight on nature tours (field hidden)", () => {
    const next = applyLockedDestinationCatalogMetricsToCanonical(
      {
        category: "nature_day",
        destinationId: DAMAVAND,
        tripDetails: { overview: { peakHeight: 9999 } },
      },
      [dest({})]
    );
    const overview = (next.tripDetails as { overview: { peakHeight: number } }).overview;
    assert.equal(overview.peakHeight, 9999);
  });

  it("DEN-PEAK-LOCK-01e locks trailDistanceKm on nature trail destinations", () => {
    const trailId = "trail-1";
    const next = applyLockedDestinationCatalogMetricsToCanonical(
      {
        category: "nature_day",
        destinationId: trailId,
        tripDetails: { overview: { trailDistanceKm: 99 } },
      },
      [
        dest({
          id: trailId,
          locationType: "nature_trail",
          altitudeM: null,
          typicalTrailDistanceKm: 6.5,
        }),
      ]
    );
    const overview = (next.tripDetails as { overview: { trailDistanceKm: number } }).overview;
    assert.equal(overview.trailDistanceKm, 6.5);
  });
});
