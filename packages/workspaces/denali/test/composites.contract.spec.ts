import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { WORKSPACE_THEME_CSS_VARIABLE } from "@app-tour/workspace-sdk";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  getDenaliCompositeRegistry,
  resolveDenaliFieldRenderer,
  shouldRenderDenaliRegistryField,
} from "../src/composites";
import { isPlatformRendererId } from "../src/composites/platform-renderer-ids";
import { DENALI_THEME_ADMIN_STYLESHEET, DENALI_THEME_TOKENS_STYLESHEET, getDenaliWorkspacePlugin } from "../src/denali.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_CSS = join(PACKAGE_ROOT, "theme", "tokens.css");

describe("composites.contract.spec.ts (REQ-P6-010, RULE-P6-014)", () => {
  it("every renderable registry field resolves to a platform renderer id", () => {
    const renderable = DENALI_FIELD_DEFINITIONS.filter(shouldRenderDenaliRegistryField);
    assert.ok(renderable.length > 0);

    for (const field of renderable) {
      const resolution = resolveDenaliFieldRenderer(field);
      assert.ok(resolution, `orphan field: ${field.canonicalPath}`);
      assert.ok(
        isPlatformRendererId(resolution.rendererId),
        `unknown renderer for ${field.canonicalPath}: ${resolution.rendererId}`
      );
    }
  });

  it("composite renderer ids use denali.* namespace and are registered", () => {
    const registry = getDenaliCompositeRegistry();
    const plugin = getDenaliWorkspacePlugin();

    for (const field of plugin.fieldRegistry.fields) {
      if (!field.id.startsWith("denali.")) continue;
      assert.match(field.id, /^denali\./, `composite field id must be denali.* — got ${field.id}`);
      assert.ok(
        field.id in registry,
        `composite field ${field.id} missing from getDenaliCompositeRegistry()`
      );
    }
  });

  it("plugin field registry has no orphan composite kinds", () => {
    const plugin = getDenaliWorkspacePlugin();
    const renderableCount = DENALI_FIELD_DEFINITIONS.filter(shouldRenderDenaliRegistryField).length;
    assert.equal(plugin.fieldRegistry.fields.length, renderableCount);
  });

  it("theme/tokens.css exists, uses --ws-* only, and is exported by plugin", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    const props = css.match(/--[a-z0-9-]+\s*:/gi) ?? [];
    assert.ok(props.length > 0);
    for (const prop of props) {
      assert.match(prop, /^--ws-/i, `forbidden non-workspace token: ${prop}`);
    }
    assert.match(css, /--ws-color-accent\s*:\s*var\(--color-primary\)/);
    assert.equal(
      getDenaliWorkspacePlugin().theme?.optionalStylesheet,
      DENALI_THEME_ADMIN_STYLESHEET
    );
    assert.equal(
      getDenaliWorkspacePlugin().theme?.cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent],
      "var(--color-primary)"
    );
  });
});
