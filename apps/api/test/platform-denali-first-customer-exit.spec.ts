/**
 * P6-4-N-004 — platform denali first customer exit contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const gateScriptPath = join(repoRoot, "scripts/p6-denali-product-gate.sh");
const packageJsonPath = join(repoRoot, "package.json");
const docSyncPath = join(repoRoot, "docs/phase-19/p6/DOC-SYNC-INDEX.md");
const verticalSlicePath = join(repoRoot, "docs/phase-19/platform-denali-vertical-slice.mdoc");

describe("platform-denali-first-customer-exit", () => {
  it("EX-P6-01 p6:gate script composes guards and P6 specs", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /guard:p3-denali-covenant/);
    assert.match(gate, /p6-host-tenant-parity\.spec\.ts/);
    assert.match(gate, /p6-guest-slice\.spec\.ts/);
    assert.match(gate, /P6_DENALI_PRODUCT_GATE_OK/);
  });

  it("EX-P6-02 package.json wires p6:gate", () => {
    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p6:gate":\s*"bash scripts\/p6-denali-product-gate\.sh"/);
  });

  it("EX-P6-03 DOC-SYNC v2.1 references vertical slice", () => {
    const docSync = readFileSync(docSyncPath, "utf8");
    assert.match(docSync, /version: "2.1"/);
    const vs = readFileSync(verticalSlicePath, "utf8");
    assert.match(vs, /VS-08/);
  });
});
