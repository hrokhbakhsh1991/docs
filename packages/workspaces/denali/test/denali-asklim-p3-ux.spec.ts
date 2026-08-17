import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDenaliLocationZoneLabelKey } from "../src/ui/logic/denali-location-zone-labels";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");
const FA_MESSAGES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../messages/fa/wizard.json"), "utf8")
) as {
  composites: {
    locationTypes: Record<string, string>;
    difficulty: { unset: string };
    pricing: { unpaidHint: string };
  };
};

describe("denali-location-zone-labels.spec.ts (ED-LOC-NATURE-01)", () => {
  it("DEN-LOC-NATURE-01 nature summit key is peak-free; mountain keeps summit", () => {
    assert.equal(
      resolveDenaliLocationZoneLabelKey("summitPoint", "nature_multi"),
      "composites.locationTypes.summitPointNature"
    );
    assert.equal(
      resolveDenaliLocationZoneLabelKey("summitPoint", "mountain_day"),
      "composites.locationTypes.summitPoint"
    );
    assert.equal(
      resolveDenaliLocationZoneLabelKey("campPoint", "nature_multi"),
      "composites.locationTypes.campPoint"
    );
    const natureCopy = FA_MESSAGES.composites.locationTypes.summitPointNature;
    assert.match(natureCopy, /نقطه اوج مسیر/);
    assert.equal(/قله/.test(natureCopy), false);
    assert.match(FA_MESSAGES.composites.locationTypes.summitPoint, /قله/);
  });

  it("DEN-LOC-NATURE-01 location zones field uses kind-aware heading and still renders summit", () => {
    const field = readFileSync(join(SRC_ROOT, "ui/fields/denali-location-zones-field.tsx"), "utf8");
    const types = readFileSync(join(SRC_ROOT, "ui/logic/denali-location-types.ts"), "utf8");
    assert.match(field, /resolveDenaliLocationZoneLabelKey/);
    assert.match(field, /DENALI_LOCATION_ZONE_PATHS/);
    assert.match(types, /summitPoint/);
  });
});

describe("denali-pay-diff-ux.spec.ts (ED-PAY-DIFF-UX-01)", () => {
  it("DEN-PAY-DIFF-UX-01 unpaid hint is status copy and paid stays opt-in", () => {
    const pricing = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-pricing-payment-field.tsx"),
      "utf8"
    );
    assert.match(pricing, /denali-pricing-unpaid-hint/);
    assert.match(pricing, /role="status"/);
    assert.match(pricing, /composites\.pricing\.unpaidHint/);
    assert.equal(/requiresPayment:\s*true/.test(pricing), false);
    assert.match(FA_MESSAGES.composites.pricing.unpaidHint, /تور پولی/);
  });

  it("DEN-PAY-DIFF-UX-01 difficulty unset copy is distinct from committed 1", () => {
    const difficulty = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-difficulty-level-field.tsx"),
      "utf8"
    );
    assert.match(difficulty, /DIFFICULTY_LEVEL_SLIDER_UNSET_POSITION/);
    assert.match(difficulty, /composites\.difficulty\.unset/);
    const unset = FA_MESSAGES.composites.difficulty.unset;
    assert.match(unset, /انتخاب نشده/);
    assert.equal(unset.includes("۱"), false);
    assert.equal(unset.includes("1"), false);
  });
});
