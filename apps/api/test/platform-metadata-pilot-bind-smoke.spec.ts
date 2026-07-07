/**
 * P5-A-N-007 — smoke metadata pilot bind script contract
 * @see docs/phase-18/platform-metadata-cutover-pilot.mdoc (SMOKE-01)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(apiRoot, "../..");
const scriptPath = join(apiRoot, "scripts/smoke-metadata-pilot-bind.mjs");

describe("platform-metadata-pilot-bind-smoke (P5-A SMOKE-01)", () => {
  it("SMOKE-01 script exists with staging guard and platform PATCH/GET flow", () => {
    const source = readFileSync(scriptPath, "utf8");
    assert.match(source, /smoke-metadata-pilot-bind/);
    assert.match(source, /PILOT_TENANT_ID/);
    assert.match(source, /NODE_ENV === "production"/);
    assert.match(source, /\/platform\/v1\/tenants\/\$\{encodeURIComponent\(tenantId\)\}\/workspace-definition/);
    assert.match(source, /metadataCutoverStage/);
    assert.match(source, /PILOT_DEFINITION_ID/);
  });

  it("SMOKE-01 phase-18 mdoc documents the script", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-metadata-cutover-pilot.mdoc"),
      "utf8"
    );
    assert.match(mdoc, /smoke-metadata-pilot-bind\.mjs/);
    assert.match(mdoc, /PILOT_TENANT_ID/);
  });
});
