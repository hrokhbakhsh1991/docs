import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogListCardSummary,
  computeCatalogTourDurationDays,
} from "../src/catalog/build-catalog-list-card-summary";

const labels: Record<string, string> = {
  "list.card.summary.singleDay": "تک‌روزه",
  "list.card.summary.multiDay": "{days} روز",
  "list.card.summary.difficulty": "سختی {level} از {max}",
  "list.card.summary.capacity": "حداکثر {count} نفر",
  "list.filters.fitnessLevels.high": "توان بالا",
};

function translate(key: string, values?: Record<string, string | number>): string {
  let text = labels[key] ?? key;
  if (values == null) {
    return text;
  }
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

describe("build-catalog-list-card-summary.spec.ts", () => {
  it("MKT-SUM-01 computes multi-day span", async () => {
    assert.equal(
      computeCatalogTourDurationDays(
        "2026-07-01T08:00:00.000Z",
        "2026-07-03T18:00:00.000Z"
      ),
      3
    );
  });

  it("MKT-SUM-02 builds scannable denali summary line", async () => {
    const line = await buildCatalogListCardSummary(
      {
        id: "1",
        title: "North Ridge",
        category: "mountain_multi",
        departureAt: "2026-07-01T08:00:00.000Z",
        endAt: "2026-07-03T18:00:00.000Z",
        difficultyLevel: 6,
        fitnessLevel: "high",
        totalCapacity: 12,
        shortDescription: "Alpine day hike internal copy",
      },
      translate,
      { pluginId: "denali" }
    );
    assert.match(line ?? "", /روز/);
    assert.match(line ?? "", /سختی 6 از 10/);
    assert.match(line ?? "", /توان بالا/);
    assert.match(line ?? "", /حداکثر 12 نفر/);
    assert.doesNotMatch(line ?? "", /Alpine/);
  });

  it("MKT-SUM-03 urban plugin keeps null summary for legacy description path", async () => {
    assert.equal(
      await buildCatalogListCardSummary({ id: "1", title: "Gig" }, translate, {
        pluginId: "urban",
      }),
      null
    );
  });
});
