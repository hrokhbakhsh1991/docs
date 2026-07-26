import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readActiveDestinationIdsFromLocationsPayload,
  readActiveEquipmentIdsFromPayload,
  resolveActiveCatalogIdsFromResourcePayloads,
} from "../src/ui/adapters/read-active-catalog-ids-from-payload.ts";

describe("read-active-catalog-ids-from-payload", () => {
  it("readActiveEquipmentIdsFromPayload filters active equipment ids", () => {
    assert.deepEqual(
      readActiveEquipmentIdsFromPayload({
        items: [
          { id: " eq-1 ", isActive: true },
          { id: "eq-2", isActive: false },
          { id: 12, isActive: true },
        ],
      }),
      ["eq-1"]
    );
    assert.deepEqual(readActiveEquipmentIdsFromPayload(null), []);
    assert.deepEqual(readActiveEquipmentIdsFromPayload({}), []);
  });

  it("readActiveDestinationIdsFromLocationsPayload uses destinations only", () => {
    assert.deepEqual(
      readActiveDestinationIdsFromLocationsPayload({
        regions: [{ id: "r1", name: "R" }],
        destinations: [
          {
            id: "d1",
            regionId: "r1",
            name: "A",
            isActive: true,
            altitudeM: null,
            typicalTrailDistanceKm: null,
            sortOrder: 0,
          },
          {
            id: "d2",
            regionId: "r1",
            name: "B",
            isActive: false,
            altitudeM: null,
            typicalTrailDistanceKm: null,
            sortOrder: 1,
          },
        ],
        total: 2,
      }),
      ["d1"]
    );
  });

  it("resolveActiveCatalogIdsFromResourcePayloads omits missing payloads", () => {
    assert.deepEqual(resolveActiveCatalogIdsFromResourcePayloads({}), {});
    assert.deepEqual(
      resolveActiveCatalogIdsFromResourcePayloads({
        equipmentPayload: { items: [{ id: "e1", isActive: true }] },
      }),
      { activeEquipmentIds: ["e1"] }
    );
    assert.deepEqual(
      resolveActiveCatalogIdsFromResourcePayloads({
        locationsPayload: {
          destinations: [
            {
              id: "d1",
              regionId: "r1",
              name: "A",
              isActive: true,
            },
          ],
        },
      }),
      { activeDestinationIds: ["d1"] }
    );
  });
});
