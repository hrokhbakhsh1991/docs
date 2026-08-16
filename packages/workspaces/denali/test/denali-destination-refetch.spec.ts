import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  shouldReloadDenaliDestinationCatalogOnFocus,
  patchDenaliDestinationCatalogCache,
  subscribeDenaliDestinationCatalogPatch,
} from "../src/ui/hooks/use-destination-catalog";
import type { DestinationResource } from "../src/ui/adapters/catalog-types";
import { countDenaliDestinationsOfferedForTourKind } from "../src/ui/logic/denali-destination-picker-filter";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("denali-destination-refetch.spec.ts (ED-DEST-REFETCH-01)", () => {
  it("DEN-DEST-REFETCH-01 reloads on focus when HTTP-degraded or offered list empty", () => {
    assert.equal(
      shouldReloadDenaliDestinationCatalogOnFocus({
        error: "LOCATIONS_HTTP_503",
        loading: false,
      }),
      true
    );
    assert.equal(
      shouldReloadDenaliDestinationCatalogOnFocus({
        error: null,
        loading: false,
        offeredCount: 0,
      }),
      true
    );
    assert.equal(
      shouldReloadDenaliDestinationCatalogOnFocus({
        error: null,
        loading: false,
        offeredCount: 3,
      }),
      false
    );
    assert.equal(
      shouldReloadDenaliDestinationCatalogOnFocus({
        error: null,
        loading: true,
        offeredCount: 0,
      }),
      false
    );
    assert.equal(
      shouldReloadDenaliDestinationCatalogOnFocus({
        error: null,
        loading: false,
      }),
      false
    );
  });

  it("DEN-DEST-REFETCH-01 nature peaks-only catalog counts as zero offered", () => {
    const offered = countDenaliDestinationsOfferedForTourKind(
      [{ locationType: "peak" }, { locationType: "peak" }, { locationType: "peak" }],
      "nature_multi"
    );
    assert.equal(offered, 0);
    assert.equal(
      countDenaliDestinationsOfferedForTourKind(
        [{ locationType: "peak" }, { locationType: "nature_trail" }],
        "nature_multi"
      ),
      1
    );
    assert.equal(
      countDenaliDestinationsOfferedForTourKind([{ locationType: "peak" }], "mountain_day"),
      1
    );
  });

  it("DEN-DEST-REFETCH-01 hook refetches on offered-empty, not only HTTP error", () => {
    const hook = readFileSync(join(SRC_ROOT, "ui/hooks/use-destination-catalog.ts"), "utf8");
    assert.match(hook, /shouldReloadDenaliDestinationCatalogOnFocus/);
    assert.match(hook, /countDenaliDestinationsOfferedForTourKind/);
    assert.match(hook, /visibilitychange/);
    assert.equal(/if \(state\.error === null\) \{\s*return;/.test(hook), false);
  });

  it("DEN-DEST-REFETCH-01 empty notice exposes retry and destination fields pass tourKind", () => {
    const notice = readFileSync(
      join(SRC_ROOT, "ui/components/denali-destination-offered-empty-notice.tsx"),
      "utf8"
    );
    assert.match(notice, /denali-destination-offered-empty-retry/);
    assert.match(notice, /onRetry/);
    assert.match(notice, /composites\.catalog\.retry/);
    assert.match(notice, /role="status"/);

    const destinationField = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-destination-field.tsx"),
      "utf8"
    );
    const itineraryField = readFileSync(
      join(SRC_ROOT, "ui/components/denali-itinerary-segment-destination-field.tsx"),
      "utf8"
    );
    for (const src of [destinationField, itineraryField]) {
      assert.match(src, /useDenaliDestinationCatalog\(\{\s*tourKind/);
      assert.match(src, /DenaliDestinationOfferedEmptyNotice/);
      assert.match(src, /onRetry=\{reload\}/);
    }
  });

  it("DEN-DEST-REFETCH-01b catalog patch broadcasts to every mounted listener", () => {
    const hook = readFileSync(join(SRC_ROOT, "ui/hooks/use-destination-catalog.ts"), "utf8");
    assert.match(hook, /subscribeDenaliDestinationCatalogPatch/);
    assert.doesNotMatch(hook, /let patchDestinationCatalogCache/);
    assert.doesNotMatch(hook, /patchDestinationCatalogCache = null/);

    const patched: DestinationResource = {
      id: "dest-asklim",
      regionId: "region-1",
      name: "آبشار اسکلیم",
      locationType: "nature_trail",
      altitudeM: null,
      typicalTrailDistanceKm: 4,
      isActive: true,
      sortOrder: 1,
    };
    const seen: string[] = [];
    const unsubscribeA = subscribeDenaliDestinationCatalogPatch((destination) => {
      seen.push(`a:${destination.id}:${destination.typicalTrailDistanceKm ?? ""}`);
    });
    const unsubscribeB = subscribeDenaliDestinationCatalogPatch((destination) => {
      seen.push(`b:${destination.id}:${destination.typicalTrailDistanceKm ?? ""}`);
    });
    patchDenaliDestinationCatalogCache(patched);
    assert.deepEqual(seen, ["a:dest-asklim:4", "b:dest-asklim:4"]);
    unsubscribeA();
    seen.length = 0;
    patchDenaliDestinationCatalogCache({ ...patched, typicalTrailDistanceKm: 6 });
    assert.deepEqual(seen, ["b:dest-asklim:6"]);
    unsubscribeB();
  });
});
