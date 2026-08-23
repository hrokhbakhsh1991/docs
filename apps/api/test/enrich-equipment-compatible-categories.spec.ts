import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { enrichSettingsModuleList } from "../src/settings/workspace-settings-enrichers.generated";

describe("enrich-equipment-compatible-categories", () => {
  it("API-12.1-01 adds compatibleCategories from category", () => {
    const enriched = enrichSettingsModuleList("denali", "equipment", [
      {
        id: "gear-1",
        tenantId: "tenant",
        name: "Trekking Poles",
        category: "mountain",
        themeIds: [],
        sortOrder: 0,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    ])[0]!;
    assert.deepEqual(enriched.compatibleCategories, ["mountain"]);
  });

  it("API-12.1-02 null category yields empty compatibleCategories", () => {
    const enriched = enrichSettingsModuleList("denali", "equipment", [
      {
        id: "gear-2",
        tenantId: "tenant",
        name: "Universal Kit",
        category: null,
        themeIds: [],
        sortOrder: 0,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    ])[0]!;
    assert.deepEqual(enriched.compatibleCategories, []);
  });

  it("keeps settings resource type comments workspace-generic", () => {
    const source = readFileSync(
      new URL("../src/settings/settings.types.ts", import.meta.url),
      "utf8"
    );
    assert.equal(source.includes("Denali closed icon registry key"), false);
    assert.equal(source.includes("Denali wizard"), false);
  });
});
