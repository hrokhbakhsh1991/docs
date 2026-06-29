import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const SIMULATION_PAGE = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/exposure/simulate/page.tsx",
);
const SIMULATION_PAGE_CLIENT = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/exposure/simulate/exposure-simulation-page-client.tsx",
);
const SIMULATION_CONSOLE = join(REPO_ROOT, "apps/web/src/exposure/ExposureSimulationConsole.tsx");
const SIMULATION_CLIENT = join(
  REPO_ROOT,
  "apps/web/src/exposure/exposure-simulation-client.ts",
);
const EXPOSURE_SETTINGS = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx",
);

describe("field exposure phase D UI contract", () => {
  it("documents simulation console scope and exit criteria", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Control Plane UI — Phase D \(simulation console\)/);
    assert.match(text, /settings\/exposure\/simulate/);
    assert.match(text, /fetchExposureSimulationDiff/);
    assert.match(text, /field-exposure-phase-d-ui\.contract\.spec\.ts/);
    assert.match(text, /no `patchExposureIntent`/);
  });

  it("ships simulation console page and component wired to diff client", () => {
    assert.equal(existsSync(SIMULATION_PAGE), true);
    assert.equal(existsSync(SIMULATION_PAGE_CLIENT), true);

    const pageClient = readFileSync(SIMULATION_PAGE_CLIENT, "utf8");
    const consoleSource = readFileSync(SIMULATION_CONSOLE, "utf8");

    assert.match(pageClient, /ExposureSimulationConsole/);
    assert.match(consoleSource, /fetchExposureSimulationDiff/);
    assert.match(consoleSource, /EXPOSURE_SIMULATION_CONSOLE_TEST_IDS/);
    assert.match(consoleSource, /draftIntent/);
    assert.doesNotMatch(consoleSource, /patchExposureIntent/);
  });

  it("does not surface engineering control-plane links on operator exposure settings", () => {
    const settings = readFileSync(EXPOSURE_SETTINGS, "utf8");

    assert.doesNotMatch(settings, /settings\/exposure\/control-plane/);
    assert.doesNotMatch(settings, /openControlPlane/);
  });

  it("does not surface engineering simulation console links on operator exposure settings", () => {
    const settings = readFileSync(EXPOSURE_SETTINGS, "utf8");

    assert.doesNotMatch(settings, /settings\/exposure\/simulate/);
    assert.doesNotMatch(settings, /openSimulation/);
  });

  it("reuses simulation client parsers from Phase D0 foundation", () => {
    const client = readFileSync(SIMULATION_CLIENT, "utf8");

    assert.match(client, /parseExposureSimulationDiffResponse/);
    assert.match(client, /fetchExposureSimulationDiff/);
  });
});
