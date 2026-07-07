import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const SIMULATE_ROUTE = join(REPO_ROOT, "apps/web/app/api/exposure/simulate/route.ts");
const DIFF_ROUTE = join(REPO_ROOT, "apps/web/app/api/exposure/diff/route.ts");
const SIMULATION_CLIENT = join(
  REPO_ROOT,
  "apps/web/src/exposure/exposure-simulation-client.ts",
);

describe("field exposure phase D0 simulation web client contract", () => {
  it("documents D0 as BFF/client only, not a simulation console", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Control Plane UI — Phase D0/);
    assert.match(text, /POST \/api\/exposure\/simulate/);
    assert.match(text, /resolveConnectionExposureIntentForRoute/);
    assert.match(text, /field-exposure-phase-d0-simulation-client\.contract\.spec\.ts/);
    assert.match(text, /must not add\s+a simulation console/);
  });

  it("ships web BFF routes for backend simulate and diff endpoints", () => {
    const simulateRoute = readFileSync(SIMULATE_ROUTE, "utf8");
    const diffRoute = readFileSync(DIFF_ROUTE, "utf8");

    assert.match(simulateRoute, /proxyIntegrationsApiPost/);
    assert.match(simulateRoute, /\/exposure\/simulate/);
    assert.match(diffRoute, /proxyIntegrationsApiPost/);
    assert.match(diffRoute, /\/exposure\/diff/);
  });

  it("ships pure parsers and fetch clients; Phase D console is a separate contract", () => {
    const client = readFileSync(SIMULATION_CLIENT, "utf8");

    assert.match(client, /parseExposureSimulationResponse/);
    assert.match(client, /parseExposureSimulationDiffResponse/);
    assert.match(client, /fetchExposureSimulation/);
    assert.match(client, /fetchExposureSimulationDiff/);
    assert.match(client, /samplePayload/);
  });
});
