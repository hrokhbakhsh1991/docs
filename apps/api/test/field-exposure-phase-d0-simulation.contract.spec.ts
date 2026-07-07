import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const SIMULATION_SERVICE = join(REPO_ROOT, "apps/api/src/exposure/exposure-simulation.service.ts");
const CONNECTION_SCOPE = join(
  REPO_ROOT,
  "apps/api/src/exposure/connection-exposure-intent-scope.ts",
);
const PRISMA_INTENT_REPOSITORY = join(
  REPO_ROOT,
  "apps/api/src/exposure/prisma-exposure-intent.repository.ts",
);
const EXPOSURE_ROUTES = join(REPO_ROOT, "apps/api/src/exposure/exposure.routes.ts");
const APP = join(REPO_ROOT, "apps/api/src/app.ts");

describe("field exposure phase D0 simulation backend contract", () => {
  it("documents simulation/diff as backend foundation only", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Control Plane UI — Phase D0/);
    assert.match(text, /POST \/exposure\/simulate/);
    assert.match(text, /POST \/exposure\/diff/);
    assert.match(text, /resolveConnectionExposureIntentForRoute/);
    assert.match(text, /field-exposure-phase-d0-simulation\.contract\.spec\.ts/);
    assert.match(text, /non-mutating/);
  });

  it("ships deterministic simulate and diff services without persistence writes", () => {
    const service = readFileSync(SIMULATION_SERVICE, "utf8");

    assert.match(service, /simulateExposure/);
    assert.match(service, /diffExposureSimulation/);
    assert.match(service, /buildDeterministicExposureEnginePreview/);
    assert.match(service, /resolveConnectionExposureIntentForRoute/);
    assert.match(service, /buildSimulatedExposureIntent/);
    assert.match(service, /samplePayload/);
    assert.doesNotMatch(service, /\.upsert\(/);
    assert.doesNotMatch(service, /enqueue/);
  });

  it("anchors integration exposure intents by connection and route event type", () => {
    const scope = readFileSync(CONNECTION_SCOPE, "utf8");
    const repository = readFileSync(PRISMA_INTENT_REPOSITORY, "utf8");

    assert.match(scope, /buildConnectionExposureIntentScope/);
    assert.match(scope, /eventType: input\.eventType/);
    assert.match(scope, /findConnectionExposureIntentForEvent/);
    assert.doesNotMatch(scope, /scope: \{ connectionId: input\.connectionId \}/);
    assert.match(repository, /orderBy: \{ updatedAt: "desc" \}/);
  });

  it("registers POST simulate and diff routes", () => {
    const routes = readFileSync(EXPOSURE_ROUTES, "utf8");
    const app = readFileSync(APP, "utf8");

    assert.match(routes, /handlePostExposureSimulation/);
    assert.match(routes, /handlePostExposureDiff/);
    assert.match(app, /\/exposure\/simulate/);
    assert.match(app, /\/exposure\/diff/);
  });
});
