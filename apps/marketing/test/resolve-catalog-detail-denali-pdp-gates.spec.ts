import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MarketingCatalogCard } from "../src/catalog/catalog-types";
import { resolveCatalogDetailDenaliPdpGates } from "../src/catalog/resolve-catalog-detail-denali-pdp-gates";

const baseTour: MarketingCatalogCard = {
  id: "tour-1",
  title: "Trek",
  shortDescription: null,
  category: null,
  departureAt: null,
  endAt: null,
  priceAmount: null,
  priceCurrency: "IRR",
  coverImageUrl: null,
  totalCapacity: null,
};

describe("resolveCatalogDetailDenaliPdpGates", () => {
  it("PR-D-GATE-01 returns all false for non-Denali plugins", () => {
    const gates = resolveCatalogDetailDenaliPdpGates("urban", baseTour);

    assert.deepEqual(gates, {
      showHeroGallery: false,
      showReadiness: false,
      showLogistics: false,
      showGear: false,
      showGalleryNav: false,
      showRegisterPreview: false,
      showFaq: false,
    });
  });

  it("PR-D-GATE-02 enables hero + FAQ for Denali; data-gates readiness/logistics/gear", () => {
    const gates = resolveCatalogDetailDenaliPdpGates("denali", {
      ...baseTour,
      peakHeightMeters: 4200,
      gatheringPoint: { label: "Parking lot" },
      gearItems: ["Trekking poles"],
    });

    assert.equal(gates.showHeroGallery, true);
    assert.equal(gates.showFaq, true);
    assert.equal(gates.showReadiness, true);
    assert.equal(gates.showLogistics, true);
    assert.equal(gates.showGear, true);
  });

  it("PR-D-GATE-03 hides readiness/logistics/gear when tour has no outdoor data", () => {
    const gates = resolveCatalogDetailDenaliPdpGates("denali", baseTour);

    assert.equal(gates.showHeroGallery, true);
    assert.equal(gates.showFaq, true);
    assert.equal(gates.showReadiness, false);
    assert.equal(gates.showLogistics, false);
    assert.equal(gates.showGear, false);
  });
});
