import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toPlatformPlanDto } from "../src/platform/platform-plan.dto.ts";

describe("toPlatformPlanDto", () => {
  it("maps standard plan row", () => {
    const dto = toPlatformPlanDto({
      id: "standard",
      displayName: "Standard",
      priceMonthly: null,
      currency: "IRR",
      features: {},
      createdAt: new Date(),
    });
    assert.equal(dto.id, "standard");
    assert.equal(dto.displayName, "Standard");
  });
});
