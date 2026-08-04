import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  ManifestThemeBlockSchema,
  WorkspaceManifestCiSchema,
  validateWorkspaceManifestRecord,
} from "../src/manifest.schema.js";
import { runValidateWorkspaceManifests } from "../scripts/validate-manifests.js";

const SDK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACES_DIR = path.resolve(SDK_ROOT, "../workspaces");

const minimalManifest = {
  id: "demo",
  version: 1,
  package: "@app-tour/workspace-demo",
  workspaceTypes: ["demo"],
  plugin: { entry: ".", export: "getDemoWorkspacePlugin" },
};

describe("WorkspaceManifestCiSchema", () => {
  it("accepts a minimal valid manifest", () => {
    const parsed = WorkspaceManifestCiSchema.safeParse(minimalManifest);
    assert.equal(parsed.success, true);
  });

  it("rejects invalid workspace id", () => {
    const parsed = WorkspaceManifestCiSchema.safeParse({
      ...minimalManifest,
      id: "Denali",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects invalid guestCrossSurfaceNav surface enum", () => {
    const parsed = WorkspaceManifestCiSchema.safeParse({
      ...minimalManifest,
      guestCrossSurfaceNav: {
        version: 1,
        links: [
          {
            id: "home",
            labelKey: "nav.home",
            surface: "portal",
            path: "/",
          },
        ],
      },
    });
    assert.equal(parsed.success, false);
  });

  it("accepts theme block with valid CSS custom properties", () => {
    const parsed = ManifestThemeBlockSchema.safeParse({
      "--color-primary": "#f00",
      "color-secondary": "#00f",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects unsafe theme values", () => {
    const parsed = ManifestThemeBlockSchema.safeParse({
      "--color-primary": "javascript:alert(1)",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects invalid theme keys", () => {
    const parsed = ManifestThemeBlockSchema.safeParse({
      "bad key!": "#f00",
    });
    assert.equal(parsed.success, false);
  });
});

describe("validateWorkspaceManifestRecord", () => {
  it("reports semantic GCSN errors after structural parse", () => {
    const result = validateWorkspaceManifestRecord(
      {
        ...minimalManifest,
        guestCrossSurfaceNav: {
          version: 1,
          links: [
            {
              id: "trips",
              labelKey: "nav.trips",
              surface: "portal_egress",
              egress: "member_module",
            },
          ],
        },
      },
      "fixture.json",
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /GCSN-MISSING-MEMBER-MODULE-ID/);
    }
  });
});

describe("runValidateWorkspaceManifests", () => {
  it("is exposed through the package validate:manifests front door", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(SDK_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    assert.equal(
      packageJson.scripts?.["validate:manifests"],
      "node --import tsx scripts/validate-manifests.ts",
    );
  });

  it("PASS for checked-in workspace manifests", () => {
    const result = runValidateWorkspaceManifests(WORKSPACES_DIR);
    assert.equal(
      result.ok,
      true,
      result.errors.join("\n"),
    );
  });
});
