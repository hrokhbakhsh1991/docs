import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogMapLink } from "../src/catalog/build-catalog-map-link";
import { buildCatalogReadinessCells } from "../src/catalog/build-catalog-readiness-cells";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";

const tour: MarketingCatalogCard = {
  id: "tour-1",
  title: "Test",
  shortDescription: null,
  category: "mountain_single_day",
  departureAt: null,
  endAt: null,
  priceAmount: null,
  priceCurrency: "IRR",
  coverImageUrl: null,
  totalCapacity: null,
  hikingHoursApprox: 7,
  peakHeightMeters: 4200,
  trailDistanceKm: 10,
  minimumAge: 16,
};

describe("build-catalog-readiness-cells", () => {
  it("PR-D-RDY-01 shows mountain peak height not nature trail distance", () => {
    const cells = buildCatalogReadinessCells({
      tour,
      family: "mountain",
      labels: {
        hikingHours: "Hours",
        hikingGoHours: "Go",
        hikingReturnHours: "Return",
        peakHeight: "Peak",
        trailDistance: "Trail",
        elevationGain: "Gain",
        minimumAge: "Min age",
        maximumAge: "Max age",
      },
      formatHours: (h) => `${h}h`,
      formatMeters: (m) => `${m}m`,
      formatKilometers: (km) => `${km}km`,
      formatAge: (y) => `${y}y`,
    });

    assert.ok(cells.some((cell) => cell.id === "peak-height"));
    assert.ok(!cells.some((cell) => cell.id === "trail-distance"));
  });
});

describe("build-catalog-map-link", () => {
  it("PR-D-MAP-01 builds OSM link from coordinates", () => {
    const link = buildCatalogMapLink({
      label: "Terminal",
      latitude: 35.7,
      longitude: 51.4,
    });
    assert.match(link ?? "", /openstreetmap\.org/);
  });
});
