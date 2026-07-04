import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveMarketingCatalogFitnessLabel,
  resolveMarketingCatalogFitnessLevelLabel,
} from "../src/catalog/resolve-marketing-catalog-fitness-label";

const labels: Record<string, string> = {
  "list.filters.fitnessLevels.high": "توان بالا",
  "list.filters.fitnessLevels.medium": "توان متوسط",
  "detail.fitness": "توان بدنی: {level}",
};

function translate(key: string, values?: Record<string, string | number>): string {
  const template = labels[key] ?? key;
  if (values == null) {
    return template;
  }
  return template.replace("{level}", String(values.level ?? ""));
}

describe("resolve-marketing-catalog-fitness-label.spec.ts", () => {
  it("MKT-FIT-01 localizes fitness level slug", () => {
    assert.equal(resolveMarketingCatalogFitnessLevelLabel("high", translate), "توان بالا");
  });

  it("MKT-FIT-02 card stat includes Persian label and level", () => {
    assert.equal(
      resolveMarketingCatalogFitnessLabel("high", translate),
      "توان بدنی: توان بالا"
    );
  });
});
