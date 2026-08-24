/**
 * CW7-13 — capability composition matrix with synthetic manifests.
 * Proves: no leakage, disabling removes bindings, deterministic generation, no Denali fallback.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { expandAuthorManifest, loadProfileCatalog } from "../codegen/workspace-registry/domains/profile-expansion.mjs";
import { generateWorkspaceCapabilityValidationBindings } from "../codegen/workspace-registry/domains/validation-pipeline.mjs";
import { generateWorkspaceEquipmentCapabilities } from "../codegen/workspace-registry/domains/equipment.mjs";
import { generateWorkspaceTransportCapabilities } from "../codegen/workspace-registry/domains/transport.mjs";
import { generateWorkspacePricingCapabilities } from "../codegen/workspace-registry/domains/pricing.mjs";
import { generateWorkspaceDifficultyFitnessCapabilities } from "../codegen/workspace-registry/domains/difficulty-fitness.mjs";
import { generateWorkspaceItineraryCapabilities } from "../codegen/workspace-registry/domains/itinerary.mjs";
import { discoverManifests } from "../generate-workspace-registry.mjs";

/** @param {string} id @param {Record<string, unknown>} blocks */
function baseSynthetic(id, blocks = {}) {
  return {
    id,
    version: 1,
    package: `@app-tour/workspace-${id}`,
    workspaceTypes: [id],
    plugin: { entry: ".", export: "getWorkspacePlugin" },
    ...blocks,
  };
}

const MATRIX = {
  equipmentOnly: baseSynthetic("syn-equipment-only", {
    workspaceEquipment: { supported: true },
  }),
  transportOnly: baseSynthetic("syn-transport-only", {
    workspaceTransport: { supported: true },
  }),
  pricingOnly: baseSynthetic("syn-pricing-only", {
    workspacePricing: {
      supported: true,
      capabilities: { wizardTourField: false, allowMembershipDiscount: true },
    },
  }),
  difficultyFitnessOnly: baseSynthetic("syn-difficulty-only", {
    workspaceDifficultyFitness: {
      supported: true,
      capabilities: { catalogDetailSection: true },
    },
    catalogPresentation: { detailSections: { difficulty: true, fitness: true } },
  }),
  itineraryOnly: baseSynthetic("syn-itinerary-only", {
    workspaceItinerary: { supported: true, capabilities: { catalogDetailSection: true } },
    catalogPresentation: { detailSections: { itinerary: true } },
  }),
  equipmentTransport: baseSynthetic("syn-equipment-transport", {
    workspaceEquipment: { supported: true },
    workspaceTransport: { supported: true },
  }),
  transportPricing: baseSynthetic("syn-transport-pricing", {
    workspaceTransport: { supported: true },
    workspacePricing: {
      supported: true,
      capabilities: { wizardTourField: false, allowMembershipDiscount: false },
    },
  }),
  pricingMembershipLink: baseSynthetic("syn-pricing-membership", {
    workspacePricing: {
      supported: true,
      capabilities: { wizardTourField: false, allowMembershipDiscount: true },
    },
  }),
  noneOptional: baseSynthetic("syn-none-optional", {}),
};

/** @param {readonly Record<string, unknown>[]} manifests */
function hashAllCapabilityOutputs(manifests) {
  const chunks = [
    generateWorkspaceEquipmentCapabilities(manifests),
    generateWorkspaceTransportCapabilities(manifests),
    generateWorkspacePricingCapabilities(manifests),
    generateWorkspaceDifficultyFitnessCapabilities(manifests),
    generateWorkspaceItineraryCapabilities(manifests),
    generateWorkspaceCapabilityValidationBindings(manifests),
  ];
  return createHash("sha256").update(chunks.join("\n")).digest("hex");
}

/** @param {string} generated @param {string} workspaceType */
function hasCapabilityRow(generated, workspaceType) {
  return generated.includes(`"${workspaceType}":`);
}

