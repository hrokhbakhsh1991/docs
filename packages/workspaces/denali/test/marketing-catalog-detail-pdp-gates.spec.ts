import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliCatalogDetailPdpGates } from "@app-tour/workspace-denali/marketing";

const baseTour = {
  id: "tour-1",
  title: "Trek",
};

describe("resolveDenaliCatalogDetailPdpGates", () => {
  it("PR-D-GATE-01 returns all false for non-Denali plugins", () => {
    const gates = resolveDenaliCatalogDetailPdpGates("urban", {
      tour: baseTour,
      hasOverflowGallery: true,
      hasRegisterPreview: true,
    });

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
    const gates = resolveDenaliCatalogDetailPdpGates("denali", {
      tour: {
        ...baseTour,
        peakHeightMeters: 4200,
        gatheringPoint: { label: "Parking lot" },
        gearItems: ["Trekking poles"],
      },
      hasOverflowGallery: false,
      hasRegisterPreview: false,
    });

    assert.equal(gates.showHeroGallery, true);
    assert.equal(gates.showFaq, true);
    assert.equal(gates.showReadiness, true);
    assert.equal(gates.showLogistics, true);
    assert.equal(gates.showGear, true);
  });

  it("PR-D-GATE-03 hides readiness/logistics/gear when tour has no outdoor data", () => {
    const gates = resolveDenaliCatalogDetailPdpGates("denali", {
      tour: baseTour,
      hasOverflowGallery: false,
      hasRegisterPreview: false,
    });

    assert.equal(gates.showHeroGallery, true);
    assert.equal(gates.showFaq, true);
    assert.equal(gates.showReadiness, false);
    assert.equal(gates.showLogistics, false);
    assert.equal(gates.showGear, false);
  });
});
