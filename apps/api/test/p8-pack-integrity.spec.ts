/**
 * P8 pack doc integrity — v1.0 AI-agent hardened.
 * @see docs/phase-21/appendices/P8-BOOT-MANIFEST.yaml
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");
const P8_ROOT = join(ROOT, "docs/phase-21");

const P8_APPENDICES = [
  "P8-BOOT-MANIFEST.yaml",
  "P8-ANTI-HOLLOW-CONTRACT.md",
  "P8-AGENT-TURN-SCHEMA.md",
  "P8-VERIFICATION-COMMANDS.yaml",
  "P8-IMPLEMENTATION-TRUTH.md",
  "P8-EXECUTION-DISCIPLINE.md",
  "P8-DEPRECATED-ENTRYPOINTS.md",
] as const;

const NANO_KEY_RE = /^P8-[0-3]-N-[0-9]{3}:/gm;

function readP8(rel: string): string {
  return readFileSync(join(P8_ROOT, rel), "utf8");
}

describe("p8-pack-integrity", () => {
  it("P8-AGENT-01 AGENT-CURRENT-PHASE.yaml pack v1.0", () => {
    const raw = readP8("AGENT-CURRENT-PHASE.yaml");
    assert.match(raw, /^status:\s+(PLANNED|IN_PROGRESS|BEHAVIORAL_COMPLETE)/m);
    assert.match(raw, /^pack_version:\s+"1.0"/m);
    assert.match(raw, /^ai_agent_pack:\s+COMPLETE/m);
    assert.match(raw, /^current_task:\s+(null|P8-[0-3]-N-)/m);
  });

  it("P8-AGENT-02 appendices exist", () => {
    for (const name of P8_APPENDICES) {
      assert.ok(existsSync(join(P8_ROOT, "appendices", name)), `missing ${name}`);
    }
  });

  it("P8-DOC-01 DOC-SYNC nano_total 14", () => {
    const raw = readP8("DOC-SYNC-INDEX.md");
    assert.match(raw, /nano_total:\s+14/);
    assert.match(raw, /pack_version:\s+"1.0"/);
  });

  it("P8-BOOT-01 BOOT-MANIFEST boot_sequence_T0 >= 6 steps", () => {
    const boot = readP8("appendices/P8-BOOT-MANIFEST.yaml");
    assert.match(boot, /fail_token: P8_FAIL/);
    assert.match(boot, /boot_sequence_T0:/);
    const steps = boot.match(/^\s+- step:/gm);
    assert.ok(steps && steps.length >= 6, "boot_sequence_T0 needs >= 6 steps");
    assert.match(boot, /algorithm: detect_current_nano/);
    assert.match(boot, /nano_total:\s+14/);
  });

  it("P8-AH-01 anti-hollow p8:gate does_not_prove Profile B", () => {
    const ah = readP8("appendices/P8-ANTI-HOLLOW-CONTRACT.md");
    assert.match(ah, /does_not_prove/);
    assert.match(ah, /pnpm run p8:gate/);
    assert.match(ah, /Profile B/);
    assert.match(ah, /fail_token: P8_FAIL/);
    assert.match(ah, /guest-surface-host/);
  });

  it("P8-VC-01 verification YAML has 14 nano keys", () => {
    const vc = readP8("appendices/P8-VERIFICATION-COMMANDS.yaml");
    const keys = vc.match(NANO_KEY_RE) ?? [];
    assert.equal(keys.length, 14, `expected 14 nanos, got ${keys.length}`);
  });

  it("P8-VC-02 every nano has proof_tier + command", () => {
    const vc = readP8("appendices/P8-VERIFICATION-COMMANDS.yaml");
    const blocks = vc.split(/^P8-[0-3]-N-[0-9]{3}:/m).slice(1);
    assert.equal(blocks.length, 14);
    for (const block of blocks) {
      assert.match(block, /proof_tier:/);
      assert.match(block, /^\s+- run:/m);
      assert.match(block, /forbidden_shortcuts:/);
    }
  });

  it("P8-TURN-01 turn schema references fail_token", () => {
    const turn = readP8("appendices/P8-AGENT-TURN-SCHEMA.md");
    assert.match(turn, /fail_token: P8_FAIL/);
    assert.match(turn, /turn_report:/);
    assert.match(turn, /scope_violation/);
  });

  it("P8-FIT-01 app-fit forbids P9/P10 scope in P8", () => {
    const fit = readP8("p8-app-fit.md");
    assert.match(fit, /guest-surface-host.*P9/);
    assert.match(fit, /TLS.*P10/);
    assert.match(fit, /public-auth.*P9/);
  });

  it("P8-GATE-01 p8:gate script registered", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p8:gate"/);
    assert.ok(existsSync(join(ROOT, "scripts/p8-platform-surface-gate.sh")));
  });

  it("P8-GATE-02 p8:gate runs surface unit bundle", () => {
    const gate = readFileSync(join(ROOT, "scripts/p8-platform-surface-gate.sh"), "utf8");
    assert.match(gate, /P8 surface unit bundle/);
    assert.match(gate, /p8-pack-integrity\.spec\.ts/);
    assert.match(gate, /guest-bootstrap-parity\.spec\.ts/);
    assert.match(gate, /portal-middleware\.spec\.ts/);
    assert.match(gate, /P8_PLATFORM_SURFACE_GATE_OK/);
  });

  it("P8-GATE-03 CI workflow wires p8 product gate", () => {
    assert.ok(existsSync(join(ROOT, ".github/workflows/p8-platform-surface-gate.yml")));
    const wf = readFileSync(join(ROOT, ".github/workflows/p8-platform-surface-gate.yml"), "utf8");
    assert.match(wf, /pnpm run p8:gate/);
  });

  it("P8-DEPLOY-01 remote-deploy verify-env --all when four env", () => {
    const deploy = readFileSync(join(ROOT, "scripts/vps-deploy/remote-deploy.sh"), "utf8");
    assert.match(deploy, /verify-env-coherence\.sh.*--all/);
    assert.match(deploy, /marketing\.env/);
    assert.match(deploy, /portal\.env/);
  });

  it("P8-CTX-01 AGENT-CONTEXT is redirect stub", () => {
    const ctx = readP8("AGENT-CONTEXT.md");
    assert.match(ctx, /AGENT-START.md/);
    assert.match(ctx, /BOOT-MANIFEST/);
  });

  it("P8-SMOKE-01 Profile B smoke script registered", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p8:staging-remote-smoke"/);
    assert.ok(existsSync(join(ROOT, "scripts/smoke-p8-profile-b.mjs")));
    assert.ok(existsSync(join(ROOT, "scripts/p8-staging-remote-smoke.sh")));
    assert.ok(existsSync(join(P8_ROOT, "runbooks/p8-profile-b-vps-smoke.md")));
  });

  it("P8-RB-01 loopback runbook exists for P8-0-N-004", () => {
    assert.ok(existsSync(join(P8_ROOT, "runbooks/p8-api-loopback-vps.md")));
  });

  it("P8-START-01 AGENT-START sole boot v1.0", () => {
    const start = readP8("AGENT-START.md");
    assert.match(start, /sole_boot: appendices\/P8-BOOT-MANIFEST.yaml/);
    assert.match(start, /turn_report/);
    assert.match(start, /P8_FAIL/);
  });
});
