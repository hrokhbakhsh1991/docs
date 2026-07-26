import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliWorkspaceSurfaceEditorState,
  buildDenaliWorkspaceSurfaceEditorStatesMap,
  buildDenaliWorkspaceSurfacePatchInput,
  denaliOperatorSurfaceMessageKey,
  mergeDenaliWorkspaceSurfaceEditorState,
  patchDenaliWorkspaceSurfaceEditorStatesMap,
  resolveDenaliOperatorSurfaceDisplayText,
  DENALI_WORKSPACE_SURFACES_TEST_IDS,
} from "../src/exposure/denali-workspace-surface-editor-state.ts";

describe("buildDenaliWorkspaceSurfaceEditorState", () => {
  it("enables customize and copies ids for override_fields", () => {
    const state = buildDenaliWorkspaceSurfaceEditorState({
      audience: "public",
      trigger: "always",
      activeIntent: { mode: "override_fields", selectedFieldIds: ["title", "denali.destination"] },
    });
    assert.equal(state.customizeFields, true);
    assert.deepEqual(state.selectedFieldIds, ["title", "denali.destination"]);
    assert.equal(state.audience, "public");
  });

  it("clears selection when intent is inherit/disabled/null", () => {
    const inherit = buildDenaliWorkspaceSurfaceEditorState({
      audience: "public",
      trigger: "always",
      activeIntent: { mode: "inherit_profile", selectedFieldIds: ["title"] },
    });
    assert.equal(inherit.customizeFields, false);
    assert.deepEqual(inherit.selectedFieldIds, []);

    const none = buildDenaliWorkspaceSurfaceEditorState({
      audience: "public",
      trigger: "always",
      activeIntent: null,
    });
    assert.equal(none.customizeFields, false);
    assert.deepEqual(none.selectedFieldIds, []);
  });

  it("exposes stable operator panel test ids", () => {
    assert.equal(DENALI_WORKSPACE_SURFACES_TEST_IDS.panel, "denali-workspace-surfaces-panel");
  });
});

describe("buildDenaliWorkspaceSurfacePatchInput", () => {
  it("maps customize state to enabled patch with selected ids", () => {
    const patch = buildDenaliWorkspaceSurfacePatchInput({
      customizeFields: true,
      selectedFieldIds: ["title", "denali.destination"],
      audience: "public",
      trigger: "always",
    });
    assert.deepEqual(patch, {
      audience: "public",
      trigger: "always",
      enabled: true,
      selectedFieldIds: ["title", "denali.destination"],
    });
  });

  it("clears selectedFieldIds when customize is off", () => {
    const patch = buildDenaliWorkspaceSurfacePatchInput({
      customizeFields: false,
      selectedFieldIds: ["title"],
      audience: "operator",
      trigger: "on_publish",
    });
    assert.deepEqual(patch, {
      audience: "operator",
      trigger: "on_publish",
      enabled: false,
      selectedFieldIds: [],
    });
  });
});

describe("buildDenaliWorkspaceSurfaceEditorStatesMap", () => {
  it("keys editor state by surface id from list rows", () => {
    const map = buildDenaliWorkspaceSurfaceEditorStatesMap([
      {
        surface: "public_list",
        audience: "public",
        trigger: "always",
        activeIntent: { mode: "override_fields", selectedFieldIds: ["title"] },
      },
      {
        surface: "operator_detail",
        audience: "operator",
        trigger: "on_publish",
        activeIntent: null,
      },
    ]);
    assert.equal(map.public_list?.customizeFields, true);
    assert.deepEqual(map.public_list?.selectedFieldIds, ["title"]);
    assert.equal(map.operator_detail?.customizeFields, false);
    assert.deepEqual(map.operator_detail?.selectedFieldIds, []);
    assert.equal(map.operator_detail?.audience, "operator");
  });

  it("returns empty object for empty surfaces", () => {
    assert.deepEqual(buildDenaliWorkspaceSurfaceEditorStatesMap([]), {});
  });
});

describe("merge / patch DenaliWorkspaceSurfaceEditorStatesMap", () => {
  const fallback = buildDenaliWorkspaceSurfaceEditorState({
    audience: "public",
    trigger: "always",
    activeIntent: null,
  });

  it("mergeDenaliWorkspaceSurfaceEditorState preserves audience/trigger and applies selection", () => {
    const current = buildDenaliWorkspaceSurfaceEditorState({
      audience: "operator",
      trigger: "on_publish",
      activeIntent: { mode: "override_fields", selectedFieldIds: ["title"] },
    });
    const merged = mergeDenaliWorkspaceSurfaceEditorState(current, fallback, {
      customizeFields: false,
      selectedFieldIds: [],
    });
    assert.deepEqual(merged, {
      audience: "operator",
      trigger: "on_publish",
      customizeFields: false,
      selectedFieldIds: [],
    });

    const fromFallback = mergeDenaliWorkspaceSurfaceEditorState(undefined, fallback, {
      customizeFields: true,
      selectedFieldIds: ["a"],
    });
    assert.equal(fromFallback.audience, "public");
    assert.deepEqual(fromFallback.selectedFieldIds, ["a"]);
  });

  it("patchDenaliWorkspaceSurfaceEditorStatesMap updates one key immutably", () => {
    const current = {
      public_list: buildDenaliWorkspaceSurfaceEditorState({
        audience: "public",
        trigger: "always",
        activeIntent: { mode: "override_fields", selectedFieldIds: ["title"] },
      }),
    };
    const next = patchDenaliWorkspaceSurfaceEditorStatesMap(
      current,
      "public_list",
      fallback,
      { customizeFields: true, selectedFieldIds: ["title", "price"] }
    );
    assert.notEqual(next, current);
    assert.deepEqual(next.public_list?.selectedFieldIds, ["title", "price"]);
    assert.deepEqual(current.public_list?.selectedFieldIds, ["title"]);
  });
});

describe("resolveDenaliOperatorSurfaceDisplayText", () => {
  it("builds stable message keys", () => {
    assert.equal(denaliOperatorSurfaceMessageKey("name", "public_list"), "surfaceNames.public_list");
    assert.equal(
      denaliOperatorSurfaceMessageKey("description", "public_list"),
      "surfaceDescriptions.public_list"
    );
  });

  it("uses catalog text when present and fallback otherwise", () => {
    const catalog = new Map([
      ["surfaceNames.public_list", "Public list"],
      ["surfaceDescriptions.public_list", "Shown on public catalog cards"],
    ]);
    const messages = {
      has: (key: string) => catalog.has(key),
      t: (key: string) => catalog.get(key) ?? key,
    };
    assert.equal(
      resolveDenaliOperatorSurfaceDisplayText({
        kind: "name",
        surface: "public_list",
        messages,
        fallback: "public_list",
      }),
      "Public list"
    );
    assert.equal(
      resolveDenaliOperatorSurfaceDisplayText({
        kind: "name",
        surface: "missing",
        messages,
        fallback: "missing",
      }),
      "missing"
    );
    assert.equal(
      resolveDenaliOperatorSurfaceDisplayText({
        kind: "description",
        surface: "missing",
        messages,
        fallback: "default",
      }),
      "default"
    );
  });
});
