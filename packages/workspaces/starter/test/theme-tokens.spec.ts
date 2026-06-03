import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { WORKSPACE_THEME_CSS_VARIABLE } from "@app-tour/workspace-sdk";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_CSS = join(PACKAGE_ROOT, "theme", "tokens.css");
const WS_VAR_PATTERN = /--ws-[a-z0-9-]+/gi;
describe("starter theme/tokens.css", () => {
  const css = readFileSync(TOKENS_CSS, "utf8");

  it("declares only --ws-* custom properties", () => {
    const props = css.match(/--[a-z0-9-]+\s*:/gi) ?? [];
    assert.ok(props.length > 0, "expected at least one custom property");
    for (const prop of props) {
      assert.match(prop, /^--ws-/i, `forbidden non-workspace token: ${prop}`);
    }
  });

  it("includes --ws-color-accent aligned with plugin theme contract", () => {
    assert.match(css, /--ws-color-accent\s*:\s*var\(--color-primary\)/);
    assert.equal(
      getStarterWorkspacePlugin().theme?.cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent],
      "var(--color-primary)",
    );
  });

  it("references workspace accent variable name from SDK constant", () => {
    const vars = css.match(WS_VAR_PATTERN) ?? [];
    assert.ok(vars.includes(WORKSPACE_THEME_CSS_VARIABLE.colorAccent));
  });
});
