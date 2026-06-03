import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  parseWorkspacePluginFromStorage,
  isWorkspaceSdkValidationError,
} from "@app-tour/workspace-sdk/ingress";
import { assertWorkspacePlugin } from "@app-tour/workspace-sdk/plugin";
import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";

import { createTestStarterPlugin } from "./fixtures/starter.fixture.js";
import { loadPlatformWizard } from "./load-platform-wizard.js";
import { testRuleContext } from "./fixtures/rule-context.fixture.js";
import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pluginWithInvalidThemeKeys() {
  return {
    ...createTestStarterPlugin(),
    theme: {
      id: "starter",
      version: 1,
      cssVariables: { "--color-primary": "#000000" },
    },
  };
}

describe("adversarial plugin ingress — headless platform init", () => {
  it("production facade does not import SDK theme subpath", () => {
    const engineSrc = fs.readFileSync(
      path.join(PKG_ROOT, "src", "engine", "platform-wizard.engine.ts"),
      "utf8",
    );
    assert.equal(engineSrc.includes("@app-tour/workspace-sdk/theme"), false);
    assert.match(
      engineSrc,
      /parseWorkspacePluginFromStorage\([^)]*\{\s*includeTheme:\s*false\s*\}/,
    );
  });

  it("full assertWorkspacePlugin rejects non-ws theme CSS keys", () => {
    const plugin = pluginWithInvalidThemeKeys();
    assert.throws(
      () => assertWorkspacePlugin(plugin),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_THEME_CSS_KEY");
        return true;
      },
    );
  });

  it("ingress parse with includeTheme:false skips theme CSS validation", () => {
    const plugin = pluginWithInvalidThemeKeys();
    assert.doesNotThrow(() =>
      parseWorkspacePluginFromStorage(plugin, { includeTheme: false }),
    );
  });

  it("PlatformWizardEngine.tryFromPlugin inits without validating theme (includeTheme:false)", () => {
    const plugin = pluginWithInvalidThemeKeys();
    const result = PlatformWizardEngine.tryFromPlugin(plugin);
    if (!result.ok) {
      assert.fail(result.error.message);
    }
    assert.equal(result.value.isInitialized(), true);
  });

  it("headless init still validates canonical after malicious theme on plugin object", () => {
    const engine = loadPlatformWizard(pluginWithInvalidThemeKeys());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "" },
        details: { summary: "" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "REQUIRED_FIELD_EMPTY"));
  });

  it("tryFromPlugin still fails fast on invalid registry shape (not theme)", () => {
    const plugin = {
      ...pluginWithInvalidThemeKeys(),
      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "dup",
            canonicalPath: "a",
            stepId: "basics",
            kind: "text" as const,
            required: true,
          },
          {
            id: "dup",
            canonicalPath: "b",
            stepId: "basics",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };
    const result = PlatformWizardEngine.tryFromPlugin(plugin);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, "DUPLICATE_FIELD_ID");
  });
});
