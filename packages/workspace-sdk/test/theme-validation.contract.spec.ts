import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeThemeCssKey } from "../src/theme/normalize-theme-css-key.js";
import {
  WORKSPACE_THEME_CSS_VARIABLE,
} from "../src/theme/workspace-theme-presets.js";
import {
  assertWorkspacePlugin,
  assertWorkspaceThemeContract,
  WorkspaceThemeValidationError,
} from "../src/plugin/workspace-plugin-validation.js";
import {
  createFreshPresets,
  createFreshStarterPlugin,
} from "./lib/immutable-harness.js";

function pluginWithTheme(theme: unknown) {
  return { ...createFreshStarterPlugin(), theme };
}

describe("assertWorkspaceThemeContract", () => {
  it("accepts valid --ws-* variables", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceThemeContract({
        id: "starter",
        version: 1,
        cssVariables: {
          "--ws-color-accent": "#1e5a8e",
          "ws-font-display": "system-ui",
        },
      }),
    );
  });

  it("rejects theme id with invalid characters (T-1)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "bad_id",
          version: 1,
          cssVariables: { "--ws-color-accent": "#000" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_ID");
        return true;
      },
    );
  });

  it("rejects negative theme version (T-2)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: -1,
          cssVariables: { "--ws-color-accent": "#000" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_VERSION");
        return true;
      },
    );
  });

  it("rejects more than 64 css variables (T-3)", () => {
    const cssVariables: Record<string, string> = {};
    for (let index = 0; index < 65; index += 1) {
      cssVariables[`--ws-token-${index}`] = "#000000";
    }
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables,
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "THEME_CSS_VARIABLE_LIMIT");
        return true;
      },
    );
  });

  it("rejects keys without --ws- prefix (T-4)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--color-accent": "#000" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_CSS_KEY");
        return true;
      },
    );
  });

  it("rejects css values over 4096 characters (T-5)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "x".repeat(4097) },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects unsafe css values (T-6)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "expression(alert(1))" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects quoted javascript url() (T-6b)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "url('javascript:alert(1)')" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects disallowed url() not on allowlist (T-6c)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "url(https://evil.example/bg.png)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("accepts var() references without url() (T-6d)", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceThemeContract({
        id: "starter",
        version: 1,
        cssVariables: { "--ws-color-accent": "var(--color-primary)" },
      }),
    );
  });

  it("rejects bare javascript: in css values (T-6e)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "javascript:alert(1)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects -moz-binding in css values (T-6f)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "-moz-binding:url(evil.xml#xss)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects behavior: in css values (T-6g)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "behavior:url(evil.htc)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects @import in css values (T-6h)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "@import url(evil.css)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects homoglyph javascript after NFKC via contract (T-6i)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "\uFF2Aavascript:alert(1)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("rejects CSS escape sequences in css values (T-6j)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "\\6aavascript:alert(1)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("normalizeThemeCssKey prefixes bare workspace keys", () => {
    assert.equal(normalizeThemeCssKey("ws-color-accent"), "--ws-color-accent");
    assert.equal(normalizeThemeCssKey("  --ws-color-accent  "), "--ws-color-accent");
  });

  it("rejects optionalStylesheet with parent traversal (T-7)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "#000" },
          optionalStylesheet: "../theme/tokens.css",
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_STYLESHEET");
        return true;
      },
    );
  });

  it("rejects absolute optionalStylesheet /etc/passwd (T-7b)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "#000" },
          optionalStylesheet: "/etc/passwd",
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_STYLESHEET");
        return true;
      },
    );
  });

  it("rejects encoded parent traversal in optionalStylesheet (T-7c)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "#000" },
          optionalStylesheet: "theme/%2e%2e/secret.css",
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_STYLESHEET");
        return true;
      },
    );
  });

  it("accepts strictly relative optionalStylesheet (T-7d)", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceThemeContract({
        id: "starter",
        version: 1,
        cssVariables: { "--ws-color-accent": "#000" },
        optionalStylesheet: "theme/workspace.css",
      }),
    );
  });

  it("rejects Windows drive optionalStylesheet (T-7e)", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "#000" },
          optionalStylesheet: "C:\\windows\\win.ini",
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_STYLESHEET");
        return true;
      },
    );
  });
});

describe("assertWorkspacePlugin theme ingress", () => {
  it("accepts plugin without theme", () => {
    assert.doesNotThrow(() => assertWorkspacePlugin(createFreshStarterPlugin()));
  });

  it("validates theme when present on plugin", () => {
    assert.doesNotThrow(() =>
      assertWorkspacePlugin(
        pluginWithTheme({
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "#1e5a8e" },
        }),
      ),
    );
  });

  it("rejects invalid theme on plugin", () => {
    assert.throws(
      () =>
        assertWorkspacePlugin(
          pluginWithTheme({
            id: "starter",
            version: 1,
            cssVariables: { "--color-primary": "#000" },
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_CSS_KEY");
        return true;
      },
    );
  });
});

describe("createFreshPresets()", () => {
  it("is frozen after first access (presets and cssVariables)", () => {
    assert.ok(Object.isFrozen(createFreshPresets()));
    assert.ok(Object.isFrozen(createFreshPresets()["platform-primary"]));
    assert.ok(Object.isFrozen(createFreshPresets()["platform-primary"].cssVariables));
    assert.equal(
      Reflect.set(createFreshPresets(), "hacked", {
        id: "evil",
        version: 1,
        cssVariables: {},
      }),
      false,
    );
    assert.equal(
      Reflect.set(
        createFreshPresets()["platform-primary"].cssVariables,
        "--ws-evil",
        "var(--color-danger)",
      ),
      false,
    );
    assert.equal(
      createFreshPresets()["platform-primary"].cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent],
      "var(--color-primary)",
    );
  });
});
