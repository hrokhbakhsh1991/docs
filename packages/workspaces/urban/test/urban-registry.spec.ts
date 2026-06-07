import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  getUrbanWorkspacePlugin,
  URBAN_FORBIDDEN_CANONICAL_PREFIXES,
  URBAN_REGISTRY_CANONICAL_PATHS,
} from "../src/urban.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(PACKAGE_ROOT, "test/fixtures/golden");

const SCOPE_REQUIRED_PATHS = [
  "tour.title",
  "tour.city",
  "tour.venueName",
  "tour.startDate",
  "tour.endDate",
  "tour.capacity",
  "tour.status",
] as const;

function loadGoldenDocument(filename: string) {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

describe("urban-registry.spec.ts (REQ-P7-005, REQ-P7-031, REQ-P7-014)", () => {
  it("field registry matches URBAN-MINIMAL-SCOPE table", () => {
    const plugin = getUrbanWorkspacePlugin();
    const paths = plugin.fieldRegistry.fields.map((field) => field.canonicalPath).sort();
    assert.deepEqual(paths, [...URBAN_REGISTRY_CANONICAL_PATHS].sort());

    for (const requiredPath of SCOPE_REQUIRED_PATHS) {
      const field = plugin.fieldRegistry.fields.find((f) => f.canonicalPath === requiredPath);
      assert.ok(field, `missing required field ${requiredPath}`);
      assert.equal(field.required, true, `${requiredPath} must be required`);
    }

    const description = plugin.fieldRegistry.fields.find(
      (f) => f.canonicalPath === "tour.description"
    );
    assert.ok(description);
    assert.equal(description.required, false);
  });

  it("wizard surface strips itinerary/participation/logistics groups", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.deepEqual(plugin.wizard.inactiveFieldGroups, [
      "itinerary",
      "participation",
      "logistics",
    ]);
    assert.equal(plugin.supportedWorkspaceTypes[0], "urban");
    assert.ok(
      URBAN_FORBIDDEN_CANONICAL_PREFIXES.some((prefix) =>
        prefix.startsWith("tripDetails.itinerary")
      )
    );
  });

  it("validateCanonical passes urban-tour-publish-ready golden", () => {
    const plugin = getUrbanWorkspacePlugin();
    const engine = PlatformWizardEngine.create(plugin);
    const golden = loadGoldenDocument("urban-tour-publish-ready.json");
    const document = createCanonicalDocument(golden);
    const result = engine.validateCanonical(document, {
      tenantId: "urban-registry-tenant",
      dimensions: { tourType: "city" },
    });
    assert.equal(result.ok, true, JSON.stringify(result.violations));
    assert.equal((document.data.tour as { status?: string }).status, "draft");
  });

  it("validateCanonical passes urban-tour-minimal golden", () => {
    const plugin = getUrbanWorkspacePlugin();
    const engine = PlatformWizardEngine.create(plugin);
    const golden = loadGoldenDocument("urban-tour-minimal.json");
    const document = createCanonicalDocument(golden);
    const result = engine.validateCanonical(document, {
      tenantId: "urban-registry-tenant",
      dimensions: { tourType: "city" },
    });
    assert.equal(result.ok, true, JSON.stringify(result.violations));
  });

  it("forbidden itinerary fixture fails urban validation hooks", () => {
    const plugin = getUrbanWorkspacePlugin();
    const golden = loadGoldenDocument("urban-tour-invalid-itinerary.json");
    const violation = plugin.validation.checkTripDetails(golden.data.tripDetails, null);
    assert.ok(violation);
    assert.equal(violation?.code, "URBAN_FORBIDDEN_ITINERARY");
  });

  it("transportModes rejected by urban validation hooks", () => {
    const plugin = getUrbanWorkspacePlugin();
    const violation = plugin.validation.checkTripDetails({}, ["bus"]);
    assert.ok(violation);
    assert.equal(violation?.code, "URBAN_FORBIDDEN_TRANSPORT");
  });
});
