/**
 * Destination autocomplete — scalable combobox for Create/Edit tour.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
import { filterSelectOptionsByQuery } from "../src/ui/logic/denali-searchable-select-logic";

const SRC_ROOT = join(import.meta.dirname, "../src");

describe("denali-destination-autocomplete.spec.ts", () => {
  it("DN-DEST-AUTO-01 search filters destinations by label", () => {
    const options = [
      { value: "dest-1", label: "Damavand (Alborz)" },
      { value: "dest-2", label: "Zagros Ridge" },
      { value: "dest-3", label: "Alamut Valley" },
    ];
    const filtered = filterSelectOptionsByQuery(options, "alam", {
      requireQuery: true,
    });
    assert.deepEqual(filtered, [{ value: "dest-3", label: "Alamut Valley" }]);
  });

  it("DN-DEST-AUTO-02 select stores canonical destination id on draft", () => {
    let draft = emptyDenaliTourWizardDraft();
    draft = setCanonicalStringValue(draft, "destinationId", "dest-42");
    assert.equal(getCanonicalStringValue(draft, "destinationId"), "dest-42");
  });

  it("DN-DEST-AUTO-03 hydrates selected label via pinned value when query empty", () => {
    const options = [
      { value: "dest-1", label: "Damavand" },
      { value: "dest-2", label: "Zagros" },
    ];
    const hydrated = filterSelectOptionsByQuery(options, "", {
      requireQuery: true,
      pinnedValue: "dest-1",
    });
    assert.deepEqual(hydrated, [{ value: "dest-1", label: "Damavand" }]);
  });

  it("DN-DEST-AUTO-04 no-results when search misses catalog", () => {
    const options = [{ value: "dest-1", label: "Damavand" }];
    const filtered = filterSelectOptionsByQuery(options, "zzz", {
      requireQuery: true,
    });
    assert.deepEqual(filtered, []);
  });

  it("DN-DEST-AUTO-05 long catalog does not return unbounded options", () => {
    const options = Array.from({ length: 500 }, (_, index) => ({
      value: `dest-${index}`,
      label: `Region ${index}`,
    }));
    const filtered = filterSelectOptionsByQuery(options, "region 1", {
      requireQuery: true,
      maxVisible: 50,
    });
    assert.ok(filtered.length <= 50);
  });

  it("DN-DEST-AUTO-06 create and edit share requireQueryToBrowse destination field", () => {
    const destinationField = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-destination-field.tsx"),
      "utf8"
    );
    const itineraryField = readFileSync(
      join(SRC_ROOT, "ui/components/denali-itinerary-segment-destination-field.tsx"),
      "utf8"
    );
    for (const src of [destinationField, itineraryField]) {
      assert.match(src, /requireQueryToBrowse/);
      assert.match(src, /searchableThreshold=\{0\}/);
      assert.match(src, /setCanonicalStringValue|buildItinerarySegmentDestinationSelection/);
    }
  });

  it("DN-DEST-AUTO-07 searchable select exposes keyboard handler", () => {
    const component = readFileSync(
      join(SRC_ROOT, "ui/components/denali-searchable-select.tsx"),
      "utf8"
    );
    assert.match(component, /ArrowDown/);
    assert.match(component, /ArrowUp/);
    assert.match(component, /Enter/);
    assert.match(component, /Escape/);
    assert.match(component, /aria-activedescendant/);
  });

  it("DN-DEST-AUTO-08 persian copy for search and no-results", () => {
    const fa = readFileSync(join(import.meta.dirname, "../messages/fa/wizard.json"), "utf8");
    assert.match(fa, /جستجوی مقصد…/);
    assert.match(fa, /مقصدی پیدا نشد/);
  });
});
