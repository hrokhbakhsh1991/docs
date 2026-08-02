/**
 * Wave D.c — operator shell chrome uses capability registry, not generated product binders.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { getWorkspacePlugin as getUrbanPlugin } from "@app-tour/workspace-urban";
import { resolveOperatorShellNavCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = join(import.meta.dirname, "..");

describe("operator-shell-nav.spec.ts — Wave D.c", () => {
  it("D.c-01 urban declares catalog + settings Phase 3 nav links via capability", () => {
    const nav = resolveOperatorShellNavCapability(getUrbanPlugin());
    assert.ok(nav);
    assert.equal(nav.links.length, 2);
    assert.deepEqual(nav.links[0], { href: "/catalog", labelKey: "catalog" });
    assert.deepEqual(nav.links[1], {
      href: "/settings/workspace-owner",
      labelKey: "workspaceOwnerSettings",
    });
  });

  it("D.c-02 AppShell has no hard-coded urban/denali pluginId branch", () => {
    const source = readFileSync(join(WEB_ROOT, "src/shell/app-shell.tsx"), "utf8");
    assert.match(source, /ensureOperatorShellNavLinks/);
    assert.match(source, /operator-shell-nav-registry/);
    assert.doesNotMatch(source, /operator-shell-nav-bindings/);
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

  it("D.c-04 operator-shell-nav product binder is absent", () => {
    assert.equal(
      existsSync(join(WEB_ROOT, "src/bootstrap/operator-shell-nav-bindings.generated.ts")),
      false
    );
  });
});
