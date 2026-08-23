import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";
import { isDenaliTourPublished } from "@app-tour/workspace-denali/host/catalog/denali-publish-status";
import { isHarborTourPublished } from "@app-tour/workspace-harbor/host/catalog";
import { isUrbanTourPublished } from "@app-tour/workspace-urban/host/http/publish-status";

import { isTourPubliclyVisible } from "../src/canonical/workspace-publish-visibility-dispatch";
import { WORKSPACE_PUBLISH_VISIBILITY_BINDINGS } from "../src/canonical/workspace-publish-visibility-bindings.generated";

describe("workspace-publish-visibility-bindings.spec.ts", () => {
  it("CW3-02-01 binds denali, urban, and harbor visibility from manifest codegen", () => {
    const workspaceTypes = WORKSPACE_PUBLISH_VISIBILITY_BINDINGS.map(
      (entry) => entry.workspaceType as string,
    );
    assert.deepEqual(workspaceTypes.sort(), ["denali", "harbor", "urban"]);
  });

  it("CW3-02-02 isTourPubliclyVisible fail-closed for unbound workspaces", () => {
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus"],
      data: { publishStatus: "active" },
    });
    assert.equal(isTourPubliclyVisible(undefined, canonical), false);
    assert.equal(isTourPubliclyVisible("starter", canonical), false);
    assert.equal(isTourPubliclyVisible("unknown", canonical), false);
  });

  it("CW3-02-03 generated bindings preserve Denali active/draft parity", () => {
    const denaliBinding = WORKSPACE_PUBLISH_VISIBILITY_BINDINGS.find(
      (entry) => entry.workspaceType === "denali",
    );
    assert.ok(denaliBinding);
    const active = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus"],
      data: { publishStatus: "active" },
    });
    const draft = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus"],
      data: { publishStatus: "draft" },
    });
    assert.equal(denaliBinding?.isTourPubliclyVisible(active), true);
    assert.equal(denaliBinding?.isTourPubliclyVisible(draft), false);
    assert.equal(isTourPubliclyVisible("denali", active), isDenaliTourPublished(active));
    assert.equal(isTourPubliclyVisible("denali", draft), isDenaliTourPublished(draft));
  });

  it("CW3-02-04 generated bindings preserve Urban published/archived parity", () => {
    const urbanBinding = WORKSPACE_PUBLISH_VISIBILITY_BINDINGS.find(
      (entry) => entry.workspaceType === "urban",
    );
    assert.ok(urbanBinding);
    const published = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { publishStatus: "published", title: "Walk" } },
    });
    const archived = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { publishStatus: "archived", title: "Walk" } },
    });
    assert.equal(urbanBinding?.isTourPubliclyVisible(published), true);
    assert.equal(urbanBinding?.isTourPubliclyVisible(archived), false);
    assert.equal(isTourPubliclyVisible("urban", published), isUrbanTourPublished(published));
    assert.equal(isTourPubliclyVisible("urban", archived), isUrbanTourPublished(archived));
  });

  it("CW3-02-05 generated bindings preserve Harbor published/draft parity", () => {
    const harborBinding = WORKSPACE_PUBLISH_VISIBILITY_BINDINGS.find(
      (entry) => entry.workspaceType === "harbor",
    );
    assert.ok(harborBinding);
    const published = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["status", "title"],
      data: { status: "published", title: "Harbor walk" },
    });
    const draft = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["status", "title"],
      data: { status: "draft", title: "Harbor walk" },
    });
    assert.equal(harborBinding?.isTourPubliclyVisible(published), true);
    assert.equal(harborBinding?.isTourPubliclyVisible(draft), false);
    assert.equal(isTourPubliclyVisible("harbor", published), isHarborTourPublished(published));
    assert.equal(isTourPubliclyVisible("harbor", draft), isHarborTourPublished(draft));
  });
});
