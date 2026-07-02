import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliCatalogTransportIntakeSurface } from "../src/catalog/denali-catalog-transport-intake";

describe("denali catalog transport intake", () => {
  it("DEN-TR-01 bus tour hides transport UI by default", () => {
    const transport = { mode: "bus" as const, allowPersonalCar: true, transportCostAmount: 50000 };
    const state = denaliCatalogTransportIntakeSurface.initialState(transport);
    assert.equal(denaliCatalogTransportIntakeSurface.showPersonalCarOptIn(transport), true);
    assert.equal(denaliCatalogTransportIntakeSurface.showTransportFollowUp(transport, state), false);
    assert.equal(denaliCatalogTransportIntakeSurface.buildPayload(transport, state), undefined);
  });

  it("DEN-TR-02 shared_cars always shows follow-up", () => {
    const transport = { mode: "shared_cars" as const, dongAmount: 40000 };
    const state = denaliCatalogTransportIntakeSurface.initialState(transport);
    assert.equal(denaliCatalogTransportIntakeSurface.showTransportFollowUp(transport, state), true);
    assert.equal(state.optInPersonalCar, true);
  });

  it("DEN-PRICE-01 primary bus adds transport cost", () => {
    const price = denaliCatalogTransportIntakeSurface.computePricePerPerson({
      basePrice: 2_500_000,
      transport: { mode: "bus", transportCostAmount: 150_000 },
      transportKind: "primary",
    });
    assert.equal(price, 2_650_000);
  });

  it("DEN-PRICE-02 no_car_dong adds dong amount", () => {
    const price = denaliCatalogTransportIntakeSurface.computePricePerPerson({
      basePrice: 2_500_000,
      transport: { mode: "shared_cars", dongAmount: 80_000 },
      transportKind: "no_car_dong",
    });
    assert.equal(price, 2_580_000);
  });
});