describe("cw7-13 capability composition matrix", () => {
  it("equipment only — equipment bindings present, others absent", () => {
    const m = MATRIX.equipmentOnly;
    const manifests = [m];
    assert.equal(hasCapabilityRow(generateWorkspaceEquipmentCapabilities(manifests), "syn-equipment-only"), true);
    assert.equal(hasCapabilityRow(generateWorkspaceTransportCapabilities(manifests), "syn-equipment-only"), false);
    assert.equal(hasCapabilityRow(generateWorkspacePricingCapabilities(manifests), "syn-equipment-only"), false);
    assert.equal(hasCapabilityRow(generateWorkspaceItineraryCapabilities(manifests), "syn-equipment-only"), false);
    assert.equal(
      hasCapabilityRow(generateWorkspaceDifficultyFitnessCapabilities(manifests), "syn-equipment-only"),
      false
    );
  });

  it("transport only — transport bindings present, others absent", () => {
    const m = MATRIX.transportOnly;
    const manifests = [m];
    assert.equal(hasCapabilityRow(generateWorkspaceTransportCapabilities(manifests), "syn-transport-only"), true);
    assert.equal(hasCapabilityRow(generateWorkspaceEquipmentCapabilities(manifests), "syn-transport-only"), false);
    assert.equal(hasCapabilityRow(generateWorkspacePricingCapabilities(manifests), "syn-transport-only"), false);
  });

  it("pricing only — pricing + membership link flags", () => {
    const m = MATRIX.pricingOnly;
    const manifests = [m];
    const pricing = generateWorkspacePricingCapabilities(manifests);
    assert.equal(hasCapabilityRow(pricing, "syn-pricing-only"), true);
    assert.match(pricing, /allowMembershipDiscount: true as const/);
    assert.equal(hasCapabilityRow(generateWorkspaceEquipmentCapabilities(manifests), "syn-pricing-only"), false);
  });

  it("difficulty/fitness only — detail section flag without wizard", () => {
    const m = MATRIX.difficultyFitnessOnly;
    const manifests = [m];
    const generated = generateWorkspaceDifficultyFitnessCapabilities(manifests);
    assert.equal(hasCapabilityRow(generated, "syn-difficulty-only"), true);
    assert.match(generated, /catalogDetailSection: true as const/);
    assert.equal(hasCapabilityRow(generateWorkspaceEquipmentCapabilities(manifests), "syn-difficulty-only"), false);
  });

  it("itinerary only — itinerary bindings present", () => {
    const m = MATRIX.itineraryOnly;
    const manifests = [m];
    assert.equal(hasCapabilityRow(generateWorkspaceItineraryCapabilities(manifests), "syn-itinerary-only"), true);
    assert.equal(hasCapabilityRow(generateWorkspaceTransportCapabilities(manifests), "syn-itinerary-only"), false);
  });

  it("equipment + transport — both present, no cross-leak", () => {
    const m = MATRIX.equipmentTransport;
    const manifests = [m];
    assert.equal(hasCapabilityRow(generateWorkspaceEquipmentCapabilities(manifests), "syn-equipment-transport"), true);
    assert.equal(hasCapabilityRow(generateWorkspaceTransportCapabilities(manifests), "syn-equipment-transport"), true);
    assert.equal(hasCapabilityRow(generateWorkspacePricingCapabilities(manifests), "syn-equipment-transport"), false);
  });

  it("transport + pricing — independent capability rows", () => {
    const m = MATRIX.transportPricing;
    const manifests = [m];
    const pricing = generateWorkspacePricingCapabilities(manifests);
    assert.equal(hasCapabilityRow(generateWorkspaceTransportCapabilities(manifests), "syn-transport-pricing"), true);
    assert.equal(hasCapabilityRow(pricing, "syn-transport-pricing"), true);
    assert.match(pricing, /allowMembershipDiscount: false as const/);
  });

  it("pricing + membership link — allowMembershipDiscount true", () => {
    const m = MATRIX.pricingMembershipLink;
    const manifests = [m];
    const pricing = generateWorkspacePricingCapabilities(manifests);
    assert.match(pricing, /allowMembershipDiscount: true as const/);
  });

  it("workspace with none of optional capabilities — zero tour-domain rows", () => {
    const m = MATRIX.noneOptional;
    const manifests = [m];
    for (const gen of [
      generateWorkspaceEquipmentCapabilities,
      generateWorkspaceTransportCapabilities,
      generateWorkspacePricingCapabilities,
      generateWorkspaceDifficultyFitnessCapabilities,
      generateWorkspaceItineraryCapabilities,
    ]) {
      assert.equal(hasCapabilityRow(gen(manifests), "syn-none-optional"), false);
    }
  });

  it("starter-outdoor profile — RC blocks without tour-domain capabilities", () => {
    const catalog = loadProfileCatalog();
    const { effective } = expandAuthorManifest(
      {
        id: "outdoor-matrix",
        profile: "starter-outdoor",
        package: "@app-tour/workspace-starter",
        workspaceTypes: ["outdoor-matrix"],
        plugin: { entry: ".", export: "getWorkspacePlugin" },
      },
      catalog
    );
    assert.equal(effective.workspaceBooking?.supported, true);
    assert.equal(effective.workspaceFinance?.supported, true);
    assert.equal(effective.workspaceEquipment, undefined);
    assert.equal(effective.workspaceTransport, undefined);
    assert.equal(effective.workspacePricing, undefined);
    assert.equal(effective.workspaceItinerary, undefined);
    assert.equal(effective.workspaceDifficultyFitness, undefined);
  });

  it("disabling supported=false removes capability row", () => {
    const enabled = baseSynthetic("syn-toggle", {
      workspacePricing: { supported: true, capabilities: { allowMembershipDiscount: true } },
    });
    const disabled = baseSynthetic("syn-toggle", {
      workspacePricing: { supported: false },
    });
    assert.equal(hasCapabilityRow(generateWorkspacePricingCapabilities([enabled]), "syn-toggle"), true);
    assert.equal(hasCapabilityRow(generateWorkspacePricingCapabilities([disabled]), "syn-toggle"), false);
  });

  it("synthetic manifests do not trigger Denali legacy alias fallback", () => {
    const manifests = Object.values(MATRIX);
    for (const manifest of manifests) {
      assert.notEqual(manifest.id, "denali");
    }
    const pricing = generateWorkspacePricingCapabilities(manifests);
    assert.equal(pricing.includes('"denali"'), false);
  });

  it("generate registry twice is byte-identical for production manifests", () => {
    const manifests = discoverManifests();
    const first = hashAllCapabilityOutputs(manifests);
    const second = hashAllCapabilityOutputs(manifests);
    assert.equal(first, second);
  });
});
