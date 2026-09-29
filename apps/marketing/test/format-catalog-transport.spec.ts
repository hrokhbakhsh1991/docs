import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  formatCatalogTransportMode,
  resolveCatalogDongAmount,
  resolveCatalogTransportCostAmount,
} from "../src/catalog/format-catalog-transport";

const translate = (key: string) => key;

describe("catalog transport display", () => {
  it("BUG-STG-082 keeps transport mode and dong amount visible on PLP/PDP", () => {
    const card = readFileSync(join(__dirname, "../src/catalog/catalog-tour-card.tsx"), "utf8");
    const logistics = readFileSync(
      join(__dirname, "../src/catalog/catalog-tour-detail-logistics.tsx"),
      "utf8"
    );

    assert.match(card, /formatCatalogTransportMode\(tour\.transport, t\)/);
    assert.match(card, /resolveCatalogTransportCostAmount\(tour\.transport\)/);
    assert.match(card, /tour\.transport\?\.mode === "shared_cars"/);
    assert.match(card, /t\("pricing\.ancillary\.transport"\)/);
    assert.match(card, /t\("pricing\.ancillary\.dong"\)/);
    assert.match(logistics, /resolveCatalogTransportCostAmount\(transport\)/);
    assert.match(logistics, /detail\.logistics\.dongAmount/);
  });

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

  it("does not leak dong as a second fee for organized transport", () => {
    assert.equal(
      resolveCatalogDongAmount({
        mode: "bus",
        transportCostAmount: 500_000,
        dongAmount: 125_000,
      }),
      null
    );
    assert.equal(
      resolveCatalogDongAmount({ mode: "shared_cars", dongAmount: 125_000 }),
      125_000
    );
  });

  it("does not show a transport charge for no-transport tours", () => {
    assert.equal(resolveCatalogTransportCostAmount({ mode: "none" }), null);
  });
});
