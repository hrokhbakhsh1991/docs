import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliCatalogTransportIntakeSurface } from "../src/catalog/denali-catalog-transport-intake";

describe("denali catalog transport intake", () => {
  it("DEN-TR-01 bus tour requires a lightweight non-personal-car acknowledgement", () => {
    const transport = { mode: "bus" as const, allowPersonalCar: true, transportCostAmount: 50000 };
    const state = denaliCatalogTransportIntakeSurface.initialState(transport);
    assert.equal(denaliCatalogTransportIntakeSurface.showPersonalCarOptIn(transport), true);
    assert.equal(
      denaliCatalogTransportIntakeSurface.showTransportFollowUp(transport, state),
      false
    );
    assert.equal(denaliCatalogTransportIntakeSurface.buildPayload(transport, state), undefined);
    assert.equal(denaliCatalogTransportIntakeSurface.isComplete(transport, state), false);
    assert.deepEqual(
      denaliCatalogTransportIntakeSurface.buildPayload(transport, {
        ...state,
        nonPersonalCarAcknowledged: true,
      }),
      { kind: "primary" }
    );
  });

  it("DEN-TR-01b organized transport without personal-car option still requires acknowledgement", () => {
    const transport = { mode: "minibus" as const, allowPersonalCar: false };
    const state = denaliCatalogTransportIntakeSurface.initialState(transport);
    assert.equal(denaliCatalogTransportIntakeSurface.showPersonalCarOptIn(transport), false);
    assert.equal(denaliCatalogTransportIntakeSurface.buildPayload(transport, state), undefined);
    assert.deepEqual(
      denaliCatalogTransportIntakeSurface.buildPayload(transport, {
        ...state,
        nonPersonalCarAcknowledged: true,
      }),
      { kind: "primary" }
    );
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

  it("DEN-TR-03 bus without dong maps no-car to acquaintance", () => {
    const transport = {
      mode: "bus" as const,
      allowPersonalCar: true,
      transportCostAmount: 150_000,
    };
    const state = {
      ...denaliCatalogTransportIntakeSurface.initialState(transport),
      optInPersonalCar: true,
      hasPersonalCar: false as const,
      paysDong: true as const,
      nonPersonalCarAcknowledged: true,
    };
    assert.equal(denaliCatalogTransportIntakeSurface.showPersonalCarOptIn(transport), true);
    assert.deepEqual(denaliCatalogTransportIntakeSurface.buildPayload(transport, state), {
      kind: "no_car_acquaintance",
    });
  });

  it("DEN-TR-04 shared_cars dong still builds no_car_dong", () => {
    const transport = { mode: "shared_cars" as const, dongAmount: 80_000 };
    const state = {
      ...denaliCatalogTransportIntakeSurface.initialState(transport),
      hasPersonalCar: false as const,
      paysDong: true as const,
      nonPersonalCarAcknowledged: true,
    };
    assert.deepEqual(denaliCatalogTransportIntakeSurface.buildPayload(transport, state), {
      kind: "no_car_dong",
    });
  });

  it("DEN-TR-05 requires explicit acknowledgement for non-personal transport", () => {
    const transport = { mode: "shared_cars" as const, dongAmount: 80_000 };
    const state = {
      ...denaliCatalogTransportIntakeSurface.initialState(transport),
      hasPersonalCar: false as const,
      paysDong: false as const,
    };
    assert.equal(denaliCatalogTransportIntakeSurface.buildPayload(transport, state), undefined);
    assert.equal(denaliCatalogTransportIntakeSurface.isComplete(transport, state), false);
    assert.deepEqual(
      denaliCatalogTransportIntakeSurface.buildPayload(transport, {
        ...state,
        nonPersonalCarAcknowledged: true,
      }),
      { kind: "no_car_acquaintance" }
    );
  });
});
