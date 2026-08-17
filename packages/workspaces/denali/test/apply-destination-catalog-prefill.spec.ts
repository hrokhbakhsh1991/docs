import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
import {
  applyDestinationCatalogPrefill,
  seedEmptyVisibleDestinationCatalogMetrics,
} from "../src/settings/apply-destination-catalog-prefill";
import type { DestinationResource } from "../src/ui/adapters/catalog-types";
import {
  isDestinationCatalogMetricLocked,
  readLockedDestinationCatalogMetricValue,
} from "../src/settings/resolve-destination-catalog-metric-lock";
import { DENALI_DESTINATION_CATALOG_METRIC_BINDINGS } from "../src/settings/destination-catalog-metric-bindings";

function destination(partial: Partial<DestinationResource>): DestinationResource {
  return {
    id: "dest-1",
    tenantId: "tenant-1",
    regionId: "region-1",
    name: "توچال",
    locationType: "peak",
    altitudeM: null,
    typicalTrailDistanceKm: null,
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    ...partial,
  };
}

describe("applyDestinationCatalogPrefill", () => {
  it("prefills peakHeight from peak altitudeM on mountain tour", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    const next = applyDestinationCatalogPrefill(
      draft,
      destination({ locationType: "peak", altitudeM: 3962 })
    );
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.peakHeight"), "3962");
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.trailDistanceKm"), "");
  });

  it("prefills trailDistanceKm from nature_trail catalog distance on nature tour", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "nature_day");
    const next = applyDestinationCatalogPrefill(
      draft,
      destination({ locationType: "nature_trail", typicalTrailDistanceKm: 6.5 })
    );
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.trailDistanceKm"), "6.5");
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.peakHeight"), "");
  });

  it("clears peak metric when destination has no catalog altitude", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    const next = applyDestinationCatalogPrefill(
      draft,
      destination({ locationType: "peak", altitudeM: null })
    );
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.peakHeight"), "");
  });

  it("ignores generic destinations", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    const next = applyDestinationCatalogPrefill(
      draft,
      destination({ locationType: "generic", altitudeM: 1000, typicalTrailDistanceKm: 4 })
    );
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.peakHeight"), "");
    assert.equal(getCanonicalStringValue(next, "tripDetails.overview.trailDistanceKm"), "");
  });
});

describe("seedEmptyVisibleDestinationCatalogMetrics (ED-CAT-SEED-01)", () => {
  it("DEN-CAT-SEED-01 restores empty visible peak from locked catalog after nature hide", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "nature_day");
    draft = applyDestinationCatalogPrefill(
      draft,
      destination({ locationType: "peak", altitudeM: 3962 })
    );
    assert.equal(getCanonicalStringValue(draft, "tripDetails.overview.peakHeight"), "");

    draft = setCanonicalStringValue(draft, "category", "mountain_day");
    const seeded = seedEmptyVisibleDestinationCatalogMetrics(
      draft,
      destination({ locationType: "peak", altitudeM: 3962 })
    );
    assert.equal(getCanonicalStringValue(seeded, "tripDetails.overview.peakHeight"), "3962");
  });

  it("DEN-CAT-SEED-01b does not overwrite a non-empty operator peak", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalStringValue(draft, "tripDetails.overview.peakHeight", "4000");
    const seeded = seedEmptyVisibleDestinationCatalogMetrics(
      draft,
      destination({ locationType: "peak", altitudeM: 3962 })
    );
    assert.equal(getCanonicalStringValue(seeded, "tripDetails.overview.peakHeight"), "4000");
    assert.equal(seeded, draft);
  });

  it("DEN-CAT-SEED-01c does not seed peak while the field is hidden on nature", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "nature_day");
    const seeded = seedEmptyVisibleDestinationCatalogMetrics(
      draft,
      destination({ locationType: "peak", altitudeM: 3962 })
    );
    assert.equal(getCanonicalStringValue(seeded, "tripDetails.overview.peakHeight"), "");
    assert.equal(seeded, draft);
  });
});

describe("resolveDestinationCatalogMetricLock", () => {
  it("locks peakHeight when catalog altitude exists", () => {
    const dest = destination({ locationType: "peak", altitudeM: 3962 });
    const binding = DENALI_DESTINATION_CATALOG_METRIC_BINDINGS["tripDetails.overview.peakHeight"];
    assert.equal(isDestinationCatalogMetricLocked(dest, binding), true);
    assert.equal(readLockedDestinationCatalogMetricValue(dest, binding), "3962");
  });

  it("does not lock peakHeight when catalog altitude is empty", () => {
    const dest = destination({ locationType: "peak", altitudeM: null });
    const binding = DENALI_DESTINATION_CATALOG_METRIC_BINDINGS["tripDetails.overview.peakHeight"];
    assert.equal(isDestinationCatalogMetricLocked(dest, binding), false);
  });
});

describe("destination-catalog-metric field lock attributes (ED-PEAK-RO-01)", () => {
  it("locked metric input is readOnly as well as disabled", () => {
    const source = readFileSync(
      new URL("../src/ui/fields/denali-destination-catalog-metric-field.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /readOnly=\{locked\}/);
    assert.match(source, /disabled=\{locked \|\| destinationId\.length === 0\}/);
    assert.match(source, /seedEmptyVisibleDestinationCatalogMetrics/);
  });
});
