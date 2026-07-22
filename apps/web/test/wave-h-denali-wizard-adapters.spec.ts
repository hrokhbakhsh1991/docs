/**
 * SaaS remediation — Denali path-stable shell adapters removed; hosts use generated bindings only.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_DIR = join(WEB_ROOT, "src/wizard/denali");
const GENERATED = join(WEB_ROOT, "src/bootstrap/workspace-host-adapters.generated.ts");
const DRAFT_SHELL = join(WEB_ROOT, "src/bootstrap/workspace-wizard-draft-shell-bindings.generated.ts");

describe("Wave H.d.a — denali wizard adapters collapsed to package+codegen", () => {
  it("H.d.a-01 apps/web/src/wizard/denali directory is gone", () => {
    assert.equal(existsSync(DENALI_DIR), false);
  });

  it("H.d.a-02 generated host adapters barrel exists with Denali host imports", () => {
    const source = readFileSync(GENERATED, "utf8");
    assert.match(source, /@app-tour\/workspace-denali\/host\//);
    assert.match(source, /localizeDenaliValidationIssueMessage/);
  });

  it("H.d.a-03 DENALI_PLUGIN_ID is codegen manifest literal on draft-shell binder", () => {
    const source = readFileSync(DRAFT_SHELL, "utf8");
    assert.match(source, /export const DENALI_PLUGIN_ID = "denali"/);
    assert.match(source, /ensureWizardDraftShellSurface/);
  });
});
