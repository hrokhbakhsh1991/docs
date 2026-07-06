/**
 * MKT-7 — marketing guest theme dynamic loader contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const bootstrapPath = join(
  repoRoot,
  "apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
);
const layoutPath = join(repoRoot, "apps/marketing/app/layout.tsx");

describe("marketing-guest-theme-loader.spec.ts — MKT-7", () => {
  it("MKT-THEME-01 generated loader has no eager workspace skin imports", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    assert.doesNotMatch(generated, /^import ["']@app-tour\/workspace-/m);
    assert.match(generated, /importGuestMarketingThemeForPlugin/);
    assert.match(generated, /WORKSPACE_GUEST_MARKETING_THEME_REGISTRY/);
  });

  it("MKT-THEME-02 layout loads skin per active pluginId", () => {
    const layout = readFileSync(layoutPath, "utf8");
    assert.match(layout, /await importGuestMarketingThemeForPlugin\(bootstrap\.pluginId\)/);
  });

  it("MKT-THEME-03 registry lists denali, urban, guest-club", () => {
    const generated = readFileSync(bootstrapPath, "utf8");
    for (const id of ["denali", "urban", "guest-club"]) {
      assert.match(generated, new RegExp(`"${id}"`));
    }
  });
});
