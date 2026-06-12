import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { WORKSPACE_THEME_CSS_VARIABLE } from "@app-tour/workspace-sdk";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_CSS_PATH = join(PACKAGE_ROOT, "theme", "tokens.css");
const INDEX_TS_PATH = join(PACKAGE_ROOT, "src", "index.ts");
const PLUGIN_TS_PATH = join(PACKAGE_ROOT, "src", "starter.plugin.ts");

/** Values must reference platform/workspace vars — no raw literals (Phase 3.1 token hygiene). */
const FORBIDDEN_CSS_VALUE_PATTERN =
  /:\s*(#[0-9a-f]{3,8}\b|\d+(\.\d+)?(px|rem|em|%)\b|rgb[a]?\(|hsl[a]?\()/i;

/** Host global scope — workspace CSS must not redefine platform :root/html/body. */
const FORBIDDEN_GLOBAL_SELECTOR_PATTERN = /(?:^|[,\s])(:root|html|body|\*)\s*\{/m;

describe("architectural integrity — token hygiene", () => {
  const css = readFileSync(TOKENS_CSS_PATH, "utf8");

  it("FAIL if tokens.css contains hardcoded colors or spacing literals", () => {
    const forbidden = css.match(FORBIDDEN_CSS_VALUE_PATTERN) ?? [];
    assert.deepEqual(
      forbidden,
      [],
      `raw literals forbidden — use var(--platform-token): ${forbidden.join(", ")}`,
    );
  });

  it("FAIL if any declaration value is not a var() reference", () => {
    const declarations = css.match(/--ws-[a-z0-9-]+\s*:\s*[^;]+/gi) ?? [];
    assert.ok(declarations.length > 0);
    for (const decl of declarations) {
      const value = decl.split(":").slice(1).join(":").trim();
      assert.match(
        value,
        /^var\(--[a-z0-9-]+\)$/i,
        `workspace token values must be var(--*) references only: ${decl}`,
      );
    }
  });

  it("plugin theme cssVariables mirror tokens.css (var references only)", () => {
    const vars = getStarterWorkspacePlugin().theme?.cssVariables ?? {};
    for (const [key, value] of Object.entries(vars)) {
      assert.match(key, /^--ws-/);
      assert.match(value, /^var\(--[a-z0-9-]+\)$/i, `forbidden literal in contract: ${value}`);
    }
    assert.equal(vars[WORKSPACE_THEME_CSS_VARIABLE.colorAccent], "var(--color-primary)");
  });
});

describe("architectural integrity — plugin-host contract", () => {
  const css = readFileSync(TOKENS_CSS_PATH, "utf8");

  it("scopes rules under [data-workspace-theme] only — cannot override :root platform tokens", () => {
    assert.match(css, /\[data-workspace-theme\]/);
    assert.equal(FORBIDDEN_GLOBAL_SELECTOR_PATTERN.test(css), false);
  });

  it("defines --ws-* on subtree, reads platform tokens via var() — does not assign to --color-*", () => {
    assert.doesNotMatch(css, /--color-[a-z0-9-]+\s*:/i);
    assert.match(css, /--ws-color-accent\s*:\s*var\(--color-primary\)/);
  });

  it("malicious host without data-workspace-theme attribute receives no custom properties from this file", () => {
    const selectors = css.match(/[^{]+(?=\s*\{)/g) ?? [];
    for (const selector of selectors) {
      assert.match(
        selector.trim(),
        /\[data-workspace-theme\]/,
        `selector must require workspace scope: ${selector}`,
      );
    }
  });
});

describe("architectural integrity — declarative purity", () => {
  const indexSource = readFileSync(INDEX_TS_PATH, "utf8");
  const pluginSource = readFileSync(PLUGIN_TS_PATH, "utf8");

  it("index.ts is re-export only (no executable logic)", () => {
    assert.doesNotMatch(indexSource, /\bfunction\b/);
    assert.doesNotMatch(indexSource, /\bclass\b/);
    assert.doesNotMatch(indexSource, /=\s*await\b/);
    assert.doesNotMatch(indexSource, /=\s*new\s+[A-Z]/);
    assert.match(indexSource, /^export\s+\{/m);
  });

  it("starter.plugin.ts extends SDK reference with platform wizardHost (Phase 12.8)", () => {
    assert.doesNotMatch(pluginSource, /\breadFileSync\b|\bfetch\b|\brequire\s*\(/);
    assert.doesNotMatch(pluginSource, /=\s*JSON\.parse/);
    assert.match(pluginSource, /from "@app-tour\/platform-core"/);
    assert.match(pluginSource, /createPlatformWizardHostHooks/);
    assert.match(pluginSource, /from "@app-tour\/workspace-sdk"/);
    assert.match(pluginSource, /getStarterWorkspacePlugin/);
  });
});
