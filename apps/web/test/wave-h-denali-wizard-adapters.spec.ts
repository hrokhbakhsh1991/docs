/**
 * SaaS remediation — Denali path-stable shell adapters removed; capability host owns warm.
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
const REGISTRY = join(WEB_ROOT, "src/wizard/wizard-host-adapter-registry.ts");

describe("Wave H.d.a — denali wizard adapters collapsed to package+capability", () => {
  it("H.d.a-01 apps/web/src/wizard/denali directory is gone", () => {
    assert.equal(existsSync(DENALI_DIR), false);
  });

  it("H.d.a-02 host-adapters + draft-shell product binders deleted", () => {
    assert.equal(existsSync(GENERATED), false);
    assert.equal(existsSync(DRAFT_SHELL), false);
  });

  it("H.d.a-03 shell host-adapter registry is product-blind", () => {
    const source = readFileSync(REGISTRY, "utf8");
    assert.match(source, /WIZARD_HOST_ADAPTER_SURFACE_KEY/);
    assert.doesNotMatch(source, /@app-cloud\/workspace-denali/);
    assert.doesNotMatch(source, /ensureDenali/);
  });
});
