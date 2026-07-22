/**
 * Wave D.c — operator shell chrome uses manifest codegen, not hard-coded plugin ids.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  resolveOperatorShellNavLinks,
  WORKSPACE_OPERATOR_SHELL_NAV,
} from "../src/bootstrap/operator-shell-nav-bindings.generated";

const WEB_ROOT = join(import.meta.dirname, "..");

describe("operator-shell-nav.spec.ts — Wave D.c", () => {
  it("D.c-01 urban declares catalog + settings Phase 3 nav links", () => {
    const links = resolveOperatorShellNavLinks("urban");
    assert.equal(links.length, 2);
    assert.deepEqual(links[0], { href: "/catalog", labelKey: "catalog" });
    assert.deepEqual(links[1], {
      href: "/settings/workspace-owner",
      labelKey: "workspaceOwnerSettings",
    });
    assert.equal(resolveOperatorShellNavLinks("denali").length, 0);
    assert.ok("urban" in WORKSPACE_OPERATOR_SHELL_NAV);
  });

  it("D.c-02 AppShell has no hard-coded urban/denali pluginId branch", () => {
    const source = readFileSync(join(WEB_ROOT, "src/shell/app-shell.tsx"), "utf8");
    assert.match(source, /resolveOperatorShellNavLinks/);
    assert.doesNotMatch(source, /URBAN_WORKSPACE_PLUGIN_ID/);
    assert.doesNotMatch(source, /pluginId\s*===\s*["']urban["']/);
    assert.doesNotMatch(source, /DENALI_PLUGIN_ID/);
  });

  it("D.c-03 ToursWizardLayout selects bridge via extended-create Set", () => {
    const source = readFileSync(join(WEB_ROOT, "src/shell/tours-wizard-layout.tsx"), "utf8");
    assert.match(source, /isExtendedOperatorWorkspace/);
    assert.doesNotMatch(source, /DENALI_PLUGIN_ID/);
    assert.doesNotMatch(source, /pluginId\s*===\s*["']denali["']/);
  });
});
