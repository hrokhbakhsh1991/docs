/**
 * PSC-001 Phase 3 — cross-surface static cohesion (SMK-PSC-03).
 * @see docs/dev/platform-surface-cohesion-smoke-matrix.yaml
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("surface cohesion cross-surface — SMK-PSC-03", () => {
  it("SMK-PSC-03-01 all guest surfaces delegate guest-surface-host bootstrap chain", () => {
    for (const rel of [
      "apps/marketing/src/tenant/resolve-marketing-bootstrap.ts",
      "apps/portal/src/tenant/resolve-portal-bootstrap.ts",
      "apps/web/src/urban/urban-api-base.ts",
      "apps/web/src/tenant/fetch-public-tenant-branding.server.ts",
    ]) {
      const source = read(rel);
      assert.match(source, /@app-tour\/guest-surface-host/);
    }
  });

  it("SMK-PSC-03-02 dev pluginId map includes denali urban guest-club smoke tenants", () => {
    const generated = read(
      "packages/guest-surface-host/src/workspace-dev-plugin-ids.generated.ts"
    );
    assert.match(generated, /00000000-0000-4000-8000-000000000003.*denali/);
    assert.match(generated, /00000000-0000-4000-8000-000000000004.*urban/);
    assert.match(generated, /eb29a07b-40bb-4e06-9e35-522cb22dab02.*guest-club/);
  });

  it("SMK-PSC-03-03 catalog paths codegen covers guest-capable workspaces", () => {
    const catalogPaths = read(
      "packages/workspace-sdk/src/catalog/workspace-catalog-paths.generated.ts"
    );
    const operatorCaps = read(
      "packages/workspace-sdk/src/operator/workspace-operator-capabilities.generated.ts"
    );
    for (const pluginId of ["denali", "urban", "guest-club"]) {
      assert.match(catalogPaths, new RegExp(`"${pluginId}"`));
      assert.match(operatorCaps, new RegExp(`"${pluginId}"`));
    }
  });

  it("SMK-PSC-03-04 smoke matrix documents static + e2e hooks", () => {
    const matrix = read("docs/dev/platform-surface-cohesion-smoke-matrix.yaml");
    assert.match(matrix, /SMK-PSC-01/);
    assert.match(matrix, /SMK-WRS-CUSTOM-APEX/);
    assert.match(matrix, /SMK-MKT-03/);
    assert.match(matrix, /SMK-PTL-08/);
  });

  it("SMK-PSC-07 Phase 4 closure documented in PSC-001 standard", () => {
    const psc = read("docs/standards/platform-surface-cohesion.mdoc");
    assert.match(psc, /Phase 4 KPI/);
    assert.match(psc, /phase-psc:fast-track/);
    assert.match(psc, /platform-core extraction \*\*deferred\*\*/);
  });
});
