/**
 * Phase I1 — theme import budget guard unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  collectThemeLoaderViolations,
  countAwaitDynamicImports,
  extractAsyncFunctionBody,
  maxImportsPerSwitchPath,
} from "../guards/lib/theme-import-budget-guard.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("theme import budget guard (Phase I1)", () => {
  it("admin loader stays within budget of 1 import per path", () => {
    const generated = readFileSync(
      join(REPO_ROOT, "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts"),
      "utf8"
    );
    const layout = readFileSync(join(REPO_ROOT, "apps/web/app/layout.tsx"), "utf8");
    const violations = collectThemeLoaderViolations({
      surface: "admin",
      generated,
      layout,
      loaderName: "importAdminThemeForPlugin",
      layoutCallPattern: /await importAdminThemeForPlugin\(resolved\.session\.pluginId\)/,
      maxImportsPerPath: 1,
    });
    assert.deepEqual(violations, []);
  });

  it("portal guest loader allows starter base + plugin overlay (2)", () => {
    const generated = readFileSync(
      join(REPO_ROOT, "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.portal.generated.ts"),
      "utf8"
    );
    const body = extractAsyncFunctionBody(generated, "importGuestPortalThemeForPlugin");
    assert.ok(body);
    assert.equal(maxImportsPerSwitchPath(body), 2);
  });

  it("rejects loader bodies that exceed per-path import budget", () => {
    const violations = collectThemeLoaderViolations({
      surface: "test",
      generated: `export async function importAdminThemeForPlugin() {
  await import("a.css");
  await import("b.css");
}`,
      layout: "await importAdminThemeForPlugin(x)",
      loaderName: "importAdminThemeForPlugin",
      layoutCallPattern: /await importAdminThemeForPlugin/,
      maxImportsPerPath: 1,
    });
    assert.match(violations.join("\n"), /exceeds import budget/);
  });

  it("countAwaitDynamicImports counts dynamic imports only", () => {
    assert.equal(countAwaitDynamicImports('await import("x");\nconst y = 1;'), 1);
  });
});
