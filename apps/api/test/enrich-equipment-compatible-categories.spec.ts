import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enrichEquipmentCompatibleCategories } from "../src/settings/enrich-equipment-compatible-categories";

describe("enrich-equipment-compatible-categories", () => {
  it("API-12.1-01 adds compatibleCategories from category", () => {
    const enriched = enrichEquipmentCompatibleCategories({
      id: "gear-1",
      tenantId: "tenant",
      name: "Trekking Poles",
      category: "mountain",
      themeIds: [],
      sortOrder: 0,
      createdAt: "2026-06-11T00:00:00.000Z",
      updatedAt: "2026-06-11T00:00:00.000Z",
    });
    assert.deepEqual(enriched.compatibleCategories, ["mountain"]);
  });

  it("API-12.1-02 null category yields empty compatibleCategories", () => {
    const enriched = enrichEquipmentCompatibleCategories({
      id: "gear-2",
      tenantId: "tenant",
      name: "Universal Kit",
      category: null,
      themeIds: [],
      sortOrder: 0,
      createdAt: "2026-06-11T00:00:00.000Z",
      updatedAt: "2026-06-11T00:00:00.000Z",
    });
    assert.deepEqual(enriched.compatibleCategories, []);
  });
});
