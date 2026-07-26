/**
 * Thin Shell Phase 4at — orphaned web wizard-rules binder retirement.
 * Runtime rules load via wizardHost.loadRulesModule (API binder deferred).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-wizard-rules-binder — Phase 4at", () => {
  it("TS-4AT-01 web wizard-rules binder deleted", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-rules-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);
  });

  it("TS-4AT-02 shell host loads rules via wizardHost.loadRulesModule only", () => {
    const host = readFileSync(resolve(WEB_ROOT, "src/wizard/workspace-wizard-host.tsx"), "utf8");
    assert.match(host, /loadRulesModule/);
    assert.doesNotMatch(host, /workspace-wizard-rules-bindings/);
    assert.doesNotMatch(host, /loadWizardRulesModule/);
    assert.doesNotMatch(host, /getWizardRulesModuleSync/);
  });

  it("TS-4AT-03 API wizard-rules binder still present (deferred slice)", () => {
    const apiBinder = resolve(
      WEB_ROOT,
      "../../apps/api/src/tours/workspace-wizard-rules-bindings.generated.ts"
    );
    assert.equal(existsSync(apiBinder), true);
  });
});
