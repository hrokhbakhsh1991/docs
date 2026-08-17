import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  filterDenaliDestinationPickerOptions,
  isDenaliDestinationOfferedForTourKind,
  isDenaliNatureTourKind,
} from "../src/ui/logic/denali-destination-picker-filter";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("denali-destination-picker-filter.spec.ts", () => {
  const peak = { value: "peak-1", label: "توچال" };
  const trail = { value: "trail-1", label: "دربند" };
  const destinationById = new Map([
    [peak.value, { locationType: "peak" as const }],
    [trail.value, { locationType: "nature_trail" as const }],
  ]);

  it("DEN-DEST-NATURE-01 treats nature_day / nature_multi as nature", () => {
    assert.equal(isDenaliNatureTourKind("nature_day"), true);
    assert.equal(isDenaliNatureTourKind("nature_multi"), true);
    assert.equal(isDenaliNatureTourKind("mountain_day"), false);
    assert.equal(isDenaliNatureTourKind("desert_day"), false);
    assert.equal(isDenaliNatureTourKind(""), false);
  });

  it("DEN-DEST-NATURE-01 hides peaks on nature and keeps trails", () => {
    assert.equal(isDenaliDestinationOfferedForTourKind("peak", "nature_day"), false);
    assert.equal(isDenaliDestinationOfferedForTourKind("nature_trail", "nature_day"), true);
    assert.equal(isDenaliDestinationOfferedForTourKind("generic", "nature_day"), true);
    assert.equal(isDenaliDestinationOfferedForTourKind("peak", "mountain_day"), true);
  });

  it("DEN-DEST-NATURE-01b picker omits peaks unless already selected", () => {
    const nature = filterDenaliDestinationPickerOptions({
      options: [peak, trail],
      destinationById,
      tourKind: "nature_day",
    });
    assert.deepEqual(
      nature.map((option) => option.value),
      [trail.value]
    );

    const keptSelected = filterDenaliDestinationPickerOptions({
      options: [peak, trail],
      destinationById,
      tourKind: "nature_day",
      selectedDestinationId: peak.value,
    });
    assert.deepEqual(
      keptSelected.map((option) => option.value),
      [peak.value, trail.value]
    );

    const mountain = filterDenaliDestinationPickerOptions({
      options: [peak, trail],
      destinationById,
      tourKind: "mountain_day",
    });
    assert.equal(mountain.length, 2);
  });

  it("DEN-DEST-NATURE-01c destination pickers apply the nature peak filter", () => {
    const destinationField = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-destination-field.tsx"),
      "utf8"
    );
    const itineraryField = readFileSync(
      join(SRC_ROOT, "ui/components/denali-itinerary-segment-destination-field.tsx"),
      "utf8"
    );
    assert.match(destinationField, /filterDenaliDestinationPickerOptions/);
    assert.match(itineraryField, /filterDenaliDestinationPickerOptions/);
    assert.match(itineraryField, /tourKind/);
  });
});
