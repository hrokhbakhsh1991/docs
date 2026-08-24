import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeWorkspaceFieldRegistryWithItineraryFragments } from "@app-tour/workspace-sdk";
import { resolveWorkspaceItineraryFieldRegistryFragment } from "../../../../apps/web/src/bootstrap/workspace-itinerary-field-module-bindings.generated";
import { resolveWorkspaceItineraryWizardCompositeBinding } from "../../../../apps/web/src/bootstrap/workspace-itinerary-wizard-composite-bindings.generated";

import {
  denaliItineraryFieldRegistryFragment,
  DENALI_ITINERARY_CANONICAL_PATH,
} from "../src/field-registry/denali-itinerary-field-module";
import { denaliItineraryWizardCompositeBinding } from "../src/composites/denali-itinerary-composite-binding";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-itinerary-field-parity (CW7-10)", () => {
  it("manifest fieldModule fragment contains itinerary composite anchor only", () => {
    assert.equal(denaliItineraryFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliItineraryFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_ITINERARY_CANONICAL_PATH
    );
    assert.equal(denaliItineraryFieldRegistryFragment.fields[0]?.id, "denali.itinerary");
  });

  it("fragment matches full registry itinerary row (Denali parity golden)", () => {
    const fullRegistry = buildDenaliWorkspaceFieldRegistry();
    const itineraryFromFull = fullRegistry.fields.find(
      (field) => field.canonicalPath === DENALI_ITINERARY_CANONICAL_PATH
    );
    assert.ok(itineraryFromFull);
    assert.deepEqual(denaliItineraryFieldRegistryFragment.fields[0], itineraryFromFull);
  });

  it("codegen binding resolves denali fragment; starter isolated", () => {
    const denaliFragment = resolveWorkspaceItineraryFieldRegistryFragment("denali");
    assert.ok(denaliFragment);
    assert.equal(denaliFragment?.fields.length, 1);
    assert.equal(resolveWorkspaceItineraryFieldRegistryFragment("starter"), undefined);
    assert.equal(resolveWorkspaceItineraryFieldRegistryFragment("urban"), undefined);
    assert.equal(resolveWorkspaceItineraryFieldRegistryFragment("guest-club"), undefined);
  });

  it("wizard composite binding resolves denali metadata", () => {
    const binding = resolveWorkspaceItineraryWizardCompositeBinding("denali");
    assert.deepEqual(binding, denaliItineraryWizardCompositeBinding);
    assert.equal(binding?.compositeId, "denali.itinerary");
    assert.equal(binding?.anchorCanonicalPath, DENALI_ITINERARY_CANONICAL_PATH);
    assert.equal(resolveWorkspaceItineraryWizardCompositeBinding("starter"), undefined);
  });

  it("merge seam replaces itinerary row without duplicating ids", () => {
    const base = buildDenaliWorkspaceFieldRegistry();
    const merged = mergeWorkspaceFieldRegistryWithItineraryFragments(
      base,
      denaliItineraryFieldRegistryFragment
    );
    assert.equal(merged.fields.length, base.fields.length);
    const itineraryMerged = merged.fields.find(
      (field) => field.canonicalPath === DENALI_ITINERARY_CANONICAL_PATH
    );
    assert.ok(itineraryMerged);
    assert.deepEqual(itineraryMerged, denaliItineraryFieldRegistryFragment.fields[0]);
  });
});
