/**
 * Wave I.4 — Denali host adapters via package wizardHost.ensureReady + Pattern B registry.
 * Product binder `workspace-host-adapters.generated.ts` retired (platform closure wave).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_FW = join(WEB, "src/wizard/denali");
const GENERATED = join(WEB, "src/bootstrap/workspace-host-adapters.generated.ts");
const DRAFT_SHELL = join(WEB, "src/bootstrap/workspace-wizard-draft-shell-bindings.generated.ts");
const REGISTRY = join(WEB, "src/wizard/wizard-host-adapter-registry.ts");
const WARM = join(WEB, "src/wizard/warm-operator-wizard-shell.ts");

describe("Wave I.4 — denali adapters via capability host", () => {
  it("I.4-01 wizard/denali firewall directory removed", () => {
    assert.equal(existsSync(DENALI_FW), false);
  });

  it("I.4-02 host-adapters product binder deleted; registry + warm are capability-only", () => {
    assert.equal(existsSync(GENERATED), false);
    assert.equal(existsSync(DRAFT_SHELL), false);
    const registry = readFileSync(REGISTRY, "utf8");
    const warm = readFileSync(WARM, "utf8");
    assert.match(registry, /WIZARD_HOST_ADAPTER_SURFACE_KEY/);
    assert.match(registry, /requireWizardHostAdapterSurface/);
    assert.doesNotMatch(registry, /@app-cloud\/workspace-denali/);
    assert.match(warm, /ensureWizardHostReady/);
    assert.match(warm, /loadWorkspacePluginByIdFromRegistry/);
    assert.doesNotMatch(warm, /workspace-host-adapters/);
    assert.doesNotMatch(warm, /ensureDenaliHostAdapters/);
  });

  it("I.4-03 thin-shell forbids deleted wizard/denali directory", () => {
    const guard = readFileSync(
      join(WEB, "../../scripts/guards/guard-thin-shell.mjs"),
      "utf8"
    );
    assert.match(guard, /FORBIDDEN_SHELL_PATHS/);
    assert.match(guard, /apps\/web\/src\/wizard\/denali/);
    assert.doesNotMatch(guard, /workspace-host-adapters\.generated\.ts/);
  });
});
