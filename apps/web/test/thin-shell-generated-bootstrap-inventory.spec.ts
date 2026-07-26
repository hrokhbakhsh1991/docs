/**
 * Thin Shell Phase 4bj — generated bootstrap inventory lock.
 * @see docs/dev/thin-shell-generated-bootstrap-inventory.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOTSTRAP = join(WEB_ROOT, "src/bootstrap");

/** Exact remaining generated bootstrap set after product binder retirement (Phase 4bj). */
const EXPECTED_GENERATED = Object.freeze([
  "wizard-i18n-translator-hooks.generated.ts",
  "wizard-media-backend-route-bindings.generated.ts",
  "wizard-media-route-bindings.generated.ts",
  "workspace-owner-settings-panel-loaders.generated.ts",
  "workspace-plugin-loaders.generated.ts",
  "workspace-theme-stylesheets.generated.ts",
  "workspace-wizard-message-loads.generated.ts",
]);

describe("thin-shell-generated-bootstrap-inventory — Phase 4bj", () => {
  it("TS-4BJ-01 exact generated bootstrap file set", () => {
    const found = readdirSync(BOOTSTRAP)
      .filter((name) => name.endsWith(".generated.ts") || name.endsWith(".generated.tsx"))
      .sort();
    assert.deepEqual(found, [...EXPECTED_GENERATED].sort());
  });

  it("TS-4BJ-02 no product binder leftovers (ops/nav/create/settings UI)", () => {
    const forbidden = [
      "workspace-finance-ops-bindings.generated.ts",
      "workspace-finance-nav-bindings.generated.ts",
      "workspace-booking-ops-bindings.generated.ts",
      "wizard-create-bindings.generated.ts",
      "operator-shell-nav-bindings.generated.ts",
      "workspace-settings-equipment-ui-bindings.generated.ts",
      "workspace-settings-exposure-surfaces-ui-bindings.generated.ts",
      "workspace-settings-destination-bindings.generated.ts",
    ];
    for (const name of forbidden) {
      assert.equal(
        EXPECTED_GENERATED.includes(name),
        false,
        `retired binder must not be in inventory: ${name}`
      );
      assert.doesNotMatch(
        readdirSync(BOOTSTRAP).join("\n"),
        new RegExp(`^${name.replace(/\./g, "\\.")}$`, "m")
      );
    }
  });

  it("TS-4BJ-03 opaque media tables have no product package imports", () => {
    for (const name of [
      "wizard-media-route-bindings.generated.ts",
      "wizard-media-backend-route-bindings.generated.ts",
    ]) {
      const src = readFileSync(join(BOOTSTRAP, name), "utf8");
      assert.doesNotMatch(src, /@app-tour\/workspace-/);
      assert.doesNotMatch(src, /await import\(/);
    }
  });

  it("TS-4BJ-04 plugin loaders are dynamic-only getWorkspacePlugin", () => {
    const src = readFileSync(join(BOOTSTRAP, "workspace-plugin-loaders.generated.ts"), "utf8");
    assert.match(src, /await import\(/);
    assert.match(src, /getWorkspacePlugin/);
    assert.doesNotMatch(src, /getDenali|ensureDenali/);
    assert.doesNotMatch(src, /^import\s+.+from\s+["']@app-tour\/workspace-(?!sdk)/m);
  });

  it("TS-4BJ-05 i18n hooks are allowlist-only (no useTranslations)", () => {
    const src = readFileSync(join(BOOTSTRAP, "wizard-i18n-translator-hooks.generated.ts"), "utf8");
    assert.match(src, /isWorkspaceWizardI18nNamespace/);
    assert.match(src, /listWorkspaceWizardI18nNamespaces/);
    assert.doesNotMatch(src, /useTranslations/);
    assert.doesNotMatch(src, /"use client"/);
  });

  it("TS-4BJ-06 next tooling generated support files remain (not binders)", () => {
    const names = new Set(readdirSync(BOOTSTRAP));
    assert.ok(names.has("admin-transpile-packages.generated.mjs"));
    assert.ok(names.has("admin-client-workspace-ignore.generated.mjs"));
    assert.ok(names.has("workspace-theme-css-modules.generated.d.ts"));
    const transpile = readFileSync(
      join(BOOTSTRAP, "admin-transpile-packages.generated.mjs"),
      "utf8"
    );
    assert.match(transpile, /ADMIN_TRANSPILE_PACKAGES/);
  });
});
