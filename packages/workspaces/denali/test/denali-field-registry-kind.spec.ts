import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceFieldRegistry } from "@app-tour/workspace-sdk";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import { shouldRenderDenaliRegistryField } from "../src/composites";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

type RegistryField = WorkspaceFieldRegistry["fields"][number];

function findRegistryField(
  fields: readonly RegistryField[],
  canonicalPath: string
): RegistryField | undefined {
  return fields.find((field) => field.canonicalPath === canonicalPath);
}

const INV_DENALI_INGRESS_001_CASES = [
  { canonicalPath: "category", id: "denali.tour-kind-basics", kind: "enum" },
  { canonicalPath: "destinationId", id: "denali.destination", kind: "text" },
  { canonicalPath: "startDateTime", id: "denali.datetime", kind: "date" },
  { canonicalPath: "program.themeIds", id: "denali.program-content", kind: "composite" },
  { canonicalPath: "photos", id: "denali.photos", kind: "composite" },
  { canonicalPath: "leaderUserIds", id: "denali.leader-user-ids", kind: "composite" },
] as const;

describe("denali-field-registry-kind.spec.ts (INV-DENALI-INGRESS-001)", () => {
  it("INV-DENALI-INGRESS-001 scalar composites use storage kind; array ingress stays composite", () => {
    const plugin = getDenaliWorkspacePlugin();
    const { fields } = plugin.fieldRegistry;

    for (const expected of INV_DENALI_INGRESS_001_CASES) {
      const field = findRegistryField(fields, expected.canonicalPath);
      assert.ok(field, `missing registry field: ${expected.canonicalPath}`);
      assert.equal(
        field.id,
        expected.id,
        `${expected.canonicalPath} id`
      );
      assert.equal(
        field.kind,
        expected.kind,
        `${expected.canonicalPath} kind`
      );
    }
  });

  it("INV-DENALI-INGRESS-002 denali_photos step keeps program-content and photos widgets", () => {
    const plugin = getDenaliWorkspacePlugin();
    const photosStepFields = plugin.fieldRegistry.fields.filter(
      (field) => field.stepId === "denali_photos"
    );

    assert.ok(photosStepFields.length >= 2, "denali_photos must expose at least two registry fields");
    assert.ok(
      photosStepFields.some((field) => field.id === "denali.photos"),
      "denali.photos widget must remain on denali_photos step"
    );
    assert.ok(
      photosStepFields.some((field) => field.canonicalPath === "program.themeIds"),
      "program.themeIds anchor must remain on denali_photos step"
    );
  });

  it("field registry count matches renderable + palette roadmap rows", () => {
    const plugin = getDenaliWorkspacePlugin();
    const renderableCount = DENALI_FIELD_DEFINITIONS.filter(shouldRenderDenaliRegistryField).length;
    const paletteRoadmapCount = DENALI_FIELD_DEFINITIONS.filter(
      (def) => (def.settingsSurface ?? "section") === "palette_roadmap"
    ).length;
    assert.equal(plugin.fieldRegistry.fields.length, renderableCount + paletteRoadmapCount);
  });
});
