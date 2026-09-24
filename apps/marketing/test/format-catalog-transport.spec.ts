import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCatalogTransportMode,
  resolveCatalogTransportCostAmount,
} from "../src/catalog/format-catalog-transport";

const translate = (key: string) => key;

describe("catalog transport display", () => {
  it("shows the canonical mode and personal-car option on a PLP card", () => {
    assert.equal(
      formatCatalogTransportMode({ mode: "shared_cars", allowPersonalCar: true }, translate),
      "detail.transport.modes.sharedCars · detail.logistics.personalCar"
    );
  });

  it("uses the organized transport amount for bus tours", () => {
    assert.equal(
      resolveCatalogTransportCostAmount({
        mode: "bus",
        transportCostAmount: 500_000,
        dongAmount: 125_000,
      }),
      500_000
    );
  });

  it("uses the fuel-share amount for shared-car tours", () => {
    assert.equal(
      resolveCatalogTransportCostAmount({
        mode: "shared_cars",
        transportCostAmount: 500_000,
        dongAmount: 125_000,
      }),
      125_000
    );
  });

  it("does not show a transport charge for no-transport tours", () => {
    assert.equal(resolveCatalogTransportCostAmount({ mode: "none" }), null);
  });
});
