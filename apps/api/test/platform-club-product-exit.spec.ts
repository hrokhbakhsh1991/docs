/**
 * P4-D — club product phase exit contract
 * @see docs/phase-17/platform-club-product-e2e.mdoc (EX-01…EX-03 · E2E-01 alt)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const gateScriptPath = join(repoRoot, "scripts/p4-club-product-gate.sh");
const e2eGatePath = join(repoRoot, "scripts/p4-club-product-e2e-gate.sh");
const packageJsonPath = join(repoRoot, "package.json");
const exitSurfacesDocPath = join(repoRoot, "docs/phase-17/platform-club-product-surfaces.mdoc");
const exitE2eDocPath = join(repoRoot, "docs/phase-17/platform-club-product-e2e.mdoc");
const umbrellaDocPath = join(repoRoot, "docs/phase-17/platform-club-product-surfaces.mdoc");
const closureDocPath = join(repoRoot, "docs/phase-15/phase-15-closure.mdoc");
const publishServiceSpecPath = join(repoRoot, "apps/api/test/club-catalog-publish-service.spec.ts");

describe("platform-club-product-exit (P4-D EX)", () => {
  it("EX-01 p4:gate script composes guards and P4-A/B/C specs", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /guard:import-boundary/);
    assert.match(gate, /guard:public-catalog-m17/);
    assert.match(gate, /guard:p3-denali-covenant/);
    assert.match(gate, /club-catalog-publish-integration\.spec\.ts/);
    assert.match(gate, /club-catalog-publish-service\.spec\.ts/);
    assert.match(gate, /resolve-web-registration-url\.spec\.ts/);
    assert.match(gate, /platform-club-surfaces-tab\.spec\.ts/);
    assert.match(gate, /platform-tenant-surfaces\.spec\.ts/);
    assert.match(gate, /public-tenant-context\.spec\.ts/);
    assert.match(gate, /read-tenant-site-surfaces\.spec\.ts/);
    assert.match(gate, /seed-tenant-site-surfaces\.spec\.ts/);
    assert.match(gate, /tenant-site-surfaces-maintenance\.spec\.ts/);
    assert.match(gate, /P4_CLUB_PRODUCT_GATE_OK/);
    assert.match(gate, /denali-registration\.spec\.ts/);
  });

  it("EX-01b package.json wires p4:gate and p4:e2e-gate", () => {
    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p4:gate":\s*"bash scripts\/p4-club-product-gate\.sh"/);
    assert.match(pkg, /"p4:e2e-gate":\s*"bash scripts\/p4-club-product-e2e-gate\.sh"/);
  });

  it("EX-02 M17 guard is in p4:gate before unit specs", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    const m17Index = gate.indexOf("guard:public-catalog-m17");
    const apiIndex = gate.indexOf("club-catalog-publish");
    assert.ok(m17Index >= 0 && apiIndex > m17Index);
  });

  it("EX-02b p4:gate runs guest-surface-host + SDK catalog specs after M17", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /guest-surface-host run test/);
    assert.match(gate, /resolve-catalog-list-features\.spec\.ts/);
    const m17Index = gate.indexOf("guard:public-catalog-m17");
    const guestIndex = gate.indexOf("guest-surface-host run test");
    assert.ok(m17Index >= 0 && guestIndex > m17Index);
  });

  it("EX-02c p4:gate runs registration intake specs (SDK + API + web ops parser)", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /catalog-registration-dispatch\.spec\.ts/);
    assert.match(gate, /registration-intake\.contract\.spec\.ts/);
    assert.match(gate, /denali-registration\.spec\.ts/);
    assert.match(gate, /format-registration-intake\.spec\.ts/);
  });

  it("EX-03 exit docs record P4 closure (docs/ authority — not TEMP)", () => {
    const surfaces = readFileSync(exitSurfacesDocPath, "utf8");
    assert.match(surfaces, /P4-D \| 10\s+\| 10/);
    assert.match(surfaces, /G3.*landed|G3.*✅/);
    assert.match(surfaces, /G5.*landed|G5.*✅/);

    const e2eDoc = readFileSync(exitE2eDocPath, "utf8");
    assert.match(e2eDoc, /p4:gate/);
    assert.match(e2eDoc, /denali-registration/);

    const closure = readFileSync(closureDocPath, "utf8");
    assert.match(closure, /P4 Club product surfaces/);
  });

  it("E2E-01 alt PW-01 publish→catalog proof in gate chain", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /club-catalog-publish-service\.spec\.ts/);
    const publishSpec = readFileSync(publishServiceSpecPath, "utf8");
    assert.match(publishSpec, /PW-01/);
  });

  it("EX-03b p4:e2e-gate stub documents Playwright smokes", () => {
    const e2eGate = readFileSync(e2eGatePath, "utf8");
    assert.match(e2eGate, /playwright\.marketing\.config\.ts/);
    assert.match(e2eGate, /playwright\.portal\.config\.ts/);
    assert.doesNotMatch(e2eGate, /playwright\.denali\.config\.ts/);
    assert.match(e2eGate, /P4_CLUB_PRODUCT_E2E_GATE_OK/);
  });

  it("EX-03c umbrella gap register marks G3 landed", () => {
    const umbrella = readFileSync(umbrellaDocPath, "utf8");
    assert.match(umbrella, /G3.*landed|G3.*✅/);
    assert.match(umbrella, /P4-D.*10.*10|P4-D \| 10 \| 10/);
  });
});
