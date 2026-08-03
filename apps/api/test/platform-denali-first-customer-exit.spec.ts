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
    assert.match(gate, /p6-member-receipt-flow\.spec\.ts/);
    assert.match(gate, /p6-vertical-slice-chain\.spec\.ts/);
    assert.match(gate, /p6-vs01-admin-publish\.spec\.ts/);
    assert.match(gate, /tour-publish-transition\.spec\.ts/);
    assert.match(gate, /marketing-catalog-revalidate\.spec\.ts/);
    assert.match(gate, /guard:public-catalog-m17/);
    assert.match(gate, /guest-surface-host run test/);
    assert.match(gate, /resolve-catalog-list-features\.spec\.ts/);
    assert.match(gate, /finance-page\.spec\.ts/);
    assert.match(gate, /finance-dashboard-widget\.spec\.ts/);
    assert.match(gate, /P6_DENALI_PRODUCT_GATE_OK/);
  });

  it("EX-P6-01b M17 guard runs in p6:gate before marketing unit specs", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    const m17Index = gate.indexOf("guard:public-catalog-m17");
    const marketingIndex = gate.indexOf("== p6:gate — marketing unit ==");
    assert.ok(m17Index >= 0 && marketingIndex > m17Index);
  });

  it("EX-P6-02 package.json wires p6 gates", () => {
    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p6:gate":\s*"bash scripts\/p6-denali-product-gate\.sh"/);
    assert.match(pkg, /"p6:e2e-gate":\s*"bash scripts\/p6-denali-e2e-gate\.sh"/);
    assert.match(pkg, /"p6:staging-gate":\s*"bash scripts\/p6-staging-gate\.sh"/);
  });

  it("EX-P6-04 e2e gate script wires VS-01..07 browser smokes", () => {
    const e2eGate = readFileSync(join(repoRoot, "scripts/p6-denali-e2e-gate.sh"), "utf8");
    assert.match(e2eGate, /p6:gate/);
    assert.match(e2eGate, /SMK-P6-VS-01 active tour/);
    assert.match(e2eGate, /P6-VS-CHAIN-B01/);
    assert.match(e2eGate, /SMK-P6-ADM-02/);
    assert.match(e2eGate, /SMK-P9-04/);
    assert.match(e2eGate, /P6_E2E_GATE_OK/);
  });

  it("EX-P6-05 CI workflow wires p6 product gate", () => {
    const workflow = readFileSync(
      join(repoRoot, ".github/workflows/p6-denali-gate.yml"),
      "utf8"
    );
    assert.match(workflow, /pnpm run p6:gate/);
    assert.match(workflow, /build-api-workspace-deps\.sh/);
    assert.match(workflow, /DATABASE_URL/);
    assert.match(workflow, /p6:e2e-gate/);
    assert.match(workflow, /p6:staging-gate/);
  });

  it("EX-P6-03 DOC-SYNC references vertical slice", () => {
    const docSync = readFileSync(docSyncPath, "utf8");
    assert.match(docSync, /version: "2\.2-fast-close"/);
    const vs = readFileSync(verticalSlicePath, "utf8");
    assert.match(vs, /VS-08/);
  });

  it("EX-P6-06 staging deploy wiring scripts exist", () => {
    const stagingVerify = readFileSync(
      join(repoRoot, "scripts/p6-staging-deploy-verify.sh"),
      "utf8"
    );
    assert.match(stagingVerify, /P6_STAGING_DEPLOY_VERIFY_OK/);
    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p6:staging-preflight":/);
    assert.match(pkg, /"p6:staging-deploy-verify":/);
  });

  it("EX-P6-07 staging gates wire Postgres finance-ops when DATABASE_URL set", () => {
    const stagingGate = readFileSync(join(repoRoot, "scripts/p6-staging-gate.sh"), "utf8");
    assert.match(stagingGate, /finance-ops\.spec\.ts/);
    assert.match(stagingGate, /P6_STAGING_GATE_OK/);
    const preflight = readFileSync(join(repoRoot, "scripts/p6-staging-preflight.sh"), "utf8");
    assert.match(preflight, /finance-ops\.spec\.ts/);
    assert.match(preflight, /P6_STAGING_PREFLIGHT_OK/);
    assert.match(preflight, /p6-staging-deploy-verify\.sh/);
  });

  it("EX-P6-08 p6:closure orchestrates gate + staging preflight", () => {
    const closure = readFileSync(join(repoRoot, "scripts/p6-closure.sh"), "utf8");
    assert.match(closure, /p6:gate/);
    assert.match(closure, /p6:staging-preflight/);
    assert.match(closure, /P6_CLOSURE_OK/);
    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p6:closure":/);
  });
});
