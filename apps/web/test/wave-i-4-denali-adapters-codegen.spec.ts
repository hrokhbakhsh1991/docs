/**
 * Wave I.4 — Denali host adapters codegen; shell has no wizard/denali product firewall path.
 * Gap Closure B.10 — full host-adapters surface is dynamic-only.
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

describe("Wave I.4 — denali adapters codegen", () => {
  it("I.4-01 wizard/denali firewall directory removed", () => {
    assert.equal(existsSync(DENALI_FW), false);
  });

  it("I.4-02 generated host adapters barrel binds Denali host modules dynamically", () => {
    const generated = readFileSync(GENERATED, "utf8");
    assert.match(generated, /ensureDenaliHostAdapters/);
    assert.match(generated, /localizeDenaliValidationIssueMessage/);
    assert.match(generated, /import\("@app-tour\/workspace-denali/);
    assert.doesNotMatch(
      generated,
      /(?:import|export)\s+\{[^}]*\}\s+from\s+"@app-tour\/workspace-denali/
    );
  });

  it("I.4-03 DENALI_PLUGIN_ID is codegen literal; draft-shell loads via dynamic import", () => {
    const source = readFileSync(DRAFT_SHELL, "utf8");
    assert.match(source, /export const DENALI_PLUGIN_ID = /);
    assert.match(source, /ensureWizardDraftShellSurface/);
    assert.match(
      source,
      /await import\("@app-tour\/workspace-denali\/host\/ui\/chrome\/wizard-draft-shell-surface"\)/
    );
    assert.doesNotMatch(
      source,
      /(?:import|export)\s+\{[^}]*\}\s+from\s+"@app-tour\/workspace-denali\/host\/ui\/chrome\/wizard-draft-shell-surface"/
    );
  });

  it("I.4-04 thin-shell forbids deleted wizard/denali directory", () => {
    const guard = readFileSync(
      join(WEB, "../../scripts/guards/guard-thin-shell.mjs"),
      "utf8"
    );
    assert.match(guard, /FORBIDDEN_SHELL_PATHS/);
    assert.match(guard, /apps\/web\/src\/wizard\/denali/);
    assert.match(guard, /workspace-host-adapters\.generated\.ts/);
  });
});
