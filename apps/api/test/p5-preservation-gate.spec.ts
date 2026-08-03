/**
 * P5-B-N-014 — Denali operator product preservation gate (static contract)
 * @see docs/phase-18/agent-pack/PRESERVATION-CHECKLIST.md
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const checklistPath = join(repoRoot, "docs/phase-18/agent-pack/PRESERVATION-CHECKLIST.md");
const denaliPluginPath = join(
  repoRoot,
  "packages/workspaces/denali/src/denali.plugin.ts"
);
const settingsManifestPath = join(
  repoRoot,
  "packages/workspaces/denali/src/settings/denali-settings.manifest.ts"
);
const financeRoutesPath = join(
  repoRoot,
  "packages/workspaces/denali/src/http/routes-manifest.ts"
);
const operatorParityMdocPath = join(
  repoRoot,
  "docs/phase-18/platform-denali-operator-parity.mdoc"
);

describe("p5-preservation-gate (PC-01..10)", () => {
  it("PC-GATE-01 checklist defines ten preservation surfaces", () => {
    const checklist = readFileSync(checklistPath, "utf8");
    for (let i = 1; i <= 10; i += 1) {
      const id = `PC-${String(i).padStart(2, "0")}`;
      assert.match(checklist, new RegExp(id));
    }
    assert.match(checklist, /offline_receipt/);
    assert.match(checklist, /Anti-drift/);
  });

  it("PC-GATE-02 Denali plugin exports operator product hooks", () => {
    const plugin = readFileSync(denaliPluginPath, "utf8");
    assert.match(plugin, /tourClone:/);
    assert.match(plugin, /tourList:/);
    assert.match(plugin, /operatorSettings:/);
    assert.match(plugin, /publicCatalog:/);
  });

  it("PC-GATE-03 settings manifest and finance receipt routes present", () => {
    const settings = readFileSync(settingsManifestPath, "utf8");
    assert.match(settings, /tour_wizard_template/);
    assert.match(settings, /equipment/);
    assert.match(settings, /audit_trail/);

    // Finance SoT is `@app-tour/finance-http`; Denali routes-manifest only re-exports.
    const financeRoutes = readFileSync(
      join(repoRoot, "packages/finance-http/src/routes-manifest.ts"),
      "utf8"
    );
    assert.match(financeRoutes, /POST.*\/finance\/receipts/);
    assert.match(financeRoutes, /PATCH.*\/finance\/receipts/);
  });

  it("PC-GATE-04 operator parity mdoc links preservation matrix", () => {
    const mdoc = readFileSync(operatorParityMdocPath, "utf8");
    assert.match(mdoc, /PC-01/);
    assert.match(mdoc, /PC-10/);
    assert.match(mdoc, /NEVER delete/);
    assert.match(mdoc, /offline_receipt/);
  });
});
