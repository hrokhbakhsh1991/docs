/**
 * P9 pack doc integrity — v1.0 AI-agent hardened.
 * @see docs/phase-22/appendices/P9-BOOT-MANIFEST.yaml
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");
const P9_ROOT = join(ROOT, "docs/phase-22");

const P9_APPENDICES = [
  "P9-BOOT-MANIFEST.yaml",
  "P9-ANTI-HOLLOW-CONTRACT.md",
  "P9-AGENT-TURN-SCHEMA.md",
  "P9-VERIFICATION-COMMANDS.yaml",
  "P9-IMPLEMENTATION-TRUTH.md",
  "P9-EXECUTION-DISCIPLINE.md",
  "P9-DEPRECATED-ENTRYPOINTS.md",
] as const;

const NANO_KEY_RE = /^P9-[0-3]-N-[0-9]{3}:/gm;

function readP9(rel: string): string {
  return readFileSync(join(P9_ROOT, rel), "utf8");
}

describe("p9-pack-integrity", () => {
  it("P9-AGENT-01 AGENT-CURRENT-PHASE.yaml pack v1.0", () => {
    const raw = readP9("AGENT-CURRENT-PHASE.yaml");
    assert.match(raw, /^pack_version:\s+"1.0"/m);
    assert.match(raw, /^ai_agent_pack:\s+COMPLETE/m);
    assert.match(raw, /^status:\s+BEHAVIORAL_COMPLETE/m);
    assert.match(raw, /^current_task:\s+null/m);
    assert.match(raw, /^fail_token:\s+P9_FAIL/m);
  });

  it("P9-AGENT-02 appendices exist", () => {
    for (const name of P9_APPENDICES) {
      assert.ok(existsSync(join(P9_ROOT, "appendices", name)), `missing ${name}`);
    }
  });

  it("P9-DOC-01 DOC-SYNC nano_total 13", () => {
    const raw = readP9("DOC-SYNC-INDEX.md");
    assert.match(raw, /nano_total:\s+13/);
  });

  it("P9-BOOT-01 BOOT-MANIFEST prerequisite p8:gate", () => {
    const boot = readP9("appendices/P9-BOOT-MANIFEST.yaml");
    assert.match(boot, /fail_token: P9_FAIL/);
    assert.match(boot, /pnpm run p8:gate/);
    assert.match(boot, /P8_PLATFORM_SURFACE_GATE_OK/);
    assert.match(boot, /nano_total:\s+13/);
    assert.match(boot, /algorithm: detect_current_nano/);
  });

  it("P9-AH-01 anti-hollow forbids web public-auth + catalog delete", () => {
    const ah = readP9("appendices/P9-ANTI-HOLLOW-CONTRACT.md");
    assert.match(ah, /does_not_prove/);
    assert.match(ah, /public-auth/);
    assert.match(ah, /catalog redirect|Delete.*catalog/i);
    assert.match(ah, /guest-surface-host imported in apps\/web/);
  });

  it("P9-VC-01 verification YAML has 13 nano keys", () => {
    const vc = readP9("appendices/P9-VERIFICATION-COMMANDS.yaml");
    const keys = vc.match(NANO_KEY_RE) ?? [];
    assert.equal(keys.length, 13, `expected 13 nanos, got ${keys.length}`);
  });

  it("P9-VC-02 every nano has proof_tier + forbidden_shortcuts", () => {
    const vc = readP9("appendices/P9-VERIFICATION-COMMANDS.yaml");
    const blocks = vc.split(/^P9-[0-3]-N-[0-9]{3}:/m).slice(1);
    assert.equal(blocks.length, 13);
    for (const block of blocks) {
      assert.match(block, /proof_tier:/);
      assert.match(block, /forbidden_shortcuts:/);
      assert.match(block, /^\s+- run:/m);
    }
  });

  it("P9-TURN-01 turn schema scope_violation", () => {
    const turn = readP9("appendices/P9-AGENT-TURN-SCHEMA.md");
    assert.match(turn, /scope_violation/);
    assert.match(turn, /P9_FAIL/);
  });

  it("P9-FIT-01 app-fit web keeps operator host", () => {
    const fit = readP9("p9-app-fit.md");
    assert.match(fit, /operator resolve-host-tenant/);
    assert.match(fit, /نگه دار|catalog redirect/);
    assert.match(fit, /ممنوع|must NOT/i);
  });

  it("P9-BOUND-01 package boundary web not guest-surface-host", () => {
    const b = readP9("p9-package-boundary.yaml");
    assert.match(b, /not_to:.*guest-surface-host/);
    assert.match(b, /307 redirect shim/);
  });

  it("P9-GATE-01 p9:gate registered", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p9:gate"/);
    assert.ok(existsSync(join(ROOT, "scripts/p9-code-consolidation-gate.sh")));
  });

  it("P9-START-01 AGENT-START sole boot", () => {
    const start = readP9("AGENT-START.md");
    assert.match(start, /sole_boot: appendices\/P9-BOOT-MANIFEST.yaml/);
    assert.match(start, /turn_report/);
  });
});
